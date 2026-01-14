/// <reference path="./deno.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resend } from "https://esm.sh/resend@1.0.0";
import Twilio from "https://esm.sh/twilio@3.84.0";


const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Create Supabase Client
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 2. Parse Request Body (Expect { user_id: string })
        const { user_id } = await req.json();

        if (!user_id) {
            throw new Error("Missing user_id");
        }

        // 3. Fetch User & Contacts (with linked user data)
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('email, id')
            .eq('id', user_id)
            .single();

        if (userError || !user) throw new Error("User not found");

        // Fetch contacts with linked user information
        const { data: contacts, error: contactsError } = await supabase
            .from('contacts')
            .select(`
                *,
                linked_user:linked_user_id (
                    id,
                    email,
                    expo_push_token
                )
            `)
            .eq('user_id', user_id)
            .eq('status', 'CONFIRMED'); // Only notify confirmed contacts

        if (contactsError) throw new Error("Failed to fetch contacts");

        if (!contacts || contacts.length === 0) {
            console.log(`No confirmed contacts for user ${user_id}`);
            return new Response(JSON.stringify({ message: "No contacts to notify" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        const resend = resendApiKey ? new Resend(resendApiKey) : null;

        const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const twilioFrom = Deno.env.get('TWILIO_PHONE_NUMBER');
        // @ts-ignore
        const twilio = (twilioSid && twilioAuthToken) ? new Twilio(twilioSid, twilioAuthToken) : null;


        // 4. Dispatch Notifications with cooldown protection
        const NOTIFICATION_COOLDOWN_MINUTES = 5;
        const cooldownTimestamp = new Date(Date.now() - NOTIFICATION_COOLDOWN_MINUTES * 60000).toISOString();

        // Determine message content based on type
        const { type = 'ESCALATION_ALERT' } = await req.clone().json(); // Re-parse or use cached body if possible, actually we need to pull it from the destructuring earlier.

        let alertTitle = '🚨 Emergency Alert';
        let alertBody = `${user.email} needs help! They missed their check-in.`;
        let emailSubject = '🚨 URGENT: Emergency Alert';
        let emailHtml = `
            <h1>Emergency Alert</h1>
            <p><strong>${user.email}</strong> has missed a check-in or triggered a panic alert.</p>
            <p>Please contact them immediately.</p>
            <p>Status: <strong>ESCALATED</strong></p>
        `;
        let smsBody = `🚨 URGENT: ${user.email} needs help! Missed check-in. Contact them immediately.`;

        if (type === 'RESOLUTION_ALERT') {
            alertTitle = '✅ User is Safe';
            alertBody = `${user.email} has marked themselves as safe. The emergency is resolved.`;
            emailSubject = '✅ RESOLVED: User is Safe';
            emailHtml = `
                <h1>Emergency Resolved</h1>
                <p><strong>${user.email}</strong> has confirmed they are safe.</p>
                <p>You can stand down.</p>
                <p>Status: <strong>RESOLVED</strong></p>
            `;
            smsBody = `✅ RESOLVED: ${user.email} is safe. The emergency alert has been cancelled.`;
        }

        const results = await Promise.all(contacts.map(async (contact: any) => {
            try {
                // PRIORITY 1: If contact is a linked user with push token, send push notification
                if (contact.linked_user && contact.linked_user.expo_push_token) {
                    const pushToken = contact.linked_user.expo_push_token;

                    // Check if we've already notified this contact recently
                    const { data: recentNotifications } = await supabase
                        .from('notification_deliveries')
                        .select('created_at')
                        .eq('destination', pushToken)
                        .eq('channel', 'PUSH')
                        .gte('created_at', cooldownTimestamp)
                        .limit(1);

                    // Skip cooldown check for RESOLUTION_ALERT to ensure "Safe" message always gets through
                    if (type !== 'RESOLUTION_ALERT' && recentNotifications && recentNotifications.length > 0) {
                        console.log(`Skipping notification to ${contact.destination} - already notified within ${NOTIFICATION_COOLDOWN_MINUTES} minutes`);
                        return {
                            contact: contact.destination,
                            status: 'skipped',
                            reason: `Cooldown active (${NOTIFICATION_COOLDOWN_MINUTES}min)`,
                            linked_user: true
                        };
                    }

                    const message = {
                        to: pushToken,
                        sound: type === 'RESOLUTION_ALERT' ? 'default' : 'default', // Could use a softer sound for resolution
                        title: alertTitle,
                        body: alertBody,
                        data: {
                            type: type,
                            user_id: user.id,
                            user_email: user.email,
                            escalated_at: new Date().toISOString(),
                        },
                        priority: 'high',
                    };

                    // Send to Expo Push Notification service
                    const response = await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(message),
                    });

                    if (response.ok) {
                        // Log successful delivery
                        await supabase.from('notification_deliveries').insert({
                            channel: 'PUSH',
                            destination: pushToken,
                            payload: message,
                            delivered_at: new Date().toISOString(),
                        });

                        return {
                            contact: contact.destination,
                            status: 'sent',
                            channel: 'PUSH',
                            linked_user: true
                        };
                    } else {
                        console.error('Push notification failed:', await response.text());
                        // Fall through to other channels
                    }
                }

                // PRIORITY 2: Email
                if (contact.channel === 'EMAIL' && resend) {
                    await resend.emails.send({
                        from: 'ImFine Alert <alert@imfine.app>', // Update with verify domain
                        to: contact.destination,
                        subject: emailSubject,
                        html: emailHtml
                    });
                    return { contact: contact.destination, status: 'sent', channel: 'EMAIL' };
                }

                // PRIORITY 3: SMS
                if (contact.channel === 'SMS' && twilio && twilioFrom) {
                    await twilio.messages.create({
                        body: smsBody,
                        from: twilioFrom,
                        to: contact.destination
                    });
                    return { contact: contact.destination, status: 'sent', channel: 'SMS' };
                }

                return { contact: contact.destination, status: 'failed', reason: 'No valid channel or provider configured' };

            } catch (e: any) {
                console.error(`Failed to notify ${contact.destination}:`, e);
                return { contact: contact.destination, status: 'error', error: e.message };
            }
        }));

        // 5. Log Delivery (Optional but good practice)
        // await supabase.from('notification_deliveries').insert(...)

        return new Response(JSON.stringify({ results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
});
