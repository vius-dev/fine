import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // This function is called by system (Cron or Webhook), so we use Service Role Key
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { user_id, type = 'ESCALATION' } = await req.json()
        if (!user_id) throw new Error('User ID is required')

        // Fetch user profile to get connection info and location if available
        const { data: userProfile, error: userError } = await supabaseClient
            .from('users')
            .select('email, phone, first_name, last_name') // Add location fields if you have them
            .eq('id', user_id)
            .single()

        if (userError || !userProfile) throw new Error('User not found')

        const userName = `${userProfile.first_name || 'Someone'} ${userProfile.last_name || ''}`.trim() || 'Someone'

        // Fetch confirmed contacts
        const { data: contacts, error: contactsError } = await supabaseClient
            .from('contacts')
            .select(`
        *,
        linked_user:linked_user_id (id, email, expo_push_token)
      `)
            .eq('user_id', user_id)
            .eq('status', 'CONFIRMED')

        const results = []

        // Message Templates
        const subject = type === 'ESCALATION'
            ? `🚨 URGENT: ${userName} missed a check-in`
            : `${userName} sent a status update`

        const baseLink = 'https://fineapp.vercel.app/alert' // Deep link to alert page

        // ------------------------------------------------------------------
        // NEW: Notify the user themselves (Self-Notification)
        // ------------------------------------------------------------------
        if (type === 'ESCALATION' && userProfile.expo_push_token) {
            try {
                await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: userProfile.expo_push_token,
                        title: '⚠️ Missed Check-in',
                        body: 'You missed your check-in time. Your trusted contacts have been alerted.',
                        data: { type: 'SELF_ALERT', userId: user_id },
                        sound: 'default', // TODO: Map userProfile.ringtone_selection to file if custom sounds supported
                        priority: 'high',
                        channelId: 'escalation' // Android channel
                    }),
                });
                console.log(`Self-notification sent to ${userProfile.email}`);
            } catch (err) {
                console.error('Failed to send self-notification:', err);
            }
        }

        if (contactsError) throw new Error('Failed to fetch contacts')
        if (!contacts || contacts.length === 0) {
            console.log('No contacts to notify, but self-notification might have been sent.')
            // Don't return here if self-notification was attempted, or at least log it.
            // Proceed to return if strictly no contacts.
            if (!results.length) return new Response(JSON.stringify({ message: 'No contacts to notify' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const emailHtml = `
      <h2>${type === 'ESCALATION' ? 'Emergency Alert' : 'Status Update'}</h2>
      <p><strong>${userName}</strong> has missed a scheduled check-in and may need help.</p>
      <p><a href="${baseLink}/${user_id}" style="background: red; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none;">View Status</a></p>
    `

        const smsBody = type === 'ESCALATION'
            ? `🚨 HELP: ${userName} missed a check-in. Check status: ${baseLink}/${user_id}`
            : `Info: ${userName} update: ${baseLink}/${user_id}`

        // Iterate and send
        for (const contact of contacts) {
            let status = 'skipped'
            let error = null

            try {
                // 1. Push
                if (contact.linked_user?.expo_push_token) {
                    await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: contact.linked_user.expo_push_token,
                            title: type === 'ESCALATION' ? '🚨 Emergency Alert' : 'Status Update',
                            body: `${userName} missed a check-in!`,
                            data: { type: 'ALERT', userId: user_id },
                            sound: 'default',
                            priority: 'high'
                        }),
                    });
                    status = 'sent_push'
                }
                // 2. Email
                else if (contact.channel === 'EMAIL') {
                    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
                    if (RESEND_API_KEY) {
                        const res = await fetch('https://api.resend.com/emails', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${RESEND_API_KEY}`
                            },
                            body: JSON.stringify({
                                from: 'ImFine Alert <alert@imfein.com>',
                                to: contact.destination,
                                subject: subject,
                                html: emailHtml
                            })
                        })
                        if (!res.ok) throw new Error(await res.text())
                        status = 'sent_email'
                    }
                }
                // 3. SMS
                else if (contact.channel === 'SMS') {
                    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
                    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
                    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

                    if (accountSid && authToken && fromNumber) {
                        const body = new URLSearchParams({
                            To: contact.destination,
                            From: fromNumber,
                            Body: smsBody
                        });
                        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            body: body
                        })
                        if (!res.ok) throw new Error(await res.text())
                        status = 'sent_sms'
                    }
                }
            } catch (e) {
                status = 'failed'
                error = e.message
            }

            // Log delivery attempt
            await supabaseClient.from('notification_deliveries').insert({
                user_id: contact.user_id, // The user who *initiated* the alert (technically contact.user_id is the user who owns the contact, which IS the user in danger)
                channel: contact.channel,
                destination: contact.destination,
                status: status === 'failed' ? 'FAILED' : 'DELIVERED', // Simplify for schema
                error: error,
                payload: { type, user_id }
            })

            results.push({ contact: contact.destination, status, error })
        }

        return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
