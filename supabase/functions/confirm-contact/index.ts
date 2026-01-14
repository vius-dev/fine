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
        // Create client with Service Role to bypass RLS (since we're updating another user's record)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Create normal client for auth check
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        // 1. Get current user (The one ACCEPTING the request)
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

        if (authError || !user) {
            // TODO: Handle Token-based auth for web link case here (future)
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const { contact_id } = await req.json();
        if (!contact_id) throw new Error("Missing contact_id");

        // 2. Fetch the contact record using Admin client
        const { data: contact, error: fetchError } = await supabaseAdmin
            .from('contacts')
            .select('*')
            .eq('id', contact_id)
            .single();

        if (fetchError || !contact) throw new Error("Contact record not found");

        // 3. Security Check: The caller MUST be the linked_user
        if (contact.linked_user_id !== user.id) {
            return new Response(JSON.stringify({ error: 'Unauthorized: You are not the linked user for this contact.' }), { status: 403, headers: corsHeaders });
        }

        // 4. Update Status to CONFIRMED
        const { error: updateError } = await supabaseAdmin
            .from('contacts')
            .update({ status: 'CONFIRMED' })
            .eq('id', contact_id);

        if (updateError) throw updateError;

        // 5. Notify the Requester (Optional but nice)
        // ... Logic to push notify the requester that their contact accepted ...

        return new Response(JSON.stringify({
            success: true,
            message: 'Contact confirmed successfully'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
});
