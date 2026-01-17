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
        // Service Role Key required to fetch all users and update statuses
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get overdue users via RPC
        const { data: overdueUsers, error: rpcError } = await supabaseClient
            .rpc('get_overdue_users')

        if (rpcError) {
            console.error('RPC Error:', rpcError)
            throw rpcError
        }

        if (!overdueUsers || overdueUsers.length === 0) {
            console.log('No overdue users found.')
            return new Response(JSON.stringify({ message: 'No overdue users found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        console.log(`Found ${overdueUsers.length} overdue users. Processing...`)
        const results = []

        // 2. Process each user
        for (const user of overdueUsers) {
            console.log(`Escalating user: ${user.id} (${user.email})`)

            // A. Update Status to ESCALATED
            const { error: updateError } = await supabaseClient
                .from('users')
                .update({ state: 'ESCALATED' })
                .eq('id', user.id)

            if (updateError) {
                console.error(`Failed to escalate user ${user.id}:`, updateError)
                results.push({ userId: user.id, status: 'failed_update', error: updateError })
                continue
            }

            // B. Dispatch Notifications (User + Guardians)
            // Call the existing dispatch-notifications function
            const functionsUrl = Deno.env.get('SUPABASE_URL')?.replace('.co', '.co/functions/v1') ?? ''
            const dispatchUrl = `${functionsUrl}/dispatch-notifications`

            try {
                const response = await fetch(dispatchUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                    },
                    body: JSON.stringify({
                        user_id: user.id,
                        type: 'ESCALATION'
                    })
                })

                if (!response.ok) {
                    const text = await response.text()
                    console.error(`Failed to dispatch notifications for ${user.id}:`, text)
                    results.push({ userId: user.id, status: 'failed_dispatch', error: text })
                } else {
                    results.push({ userId: user.id, status: 'escalated_and_notified' })
                }
            } catch (err) {
                console.error(`Error calling dispatch for ${user.id}:`, err)
                results.push({ userId: user.id, status: 'error_dispatch', error: err })
            }
        }

        return new Response(JSON.stringify({ message: 'Processing complete', results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
