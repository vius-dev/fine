import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Call the RPC to transition states
        const { data: transitionedUsers, error: rpcError } = await supabaseAdmin
            .rpc('monitor_checkins')

        if (rpcError) throw rpcError

        if (transitionedUsers && transitionedUsers.length > 0) {
            console.log(`Transitioned ${transitionedUsers.length} users.`)

            for (const transitionedUser of transitionedUsers) {
                // Here we would trigger notifications based on the state
                // if (transitionedUser.state === 'GRACE') { sendReminder(transitionedUser.id) }
                // if (transitionedUser.state === 'ESCALATED') { sendEscalation(transitionedUser.id) }
                console.log(`User ${transitionedUser.id} moved to ${transitionedUser.state}`)
            }
        }

        return new Response(JSON.stringify({ success: true, count: transitionedUsers?.length ?? 0 }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
