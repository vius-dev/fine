import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Debug: Log all headers
        console.log('Request headers:', Object.fromEntries(req.headers.entries()));

        const authHeader = req.headers.get('Authorization');
        console.log('Authorization header:', authHeader ? authHeader.substring(0, 30) + '...' : 'MISSING');

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader! } } }
        )

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

        if (authError) {
            console.error('Auth error:', authError);
            throw new Error('Unauthorized: ' + authError.message);
        }

        if (!user) {
            console.error('No user found');
            throw new Error('Unauthorized: No user found');
        }

        console.log('Authenticated user:', user.email);

        const { contact_id } = await req.json()
        if (!contact_id) throw new Error('Contact ID is required')

        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Get the user's internal profile ID
        const { data: userProfile, error: profileError } = await adminClient
            .from('users')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (profileError || !userProfile) throw new Error('User profile not found')

        // Fetch contact
        const { data: contact, error: contactError } = await adminClient
            .from('contacts')
            .select(`
        *,
        linked_user:linked_user_id (id, email, expo_push_token)
      `)
            .eq('id', contact_id)
            .single()

        if (contactError || !contact) throw new Error('Contact not found')
        if (contact.user_id !== userProfile.id) throw new Error('Unauthorized access to contact')

        // --- NOTIFICATION STRATEGY: Try push first, then fallback to email/SMS ---
        // Always fail loud with detailed error information

        const results = {
            push: { attempted: false, success: false, error: null as string | null },
            email: { attempted: false, success: false, error: null as string | null },
            sms: { attempted: false, success: false, error: null as string | null },
        }

        // 1. Try Push Notification first (if user has the app)
        if (contact.linked_user?.expo_push_token) {
            results.push.attempted = true
            try {
                const message = {
                    to: contact.linked_user.expo_push_token,
                    sound: 'default',
                    title: '👥 Contact Request',
                    body: 'Someone wants to add you as a trusted contact.',
                    data: { type: 'CONTACT_REQUEST', contactId: contact.id },
                };

                const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(message),
                });

                if (!pushRes.ok) {
                    const errorText = await pushRes.text()
                    throw new Error(`Expo push failed: ${errorText}`)
                }

                const pushData = await pushRes.json()
                if (pushData.data?.[0]?.status === 'error') {
                    throw new Error(`Expo push error: ${pushData.data[0].message}`)
                }

                results.push.success = true
                console.log('✅ Push notification sent successfully')
            } catch (error: any) {
                results.push.error = error.message
                console.error('❌ Push notification failed:', error.message)
            }
        }

        // 2. Fallback to Email (if channel is EMAIL or push failed)
        if (contact.channel === 'EMAIL' && (!results.push.success || !contact.linked_user)) {
            results.email.attempted = true
            try {
                const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
                if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured')

                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${RESEND_API_KEY}`
                    },
                    body: JSON.stringify({
                        from: 'ImFine <noreply@imfein.com>',
                        to: contact.destination,
                        subject: 'You have been invited to ImFine',
                        html: `<p>You have been invited to be a trusted contact. <br> <a href="https://fineapp.vercel.app/invite/${contact.id}">Click here to accept</a></p>`
                    })
                })

                if (!res.ok) {
                    const err = await res.text()
                    throw new Error(`Resend API failed: ${err}`)
                }

                results.email.success = true
                console.log('✅ Email sent successfully')
            } catch (error: any) {
                results.email.error = error.message
                console.error('❌ Email failed:', error.message)
            }
        }

        // 3. Fallback to SMS (if channel is SMS and email failed/not attempted)
        if (contact.channel === 'SMS' && (!results.email.success && !results.push.success)) {
            results.sms.attempted = true
            try {
                const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
                const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
                const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

                if (!accountSid || !authToken || !fromNumber) {
                    throw new Error('Twilio credentials not configured')
                }

                const body = new URLSearchParams({
                    To: contact.destination,
                    From: fromNumber,
                    Body: `You have been invited to ImFine: https://fineapp.vercel.app/invite/${contact.id}`
                });

                const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: body
                })

                if (!res.ok) {
                    const err = await res.text()
                    throw new Error(`Twilio API failed: ${err}`)
                }

                results.sms.success = true
                console.log('✅ SMS sent successfully')
            } catch (error: any) {
                results.sms.error = error.message
                console.error('❌ SMS failed:', error.message)
            }
        }

        // Check if at least one method succeeded
        const anySuccess = results.push.success || results.email.success || results.sms.success

        if (!anySuccess) {
            // All methods failed - return detailed error
            const errorDetails = {
                push: results.push.attempted ? results.push.error : 'not attempted',
                email: results.email.attempted ? results.email.error : 'not attempted',
                sms: results.sms.attempted ? results.sms.error : 'not attempted',
            }
            throw new Error(`All notification methods failed: ${JSON.stringify(errorDetails)}`)
        }

        // Update status to PENDING
        await adminClient
            .from('contacts')
            .update({ status: 'PENDING', invite_sent_at: new Date().toISOString() })
            .eq('id', contact_id)

        return new Response(
            JSON.stringify({
                success: true,
                results: results,
                message: anySuccess ? 'Invite sent successfully' : 'All methods failed'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Edge function error:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
