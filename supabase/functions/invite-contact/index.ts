import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // --- AUTH HEADER VALIDATION (FIXES 401) ---
        const authHeader =
            req.headers.get('authorization') ??
            req.headers.get('Authorization')

        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: corsHeaders }
            )
        }

        if (!authHeader.startsWith('Bearer ')) {
            return new Response(
                JSON.stringify({ error: 'Authorization must be Bearer token' }),
                { status: 401, headers: corsHeaders }
            )
        }

        console.log('Authorization header OK')

        // --- ADMIN CLIENT ---
        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // --- VERIFY USER WITH ADMIN CLIENT ---
        const token = authHeader.replace('Bearer ', '')
        const {
            data: { user },
            error: authError,
        } = await adminClient.auth.getUser(token)

        if (authError) {
            console.error('Auth error:', authError)
            throw new Error(`Unauthorized: ${authError.message}`)
        }

        if (!user) {
            throw new Error('Unauthorized: No user found')
        }

        console.log('Authenticated user:', user.email)

        // --- REQUEST BODY ---
        const { contact_id } = await req.json()
        if (!contact_id) throw new Error('Contact ID is required')

        // --- GET INTERNAL USER PROFILE ---
        const { data: userProfile, error: profileError } = await adminClient
            .from('users')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (profileError || !userProfile) {
            throw new Error('User profile not found')
        }

        // --- FETCH CONTACT ---
        const { data: contact, error: contactError } = await adminClient
            .from('contacts')
            .select(`
        *,
        linked_user:linked_user_id (id, email, expo_push_token)
      `)
            .eq('id', contact_id)
            .single()

        if (contactError || !contact) {
            throw new Error('Contact not found')
        }

        if (contact.user_id !== userProfile.id) {
            throw new Error('Unauthorized access to contact')
        }

        // --- NOTIFICATION STRATEGY ---
        const results = {
            push: { attempted: false, success: false, error: null as string | null },
            email: { attempted: false, success: false, error: null as string | null },
            sms: { attempted: false, success: false, error: null as string | null },
        }

        // 1. PUSH
        if (contact.linked_user?.expo_push_token) {
            results.push.attempted = true
            try {
                const message = {
                    to: contact.linked_user.expo_push_token,
                    sound: 'default',
                    title: '👥 Contact Request',
                    body: 'Someone wants to add you as a trusted contact.',
                    data: { type: 'CONTACT_REQUEST', contactId: contact.id },
                }

                const pushRes = await fetch(
                    'https://exp.host/--/api/v2/push/send',
                    {
                        method: 'POST',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(message),
                    }
                )

                if (!pushRes.ok) {
                    throw new Error(await pushRes.text())
                }

                const pushData = await pushRes.json()
                if (pushData.data?.[0]?.status === 'error') {
                    throw new Error(pushData.data[0].message)
                }

                results.push.success = true
            } catch (error: any) {
                results.push.error = error.message
            }
        }

        // 2. EMAIL
        if (
            contact.channel === 'EMAIL' &&
            (!results.push.success || !contact.linked_user)
        ) {
            results.email.attempted = true
            try {
                const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
                if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY missing')

                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${RESEND_API_KEY}`,
                    },
                    body: JSON.stringify({
                        from: 'ImFine <noreply@imfein.com>',
                        to: contact.destination,
                        subject: 'You have been invited to ImFine',
                        html: `<p>You have been invited to be a trusted contact.<br/>
                   <a href="https://fineapp.vercel.app/invite/${contact.id}">
                   Click here to accept</a></p>`,
                    }),
                })

                if (!res.ok) {
                    throw new Error(await res.text())
                }

                results.email.success = true
            } catch (error: any) {
                results.email.error = error.message
            }
        }

        // 3. SMS
        if (
            contact.channel === 'SMS' &&
            !results.push.success &&
            !results.email.success
        ) {
            results.sms.attempted = true
            try {
                const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
                const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
                const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

                if (!accountSid || !authToken || !fromNumber) {
                    throw new Error('Twilio credentials missing')
                }

                const body = new URLSearchParams({
                    To: contact.destination,
                    From: fromNumber,
                    Body: `You have been invited to ImFine: https://fineapp.vercel.app/invite/${contact.id}`,
                })

                const res = await fetch(
                    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body,
                    }
                )

                if (!res.ok) {
                    throw new Error(await res.text())
                }

                results.sms.success = true
            } catch (error: any) {
                results.sms.error = error.message
            }
        }

        if (!results.push.success && !results.email.success && !results.sms.success) {
            console.error('Notification failures:', results)
            throw new Error(`All notification methods failed. Details: ${JSON.stringify(results)}`)
        }

        // --- UPDATE STATUS ---
        await adminClient
            .from('contacts')
            .update({
                status: 'PENDING',
                invite_sent_at: new Date().toISOString(),
            })
            .eq('id', contact_id)

        return new Response(
            JSON.stringify({
                success: true,
                results,
                message: 'Invite sent successfully',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error: any) {
        console.error('Edge function error:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})
