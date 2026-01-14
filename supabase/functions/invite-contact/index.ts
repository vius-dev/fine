import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Get current user from Auth header (Security)
        const authHeader = req.headers.get('Authorization')!;
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const { contact_id } = await req.json();
        if (!contact_id) throw new Error("Missing contact_id");

        // 2. Fetch Contact & User Profile
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select(`
                *,
                linked_user:linked_user_id (
                    id,
                    email,
                    expo_push_token
                )
            `)
            .eq('id', contact_id)
            .eq('user_id', user.id) // Ensure ownership
            .single();

        if (contactError || !contact) throw new Error("Contact not found");

        const { data: userProfile } = await supabase
            .from('users')
            .select('email') // Get requester's email/name
            .eq('id', user.id)
            .single();

        // 3. Logic: Linked vs Non-Linked
        if (contact.linked_user && contact.linked_user.expo_push_token) {
            // Case A: Linked User - Send Push
            const pushToken = contact.linked_user.expo_push_token;

            const message = {
                to: pushToken,
                sound: 'default',
                title: '👥 Contact Request',
                body: `${userProfile?.email} wants to add you as a trusted contact.`,
                data: {
                    type: 'CONTACT_REQUEST',
                    requester_id: user.id,
                    requester_email: userProfile?.email,
                    contact_record_id: contact.id // Valid for the requester's record, but strictly we need the reciprocal or just the knowledge
                },
            };

            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
            });

            // Update status (optional, if we want to track 'INVITED' vs 'PENDING')
            await supabase
                .from('contacts')
                .update({ status: 'PENDING' })
                .eq('id', contact_id);

            return new Response(JSON.stringify({
                success: true,
                method: 'PUSH',
                message: 'In-app request sent'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } else {
            // Case B: Non-Linked - Send Email/SMS Link
            // TODO: generate token and send link
            console.log(`[Mock] Sending invite link to ${contact.destination}`);

            await supabase
                .from('contacts')
                .update({ status: 'PENDING' })
                .eq('id', contact_id);

            return new Response(JSON.stringify({
                success: true,
                method: 'EXTERNAL',
                message: 'Invite link sent (Simulated)'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
});
