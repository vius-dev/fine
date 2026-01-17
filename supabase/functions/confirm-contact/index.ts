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
        // --- AUTH HEADER VALIDATION ---
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

        if (authError || !user) {
            console.error('Auth error:', authError)
            return new Response(
                JSON.stringify({ error: 'Unauthorized: Invalid token' }),
                { status: 401, headers: corsHeaders }
            )
        }

        console.log('Authenticated user:', user.email)

        const { contact_id, action = 'confirm' } = await req.json()
        if (!contact_id) throw new Error('Contact ID is required')

        // Fetch contact details
        const { data: contact, error: contactError } = await adminClient
            .from('contacts')
            .select('*')
            .eq('id', contact_id)
            .single()

        if (contactError || !contact) throw new Error('Contact request not found')

        // Fetch internal user profile for the authenticated user
        const { data: userProfile, error: profileError } = await adminClient
            .from('users')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (profileError || !userProfile) {
            console.error('User profile not found for auth_user_id:', user.id)
            throw new Error('User profile not found')
        }

        console.log('Internal user ID:', userProfile.id)

        // Verify Identity
        // - MATCH: The authenticated user's email or phone MUST match the contact's destination
        // - OR LINKED: The authenticated user IS the linked_user_id (for unlinking)
        const userEmail = user.email
        const userPhone = user.phone
        const destination = contact.destination

        const isMatch = (userEmail && userEmail.toLowerCase() === destination.toLowerCase()) ||
            (userPhone && userPhone === destination);

        const isLinked = contact.linked_user_id === userProfile.id;

        // Allow linking if the contact was created nicely, but mainly security check:
        if (!isMatch && !isLinked) {
            throw new Error('You are logged in with an account that does not match this invite.')
        }

        // Handle Actions
        if (action === 'confirm') {
            if (contact.status === 'CONFIRMED') {
                return new Response(JSON.stringify({ message: 'Already confirmed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            // Confirm logic - use internal user ID
            const { error: updateError } = await adminClient
                .from('contacts')
                .update({
                    status: 'CONFIRMED',
                    linked_user_id: userProfile.id
                })
                .eq('id', contact_id)
            if (updateError) {
                console.error('Update error:', updateError)
                throw updateError
            }

        } else if (action === 'reject' || action === 'unlink') {
            const { error: deleteError } = await adminClient
                .from('contacts')
                .delete()
                .eq('id', contact_id)
            if (deleteError) {
                console.error('Delete error:', deleteError)
                throw deleteError
            }

        } else {
            throw new Error('Invalid action')
        }

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Edge function error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
