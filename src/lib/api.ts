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

            // Get current profile to check state
            const { data: currentProfile } = await supabase
                .from('users')
                .select('state, first_checkin_completed')
                .eq('auth_user_id', user.id)
                .single();

            const isFirstCheckIn = currentProfile?.state === 'ONBOARDING' || !currentProfile?.first_checkin_completed;

            const { data: profile, error: profileError } = await supabase
                .from('users')
                .update({
                    last_fine_at: new Date().toISOString(),
                    state: 'ACTIVE',
                    first_checkin_completed: true,  // Mark first check-in as complete
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
                    reason: isFirstCheckIn ? 'First check-in completed (fallback)' : 'Manual check-in (fallback)'
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
                    email,
                    avatar_url
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
        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.error('No active session when trying to invite contact');
            return { error: new Error('Not authenticated. Please log in again.') };
        }



        // Explicitly pass the Authorization header
        const { data, error } = await supabase.functions.invoke('invite-contact', {
            body: { contact_id: contactId },
            headers: {
                Authorization: `Bearer ${session.access_token}`
            }
        });

        // Check for network/invocation errors
        if (error) {
            console.error('Invite contact error:', error);

            // Check if it's a FunctionsHttpError by checking properties
            const errorContext = (error as any).context;
            if (errorContext && typeof errorContext.json === 'function') {
                try {
                    const errorMessage = await errorContext.json();

                    return { error: new Error(errorMessage.error || JSON.stringify(errorMessage)) };
                } catch (e) {
                    console.error('Failed to parse error context JSON', e);
                }
            }

            const errorMessage = error.message || 'Edge Function returned a non-2xx status code';
            return { error: new Error(errorMessage) };
        }

        // Check if the edge function returned an error in the response data
        if (data?.error) {
            console.error('Invite contact function error:', data.error);
            return { error: new Error(data.error) };
        }


        return { error: null };
    },

    confirmContactRequest: async (contactRecordId: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { error: new Error('Not authenticated') };

        const { data, error } = await supabase.functions.invoke('confirm-contact', {
            body: { contact_id: contactRecordId },
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (error) {
            console.error('Confirm contact error:', error);
            const errorContext = (error as any).context;
            if (errorContext && typeof errorContext.json === 'function') {
                try {
                    const errorMessage = await errorContext.json();

                    return { error: new Error(errorMessage.error || JSON.stringify(errorMessage)) };
                } catch (e) { /* ignore */ }
            }
            return { error };
        }

        return { data, error };
    },

    getTrustedLinks: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { data: null, error: new Error('Not authenticated') };

        const { data, error } = await supabase.functions.invoke('get-trusted-links', {
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (error) {
            console.error('Get trusted links error:', error);
            const errorContext = (error as any).context;
            if (errorContext && typeof errorContext.json === 'function') {
                try {
                    const errorMessage = await errorContext.json();

                    return { data: null, error: new Error(errorMessage.error || JSON.stringify(errorMessage)) };
                } catch (e) { /* ignore */ }
            }
            return { data: null, error };
        }

        return { data: data || { pending: [], active: [] }, error: null };
    },

    declineContactRequest: async (contactId: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { error: new Error('Not authenticated') };

        const { data, error } = await supabase.functions.invoke('confirm-contact', {
            body: { contact_id: contactId, action: 'reject' },
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (error) {
            console.error('Decline contact error:', error);
            const errorContext = (error as any).context;
            if (errorContext && typeof errorContext.json === 'function') {
                try {
                    const errorMessage = await errorContext.json();

                    return { error: new Error(errorMessage.error || JSON.stringify(errorMessage)) };
                } catch (e) { /* ignore */ }
            }
            return { error };
        }

        return { data, error: null };
    },

    unlinkContact: async (contactId: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { error: new Error('Not authenticated') };

        const { data, error } = await supabase.functions.invoke('confirm-contact', {
            body: { contact_id: contactId, action: 'unlink' },
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (error) {
            console.error('Unlink contact error:', error);
            const errorContext = (error as any).context;
            if (errorContext && typeof errorContext.json === 'function') {
                try {
                    const errorMessage = await errorContext.json();

                    return { error: new Error(errorMessage.error || JSON.stringify(errorMessage)) };
                } catch (e) { /* ignore */ }
            }
            return { error };
        }

        return { data, error: null };
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
    },

    uploadAvatar: async (imageUri: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Get user profile to get internal ID
        const { data: profile } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', user.id)
            .single();

        if (!profile) throw new Error('Profile not found');

        // Import image manipulator
        const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');

        // Compress and resize image
        let quality = 0.8;
        let manipResult = await manipulateAsync(
            imageUri,
            [{ resize: { width: 500, height: 500 } }],
            { compress: quality, format: SaveFormat.JPEG }
        );

        // Read file as base64 using expo-file-system
        // Note: Using standard import. Warning about legacy API is non-blocking.
        // Conditional import of 'expo-file-system/legacy' causes bundler issues.
        const FileSystem = await import('expo-file-system');
        const { getInfoAsync, readAsStringAsync } = FileSystem;
        const { decode } = await import('base64-arraybuffer');

        // Check size (approximate from file info) or read first
        const fileInfo = await getInfoAsync(manipResult.uri);
        if (!fileInfo.exists) throw new Error('File does not exist');

        let currentUri = manipResult.uri;
        // @ts-ignore: TS not narrowing correctly
        let fileSize = fileInfo.size as number;

        while (fileSize > 1024 * 1024 && quality > 0.1) {

            quality -= 0.2;
            const nextResult = await manipulateAsync(
                imageUri,
                [{ resize: { width: 500, height: 500 } }],
                { compress: quality, format: SaveFormat.JPEG }
            );
            const nextInfo = await getInfoAsync(nextResult.uri);
            if (!nextInfo.exists) throw new Error('Compression failed');
            currentUri = nextResult.uri;
            fileSize = nextInfo.size;
        }

        if (fileSize > 1024 * 1024) {
            throw new Error('Image cannot be compressed under 1MB. Please use a simpler image.');
        }

        // Read final file as base64
        // Use string 'base64' directly to avoid type access issues on dynamic import
        const base64 = await readAsStringAsync(currentUri, { encoding: 'base64' });
        const arrayBuffer = decode(base64);

        // Upload to storage
        const fileName = `${profile.id}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, arrayBuffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        // Update profile
        const { error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', profile.id);

        if (updateError) throw updateError;

        return { data: publicUrl, error: null };
    },

    deleteAvatar: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Get user profile
        const { data: profile } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', user.id)
            .single();

        if (!profile) throw new Error('Profile not found');

        // Delete from storage
        const fileName = `${profile.id}/avatar.jpg`;
        await supabase.storage.from('avatars').remove([fileName]);

        // Clear avatar_url in profile
        const { error } = await supabase
            .from('users')
            .update({ avatar_url: null })
            .eq('id', profile.id);

        if (error) throw error;

        return { error: null };
    }
};
