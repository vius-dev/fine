import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import { useProfile } from '../src/hooks/useProfile';
import { api } from '../src/lib/api';
import { Colors, Spacing, Typography } from '../src/theme';
import { playRingtone, stopRingtone } from '../src/utils/audioPlayer';

export default function EscalationScreen() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { profile } = useProfile();

    // Load and play sound on mount
    useEffect(() => {
        const startRingtone = async () => {
            // Only play if ringtone is enabled
            if (profile?.ringtone_enabled === false) {
                console.log('Ringtone disabled by user');
                return;
            }

            const ringtoneId = profile?.ringtone_selection || 'default';
            const volume = profile?.ringtone_volume ?? 100;

            try {
                await playRingtone(ringtoneId as any, volume, true); // Loop the ringtone
            } catch (error) {
                console.error('Failed to play escalation ringtone:', error);
            }
        };

        startRingtone();

        // Cleanup on unmount
        return () => {
            stopRingtone();
        };
    }, [profile]);

    const handleImFine = async () => {
        setLoading(true);
        await stopRingtone();

        try {
            // Use resolveAlert to notify contacts that user is safe
            const { error } = await api.resolveAlert();
            if (error) throw error;

            Alert.alert(t('escalation.resolved_title'), t('escalation.resolved_desc'));
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert(t('common.error'), error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSnooze = async () => {
        await stopRingtone();
        // Logic for snooze would go here (update DB to delay next check)
        Alert.alert(t('escalation.snoozed_title'), t('escalation.snoozed_desc'));
        router.replace('/(tabs)');
    };

    return (
        <Screen style={styles.container} backgroundColor={Colors.escalated}>
            <View style={styles.content}>
                <View style={styles.alertIcon}>
                    <Text style={styles.iconText}>!</Text>
                </View>

                <Text style={[Typography.h1, styles.title]}>{t('escalation.title')}</Text>
                <Text style={[Typography.body, styles.subtitle]}>
                    {t('escalation.subtitle')}
                </Text>

                <View style={styles.actions}>
                    <Button
                        title={t('escalation.resolve_button')}
                        onPress={handleImFine}
                        loading={loading}
                        style={styles.mainButton}
                        textStyle={styles.mainButtonText}
                    />

                    <Button
                        title={t('escalation.snooze')}
                        variant="outline"
                        onPress={handleSnooze}
                        style={styles.snoozeButton}
                        textStyle={styles.snoozeText}
                    />
                </View>
            </View>
        </Screen>
    );
}


const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    alertIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xl,
    },
    iconText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: Colors.escalated,
    },
    title: {
        color: 'white',
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    subtitle: {
        color: 'white',
        textAlign: 'center',
        opacity: 0.9,
        marginBottom: Spacing.xxl,
    },
    actions: {
        width: '100%',
        gap: Spacing.lg,
    },
    mainButton: {
        backgroundColor: 'white',
        height: 64,
    },
    mainButtonText: {
        color: Colors.escalated,
        fontSize: 24,
        fontWeight: '700',
    },
    snoozeButton: {
        borderColor: 'white',
    },
    snoozeText: {
        color: 'white',
    }
});
