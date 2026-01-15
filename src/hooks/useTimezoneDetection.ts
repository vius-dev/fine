import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import { api } from '../lib/api';
import { useProfile } from './useProfile';

export function useTimezoneDetection() {
    const { profile, refetch } = useProfile();

    useEffect(() => {
        const checkTimezone = async () => {
            try {
                const currentTimezone = Localization.getCalendars()[0]?.timeZone || 'UTC';
                const storedTimezone = profile?.timezone;

                if (!storedTimezone) {
                    // First time - store current timezone
                    await api.updateProfile({ timezone: currentTimezone });
                    await refetch();
                    return;
                }

                if (currentTimezone !== storedTimezone) {
                    // Check if user dismissed this timezone change
                    const dismissedKey = `dismissed_tz_${currentTimezone}`;
                    const dismissed = await AsyncStorage.getItem(dismissedKey);

                    if (!dismissed) {
                        Alert.alert(
                            'Time Zone Change Detected',
                            `You moved from ${storedTimezone} to ${currentTimezone}. Would you like to update your check-in schedule to match your new local time?`,
                            [
                                {
                                    text: 'Not Now',
                                    onPress: async () => {
                                        await AsyncStorage.setItem(dismissedKey, 'true');
                                    },
                                    style: 'cancel'
                                },
                                {
                                    text: 'Update Timezone',
                                    onPress: async () => {
                                        // Update timezone to new location
                                        await api.updateProfile({ timezone: currentTimezone });
                                        await refetch();
                                        Alert.alert('Updated', 'Your timezone has been updated.');
                                    }
                                }
                            ]
                        );
                    }
                }
            } catch (error) {
                console.error('Timezone detection error:', error);
            }
        };

        // Check on mount
        if (profile) {
            checkTimezone();
        }

        // Check when app comes to foreground
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active' && profile) {
                checkTimezone();
            }
        });

        return () => subscription.remove();
    }, [profile?.timezone, profile?.id]);
}
