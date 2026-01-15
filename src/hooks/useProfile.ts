import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export type UserProfile = {
    id: string;
    auth_user_id: string;
    email: string;
    last_fine_at: string;
    checkin_interval_hours: number;
    grace_period_hours: number;
    state: 'ACTIVE' | 'GRACE' | 'ESCALATED' | 'RESOLVED';
    vacation_mode: boolean;
    ringtone_enabled: boolean;
    ringtone_selection: string;
    ringtone_volume: number;
    reminder_enabled: boolean;
    reminder_offset_hours: number;
    timezone?: string;
};

export const useProfile = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    const fetchProfile = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('auth_user_id', user.id)
                .single();

            if (error) throw error;
            setProfile(data);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    return { profile, loading, error, refetch: fetchProfile };
};
