import { calculateNextCheckInTime, scheduleCheckInReminder } from '../utils/scheduleCheckInReminder';
import { supabase } from './supabase';

export const api = {
    checkIn: async () => {
        // Try to call the edge function first
        const { data, error } = await supabase.functions.invoke('checkin');

        // Fallback to direct DB update if function is not available (local dev)
        if (error) {
            console.warn('Edge function failed, falling back to direct DB update:', error);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data: profile, error: profileError } = await supabase
                .from('users')
                .update({
                    last_fine_at: new Date().toISOString(),
                    state: 'ACTIVE',
                    updated_at: new Date().toISOString()
                })
                .eq('auth_user_id', user.id)
                .select()
                .single();

            if (profileError) throw profileError;

            // Log the event manually
            await supabase
                .from('user_state_events')
                .insert({
                    user_id: profile.id,
                    to_state: 'ACTIVE',
                    reason: 'Manual check-in (fallback)'
                });

            return { data: profile, error: null };
        }

        // Schedule next check-in reminder after successful check-in
        if (data) {
            try {
                // Fetch user profile to get reminder settings
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: userProfile } = await supabase
                        .from('users')
                        .select('checkin_interval_hours, reminder_enabled, reminder_offset_hours')
                        .eq('auth_user_id', user.id)
                        .single();

                    if (userProfile?.reminder_enabled) {
                        const nextCheckInTime = calculateNextCheckInTime(
                            new Date(),
                            userProfile.checkin_interval_hours
                        );
                        await scheduleCheckInReminder(
                            nextCheckInTime,
                            userProfile.reminder_offset_hours || 0
                        );
                    }
                }
            } catch (reminderError) {
                // Don't fail check-in if reminder scheduling fails
                console.error('Failed to schedule reminder:', reminderError);
            }
        }

        return { data, error: null };
    },

    updateProfile: async (updates: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        return supabase
            .from('users')
            .update(updates)
            .eq('auth_user_id', user.id);
    },

    getContacts: async () => {
        return supabase
            .from('contacts')
            .select(`
                *,
                linked_user:linked_user_id (
                    id,
                    email
                )
            `)
            .order('created_at', { ascending: false });
    },

    addContact: async (contact: { name: string, destination: string, channel: string }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', user.id)
            .single();

        if (!profile) throw new Error('Profile not found');

        const { data, error } = await supabase
            .from('contacts')
            .insert({
                ...contact,
                user_id: profile.id
            })
            .select();

        // Check for contact limit error
        if (error) {
            if (error.message.includes('maximum limit')) {
                throw new Error('This contact has been added by too many users. Please choose someone else who can reliably help you.');
            }
            throw error;
        }

        return { data, error: null };
    },

    updateContact: async (contactId: string, updates: { name?: string, destination?: string, channel?: string }) => {
        return supabase
            .from('contacts')
            .update(updates)
            .eq('id', contactId);
    },

    deleteContact: async (contactId: string) => {
        return supabase
            .from('contacts')
            .delete()
            .eq('id', contactId);
    },

    resolveAlert: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', user.id)
            .single();

        if (!profile) throw new Error('Profile not found');

        // 1. Update user state to ACTIVE
        const { error: updateError } = await supabase
            .from('users')
            .update({
                state: 'ACTIVE',
                last_fine_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', profile.id);

        if (updateError) throw updateError;

        // 2. Log event
        await supabase
            .from('user_state_events')
            .insert({
                user_id: profile.id,
                to_state: 'ACTIVE',
                reason: 'User resolved escalation (I AM SAFE)'
            });

        // 3. Notify contacts that user is safe
        // Use the same dispatch function but with COMPLETED type
        // Note: dispatch-notifications now supports 'type' parameter
        await supabase.functions.invoke('dispatch-notifications', {
            body: {
                user_id: profile.id,
                type: 'RESOLUTION_ALERT'
            }
        });

        return { error: null };
    },

    inviteContact: async (contactId: string) => {
        const { error } = await supabase.functions.invoke('invite-contact', {
            body: { contact_id: contactId }
        });
        return { error };
    },

    confirmContactRequest: async (contactRecordId: string) => {
        const { data, error } = await supabase.functions.invoke('confirm-contact', {
            body: { contact_id: contactRecordId }
        });
        return { data, error };
    },

    sendTestAlert: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', user.id)
            .single();

        if (!profile) throw new Error('Profile not found');

        const { error } = await supabase.functions.invoke('dispatch-notifications', {
            body: {
                user_id: profile.id,
                type: 'TEST_ALERT'
            }
        });
        return { error };
    },

    getNotificationHistory: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', user.id)
            .single();

        if (!profile) throw new Error('Profile not found');

        // Fetch deliveries with event details
        return supabase
            .from('notification_deliveries')
            .select(`
                id,
                channel,
                destination,
                delivered_at,
                error,
                created_at,
                event:notification_events!inner(
                    id,
                    type,
                    created_at,
                    user_id
                )
            `)
            .eq('event.user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(100);
    }
};
