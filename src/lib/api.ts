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
                console.warn('Failed to schedule reminder:', reminderError);
                // Don't fail the check-in if reminder fails
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
                    full_name,
                    avatar_url
                ),
                owner:user_id (
                    id,
                    email,
                    full_name,
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

    escalate: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('auth_user_id', user.id)
            .single();

        if (!profile) throw new Error('Profile not found');

        // 1. Update user state to ESCALATED
        const { error: updateError } = await supabase
            .from('users')
            .update({
                state: 'ESCALATED',
                updated_at: new Date().toISOString()
            })
            .eq('id', profile.id);

        if (updateError) throw updateError;

        // 2. Log event
        await supabase
            .from('user_state_events')
            .insert({
                user_id: profile.id,
                to_state: 'ESCALATED',
                reason: 'User triggered panic button'
            });

        // 3. Notify contacts (Manually call function since trigger is active/removed)
        await supabase.functions.invoke('dispatch-notifications', {
            body: {
                user_id: profile.id,
                type: 'ESCALATION'
            }
        });

        return { error: null };
    },

    acknowledgeAlert: async (targetUserId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // We are notifying the TARGET (original sender) that WE (current user) have acknowledged
        // The edge function will look up OUR name to tell THEM
        await supabase.functions.invoke('dispatch-notifications', {
            body: {
                user_id: user.id, // I am the one acknowledging
                type: 'ACKNOWLEDGMENT',
                target_user_id: targetUserId // I am notifying YOU
            }
        });

        return { error: null };
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
            console.warn('No active session when trying to invite contact');
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
            console.warn('Invite contact error:', error);

            // Check if it's a FunctionsHttpError by checking properties
            const errorContext = (error as any).context;
            if (errorContext && typeof errorContext.json === 'function') {
                try {
                    const errorMessage = await errorContext.json();

                    return { error: new Error(errorMessage.error || JSON.stringify(errorMessage)) };
                } catch (e) {
                    console.warn('Failed to parse error context JSON', e);
                }
            }

            const errorMessage = error.message || 'Edge Function returned a non-2xx status code';
            return { error: new Error(errorMessage) };
        }

        // Check if the edge function returned an error in the response data
        if (data?.error) {
            console.warn('Invite contact function error:', data.error);
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
            console.warn('Confirm contact error:', error);
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
            console.warn('Get trusted links error:', error);
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
            console.warn('Decline contact error:', error);
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
            console.warn('Unlink contact error:', error);
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

            .order('created_at', { ascending: false })
            .limit(100);
    },

    uploadAvatar: async (imageUri: string) => {
        try {

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error('[AVATAR UPLOAD] Not authenticated');
                throw new Error('Not authenticated');
            }


            // Get user profile to get internal ID
            const { data: profile } = await supabase
                .from('users')
                .select('id')
                .eq('auth_user_id', user.id)
                .single();

            if (!profile) {
                console.error('[AVATAR UPLOAD] Profile not found');
                throw new Error('Profile not found');
            }


            // Import image manipulator
            const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');

            // Compress and resize image
            let quality = 0.8;

            let manipResult = await manipulateAsync(
                imageUri,
                [{ resize: { width: 500, height: 500 } }],
                { compress: quality, format: SaveFormat.JPEG }
            );


            // Import file system - use the actual new File API for SDK 54
            const { decode } = await import('base64-arraybuffer');

            // Use fetch to read the file (works with file:// URIs and doesn't use deprecated APIs)

            let currentUri = manipResult.uri;
            let fileSize: number;

            try {

                const response = await fetch(manipResult.uri);
                const blob = await response.blob();
                fileSize = blob.size;

            } catch (error) {
                console.error('[AVATAR UPLOAD] Error reading file:', error);
                console.error('[AVATAR UPLOAD] Error type:', typeof error);
                console.error('[AVATAR UPLOAD] Error name:', (error as any)?.name);
                console.error('[AVATAR UPLOAD] Error message:', (error as any)?.message);
                console.error('[AVATAR UPLOAD] Error stack:', (error as any)?.stack);
                console.error('[AVATAR UPLOAD] Full error object:', error);
                throw error;
            }

            // Iterative compression if needed
            let compressionAttempts = 0;

            while (fileSize > 1024 * 1024 && quality > 0.1) {
                compressionAttempts++;
                quality -= 0.2;
                quality -= 0.2;

                try {
                    const nextResult = await manipulateAsync(
                        imageUri,
                        [{ resize: { width: 500, height: 500 } }],
                        { compress: quality, format: SaveFormat.JPEG }
                    );



                    const nextResponse = await fetch(nextResult.uri);
                    const nextBlob = await nextResponse.blob();
                    const nextFileSize = nextBlob.size;


                    currentUri = nextResult.uri;
                    fileSize = nextFileSize;

                } catch (compressionError) {
                    console.error('[AVATAR UPLOAD]   - ❌ Compression error:', compressionError);
                    throw compressionError;
                }
            }



            if (fileSize > 1024 * 1024) {
                console.error('[AVATAR UPLOAD] Image cannot be compressed under 1MB. Final size:', (fileSize / 1024 / 1024).toFixed(2), 'MB');
                throw new Error('Image cannot be compressed under 1MB. Please use a simpler image.');
            }



            // Read final file and convert to base64

            let base64: string;
            try {
                const finalResponse = await fetch(currentUri);
                const finalBlob = await finalResponse.blob();

                // Convert blob to base64 using FileReader
                base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const result = reader.result as string;
                        // Remove data URL prefix (data:image/jpeg;base64,)
                        const base64Data = result.split(',')[1];
                        resolve(base64Data);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(finalBlob);
                });

            } catch (base64Error) {
                console.error('[AVATAR UPLOAD]   - ❌ Failed to read file as base64:', base64Error);
                console.error('[AVATAR UPLOAD]   - Error details:', base64Error);
                throw base64Error;
            }


            let arrayBuffer: ArrayBuffer;
            try {
                arrayBuffer = decode(base64);
            } catch (decodeError) {
                console.error('[AVATAR UPLOAD]   - ❌ Failed to decode base64:', decodeError);
                throw decodeError;
            }

            // Upload to storage
            // IMPORTANT: Use auth user ID (user.id) not profile ID for RLS policy to work
            const fileName = `${user.id}/avatar.jpg`;


            try {
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, arrayBuffer, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (uploadError) {
                    console.error('[AVATAR UPLOAD]   - ❌ Storage upload error:', uploadError);
                    console.error('[AVATAR UPLOAD]   - Error code:', (uploadError as any)?.statusCode);
                    console.error('[AVATAR UPLOAD]   - Error message:', uploadError.message);
                    throw uploadError;
                }


            } catch (uploadError) {
                console.error('[AVATAR UPLOAD]   - ❌ Upload exception:', uploadError);
                throw uploadError;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            // Update profile

            try {
                const { data: updateData, error: updateError } = await supabase
                    .from('users')
                    .update({ avatar_url: `${publicUrl}?t=${new Date().getTime()}` })
                    .eq('id', profile.id)
                    .select();

                if (updateError) {
                    console.error('[AVATAR UPLOAD]   - ❌ Profile update error:', updateError);
                    console.error('[AVATAR UPLOAD]   - Error code:', (updateError as any)?.code);
                    console.error('[AVATAR UPLOAD]   - Error message:', updateError.message);
                    throw updateError;
                }

                return { data: publicUrl, error: null };
            } catch (updateError) {
                console.error('[AVATAR UPLOAD]   - ❌ Profile update exception:', updateError);
                throw updateError;
            }

        } catch (error: any) {
            console.error('[AVATAR UPLOAD]   - ❌ Unexpected error:', error);
            return { data: null, error };
        }
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
        // IMPORTANT: Use auth user ID (user.id) not profile ID to match upload path
        const fileName = `${user.id}/avatar.jpg`;
        await supabase.storage.from('avatars').remove([fileName]);

        // Clear avatar_url in profile
        const { error } = await supabase
            .from('users')
            .update({ avatar_url: null })
            .eq('id', profile.id);

        if (error) throw error;

        return { error: null };
    },
    deleteAccount: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { error: new Error('Not authenticated') };

        const { data, error } = await supabase.functions.invoke('delete-account', {
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (error) {
            console.warn('Delete account error:', error);
            const errorContext = (error as any).context;
            if (errorContext && typeof errorContext.json === 'function') {
                try {
                    const errorMessage = await errorContext.json();
                    return { error: new Error(errorMessage.error || JSON.stringify(errorMessage)) };
                } catch (e) {
                    console.warn('Failed to parse error context JSON', e);
                }
            }
            return { error };
        }

        return { data, error: null };
    }
};
