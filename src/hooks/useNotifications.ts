import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { api } from '../lib/api';
import { playRingtone, stopRingtone } from '../utils/audioPlayer';

// Gracefully handle notification setup (may fail in Expo Go SDK 53+)
try {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
} catch (error) {
    // Silently ignore - notifications not available in Expo Go
}

export const useNotifications = () => {
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
    const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);
    const router = useRouter();

    async function registerForPushNotificationsAsync() {
        let token;

        try {
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            if (Device.isDevice) {
                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;
                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }
                if (finalStatus !== 'granted') {
                    // Silently return - don't alert user in Expo Go
                    return;
                }
                try {
                    // Learn more about projectId:
                    // https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectId
                    // For bare workflow: 
                    // token = (await Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig?.extra?.eas?.projectId })).data;
                    // For managed, usually just:
                    token = (await Notifications.getExpoPushTokenAsync()).data;
                } catch (e) {
                    // Silently ignore - not available in Expo Go SDK 53+
                }
            }
        } catch (error) {
            // Gracefully handle any notification API errors
            // This prevents errors from showing in Expo Go
        }

        return token;
    }

    useEffect(() => {
        registerForPushNotificationsAsync().then(token => {
            setExpoPushToken(token);
            if (token) {
                // Save token to profile
                api.updateProfile({ expo_push_token: token }).catch(() => {
                    // Silently ignore profile update errors
                });
            }
        }).catch(() => {
            // Silently ignore registration errors
        });

        try {
            notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
                setNotification(notification);

                // Check for escalation alert from a contact
                const data = notification.request.content.data as any;
                if (data?.type === 'ESCALATION_ALERT') {
                    // Play alert sound
                    playRingtone('urgent', 100, true).catch(console.error);

                    // Show alert dialog
                    Alert.alert(
                        '🚨 Emergency Alert',
                        `${data.user_email} needs help! They missed their check-in.`,
                        [
                            {
                                text: 'Acknowledge',
                                onPress: () => {
                                    stopRingtone();
                                },
                            },
                        ],
                        { cancelable: false }
                    );
                }

                // Check for resolution alert (SAFE)
                if (data?.type === 'RESOLUTION_ALERT') {
                    // Stop any playing ringtone (e.g. if this device was alerting)
                    stopRingtone();

                    // Show safe dialog
                    Alert.alert(
                        '✅ User is Safe',
                        `${data.user_email} has marked themselves as safe. The emergency is resolved.`,
                        [{ text: 'OK' }],
                        { cancelable: true }
                    );
                }

                // Check for contact request
                if (data?.type === 'CONTACT_REQUEST') {
                    // Show confirmation dialog
                    Alert.alert(
                        '👥 Contact Request',
                        `${data.requester_email || 'Someone'} wants to add you as a trusted contact.`,
                        [
                            {
                                text: 'Ignore',
                                style: 'cancel'
                            },
                            {
                                text: 'Accept',
                                onPress: async () => {
                                    try {
                                        const { error } = await api.confirmContactRequest(data.contact_record_id);
                                        if (error) throw error;
                                        Alert.alert('Success', 'You are now a trusted contact.');
                                    } catch (error: any) {
                                        Alert.alert('Error', 'Failed to accept request: ' + error.message);
                                    }
                                }
                            }
                        ]
                    );
                }

                // Check for check-in reminder
                if (data?.type === 'CHECKIN_REMINDER') {
                    // Just show the notification, no alarm sound
                    // User can tap to navigate to home screen
                }

                // Legacy escalation check (for backward compatibility)
                if (data?.escalation) {
                    router.push('/escalation');
                }
            });

            responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
                const data = response.notification.request.content.data as any;

                // Stop any playing ringtone when user taps notification
                stopRingtone();

                if (data?.type === 'ESCALATION_ALERT') {
                    // User tapped the notification - could navigate to a contact alert screen
                    // For now, just acknowledge
                    Alert.alert(
                        'Contact Alert',
                        `${data.user_email} has been escalated. Please contact them.`,
                        [{ text: 'OK' }]
                    );
                }

                if (data?.type === 'RESOLUTION_ALERT') {
                    // User tapped the resolution notification
                    Alert.alert(
                        '✅ User is Safe',
                        `${data.user_email} is safe. Emergency resolved.`,
                        [{ text: 'OK' }]
                    );
                }

                if (data?.type === 'CONTACT_REQUEST') {
                    Alert.alert(
                        '👥 Contact Request',
                        `${data.requester_email || 'Someone'} wants to add you as a trusted contact.`,
                        [
                            { text: 'Ignore', style: 'cancel' },
                            {
                                text: 'Accept',
                                onPress: async () => {
                                    try {
                                        const { error } = await api.confirmContactRequest(data.contact_record_id);
                                        if (error) throw error;
                                        Alert.alert('Success', 'You are now a trusted contact.');
                                    } catch (error: any) {
                                        Alert.alert('Error', 'Failed to accept request: ' + error.message);
                                    }
                                }
                            }
                        ]
                    );
                }

                // Check-in reminder tapped - navigate to home
                if (data?.type === 'CHECKIN_REMINDER') {
                    router.push('/(tabs)');
                }

                // Legacy escalation check
                if (data?.escalation) {
                    router.push('/escalation');
                }
            });
        } catch (error) {
            // Gracefully handle listener setup errors in Expo Go
        }

        return () => {
            try {
                notificationListener.current && notificationListener.current.remove();
                responseListener.current && responseListener.current.remove();
            } catch (error) {
                // Silently ignore cleanup errors
            }
        };
    }, [router]);

    return { expoPushToken, notification };
};
