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
        const authHeader = req.headers.get('authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!SUPABASE_URL || !SERVICE_KEY) {
            throw new Error('Missing Supabase env vars')
        }

        const admin = createClient(SUPABASE_URL, SERVICE_KEY)

        // Get authenticated user
        const token = authHeader.replace('Bearer ', '')
        const { data, error } = await admin.auth.getUser(token)

        if (error || !data.user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const userId = data.user.id

        // Perform deletion via Auth Admin
        // This will cascade to public.users and dependent tables (contacts, events)
        // thanks to the ON DELETE CASCADE constraints.
        const { error: deleteError } = await admin.auth.admin.deleteUser(userId)

        if (deleteError) {
            console.error('Failed to delete user:', deleteError)
            throw deleteError
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Account deleted' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (err: any) {
        console.error('Account deletion failed:', err)
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
