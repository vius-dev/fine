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
        // ------------------------------------------------------------------
        // Auth header validation
        // ------------------------------------------------------------------
        const authHeader =
            req.headers.get('authorization') ??
            req.headers.get('Authorization')

        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!authHeader.startsWith('Bearer ')) {
            return new Response(
                JSON.stringify({ error: 'Authorization must be Bearer token' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ------------------------------------------------------------------
        // Env validation
        // ------------------------------------------------------------------
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Missing Supabase environment variables')
        }

        // ------------------------------------------------------------------
        // Admin client (service role)
        // ------------------------------------------------------------------
        const adminClient = createClient(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY
        )

        // ------------------------------------------------------------------
        // Verify user with admin client
        // ------------------------------------------------------------------
        const token = authHeader.replace('Bearer ', '')
        const {
            data: { user },
            error: authError,
        } = await adminClient.auth.getUser(token)

        if (authError || !user) {
            console.error('Auth error:', authError)
            return new Response(
                JSON.stringify({ error: 'Unauthorized: Invalid token' }),
                {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        console.log('Authenticated user:', user.email)

        // ------------------------------------------------------------------
        // Fetch internal user profile
        // ------------------------------------------------------------------
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

        // ------------------------------------------------------------------
        // Pending invites (email OR phone)
        // ------------------------------------------------------------------
        const destinations: string[] = []
        if (user.email) destinations.push(user.email.toLowerCase())
        if (user.phone) destinations.push(user.phone)

        let pending: any[] = []

        if (destinations.length > 0) {
            const orString = destinations
                .map((v) => `destination.eq.${v}`)
                .join(',')

            console.log('Fetching pending invites with OR string:', orString)

            const { data, error } = await adminClient
                .from('contacts')
                .select('*')
                .eq('status', 'PENDING')
                .or(orString)

            if (error) {
                console.error('Pending query error:', error)
                throw error
            }

            console.log('Pending invites found:', data?.length || 0)
            pending = data ?? []
        }

        // ------------------------------------------------------------------
        // Active links (confirmed) - use internal user ID
        // ------------------------------------------------------------------
        console.log('Fetching active links for internal user ID:', userProfile.id)

        const { data: active, error: activeError } = await adminClient
            .from('contacts')
            .select(`
        *,
        linked_user:users!linked_user_id (
          id,
          email,
          avatar_url
        )
      `)
            .eq('linked_user_id', userProfile.id)
            .eq('status', 'CONFIRMED')

        if (activeError) {
            console.error('Active query error:', activeError)
            throw activeError
        }

        console.log('Active links found:', active?.length || 0)

        // ------------------------------------------------------------------
        // Success response
        // ------------------------------------------------------------------
        return new Response(
            JSON.stringify({
                pending,
                active: active ?? [],
            }),
            {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                },
            }
        )
    } catch (error) {
        console.error('Edge Function error:', error)

        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})
