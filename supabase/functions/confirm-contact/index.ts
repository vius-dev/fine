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
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // 1. Get Authenticated User (The 'Friend' accepting the invite)
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        const { contact_id } = await req.json()
        if (!contact_id) throw new Error('Contact ID is required')

        // 2. Use Admin Client to fetch contact and perform update (bypass RLS which might hide contact from non-owner)
        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 3. Fetch contact details
        const { data: contact, error: contactError } = await adminClient
            .from('contacts')
            .select('*')
            .eq('id', contact_id)
            .single()

        if (contactError || !contact) throw new Error('Contact request not found')

        if (contact.status === 'CONFIRMED') {
            return new Response(JSON.stringify({ message: 'Already confirmed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 4. Verify Identity
        // The authenticated user's email or phone MUST match the contact's destination
        const userEmail = user.email
        const userPhone = user.phone
        const destination = contact.destination

        const isMatch = (userEmail && userEmail.toLowerCase() === destination.toLowerCase()) ||
            (userPhone && userPhone === destination)

        // Allow linking if the contact was created nicely, but mainly security check:
        if (!isMatch) {
            // Optional: Allow "token" based bypass if we implemented tokens and passed one?
            // For now, strict identity match.
            throw new Error('You are logged in with an account that does not match this invite.')
        }

        // 5. Update Contact
        const { error: updateError } = await adminClient
            .from('contacts')
            .update({
                status: 'CONFIRMED',
                linked_user_id: user.id
            })
            .eq('id', contact_id)

        if (updateError) throw updateError

        return new Response(
            JSON.stringify({ success: true }),
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
