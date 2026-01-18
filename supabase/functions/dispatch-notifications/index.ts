import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const contentType = req.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
            throw new Error('Invalid Content-Type, expected application/json')
        }

        const body = await req.json()
        const { user_id, type = 'ESCALATION', target_user_id } = body
        if (!user_id) throw new Error('User ID is required')

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Fetch user profile (The person performing the action / sending the ack)
        const { data: userProfile, error: userError } = await supabaseClient
            .from('users')
            .select('email, full_name, expo_push_token')
            .eq('id', user_id)
            .single()

        if (userError || !userProfile) {
            throw new Error(`User lookup failed: ${userError?.message}`)
        }

        const userName = userProfile.full_name || 'Someone'
        const userEmail = userProfile.email

        // Create Notification Event
        const { data: eventData, error: eventError } = await supabaseClient
            .from('notification_events')
            .insert({
                user_id: user_id,
                type: type,
                meta: {
                    user_name: userName,
                    user_email: userEmail,
                    target_user_id: target_user_id
                }
            })
            .select()
            .single()

        if (eventError) {
            console.error('Failed to create notification event:', eventError)
            // Check if table exists error? Proceed anyway but logging will fail
        }
        const eventId = eventData?.id

        const baseLink = 'https://fineapp.vercel.app/alert'
        let recipients = []

        // ---------------------------------------------------
        // TARGETED NOTIFICATION (e.g. Acknowledgment)
        // ---------------------------------------------------
        if (target_user_id) {
            // Fetch the specific target user
            const { data: targetProfile, error: targetError } = await supabaseClient
                .from('users')
                .select('id, email, expo_push_token')
                .eq('id', target_user_id)
                .single()

            if (targetError || !targetProfile) {
                throw new Error(`Target user lookup failed: ${targetError?.message}`)
            }

            // Mock a contact-like object for the loop
            recipients.push({
                destination: targetProfile.email,
                channel: targetProfile.expo_push_token ? 'PUSH' : 'EMAIL', // Simplification
                linked_user: targetProfile
            })

        } else {
            // ---------------------------------------------------
            // BROADCAST NOTIFICATION (Normal behavior)
            // ---------------------------------------------------
            // Fetch confirmed contacts
            const { data: contacts, error: contactsError } = await supabaseClient
                .from('contacts')
                .select(`
        *,
        linked_user:linked_user_id (id, email, expo_push_token)
      `)
                .eq('user_id', user_id)
                .eq('status', 'CONFIRMED')

            if (contactsError) {
                throw new Error(`Contacts query failed: ${contactsError.message}`)
            }
            recipients = contacts || []
        }

        // Define message content based on type
        let title, pushBody, subject, emailHtml

        if (type === 'ACKNOWLEDGMENT') {
            title = '✅ Help is coming'
            pushBody = `${userName} has received your alert and is checking on you.`
            subject = `✅ Alert Acknowledged by ${userName}`
            emailHtml = `
          <h2>Alert Acknowledged</h2>
          <p><strong>${userName}</strong> has received your emergency alert.</p>
        `
        } else if (type === 'TEST_ALERT') {
            title = '🔔 Test Alert'
            pushBody = `${userName} is testing their alert system. No action required.`
            subject = `🔔 Test Alert from ${userName}`
            emailHtml = `
          <h2>Test Alert</h2>
          <p><strong>${userName}</strong> is testing their ImFine alert system.</p>
          <p>No action is required on your part.</p>
        `
        } else if (type === 'ESCALATION') {
            title = '🚨 Emergency Alert'
            pushBody = `${userName} missed a check-in!`
            subject = `🚨 URGENT: ${userName} missed a check-in`
            emailHtml = `
          <h2>Emergency Alert</h2>
          <p><strong>${userName}</strong> has missed a scheduled check-in.</p>
          <p>
            <a href="${baseLink}/${user_id}"
               style="background:red;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;">
               View Status
            </a>
          </p>
        `
        } else {
            // Generic status update
            title = 'Status Update'
            pushBody = `${userName} sent a status update.`
            subject = `${userName} sent a status update`
            emailHtml = `<h2>Status Update</h2><p>${userName} sent an update.</p>`
        }

        const results = []

        // ---------------------------------------------------
        // Notify recipients
        // ---------------------------------------------------
        for (const contact of recipients) {
            let status = 'skipped'
            let error = null
            let channel = 'UNKNOWN'

            try {
                if (contact.linked_user?.expo_push_token) {
                    channel = 'PUSH'
                    const res = await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: contact.linked_user.expo_push_token,
                            title: title,
                            body: pushBody,
                            priority: 'high',
                            data: {
                                type: type === 'ESCALATION' ? 'ESCALATION_ALERT' : type,
                                user_email: userEmail,
                                user_name: userName,
                                user_id: user_id
                            }
                        }),
                    })

                    if (res.ok) {
                        status = 'sent'
                    } else {
                        status = 'failed'
                        error = `Expo API Error: ${res.status}`
                    }
                }

                else if (contact.channel === 'EMAIL') {
                    channel = 'EMAIL'
                    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
                    if (RESEND_API_KEY) {
                        const res = await fetch('https://api.resend.com/emails', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${RESEND_API_KEY}`,
                            },
                            body: JSON.stringify({
                                from: 'ImFine Alert <alert@imfein.com>',
                                to: contact.destination,
                                subject,
                                html: emailHtml,
                            }),
                        })
                        if (res.ok) {
                            status = 'sent'
                        } else {
                            status = 'failed'
                            error = `Resend API Error: ${res.status}`
                        }
                    } else {
                        status = 'failed'
                        error = 'Missing RESEND_API_KEY'
                    }
                }

            } catch (e: any) {
                status = 'failed'
                error = e.message
            }

            // Log delivery if event exists
            if (eventId) {
                await supabaseClient.from('notification_deliveries').insert({
                    event_id: eventId,
                    channel: channel,
                    destination: contact.destination,
                    status: status,
                    error: error,
                    delivered_at: status === 'sent' ? new Date().toISOString() : null,
                    recipient_user_id: contact.linked_user?.id // Store the recipient's user ID
                })
            }

            results.push({ contact: contact.destination, status, error })
        }

        return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})
