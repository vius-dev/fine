import Slider from '@react-native-community/slider';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/hooks/useAuth';
import { useProfile } from '../../src/hooks/useProfile';
import { api } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { Colors, Spacing, Typography } from '../../src/theme';
import { RINGTONE_OPTIONS, previewRingtone, stopRingtone } from '../../src/utils/audioPlayer';

export default function SettingsScreen() {
    const { profile, refetch } = useProfile();
    const { session } = useAuth();
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);

    const handleUpdateVacationMode = async (value: boolean) => {
        try {
            const { error } = await api.updateProfile({ vacation_mode: value });
            if (error) throw error;
            refetch();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleUpdateRingtoneEnabled = async (value: boolean) => {
        try {
            const { error } = await api.updateProfile({ ringtone_enabled: value });
            if (error) throw error;
            refetch();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleSelectRingtone = async (ringtoneId: string) => {
        try {
            const { error } = await api.updateProfile({ ringtone_selection: ringtoneId });
            if (error) throw error;
            refetch();

            // Preview the selected ringtone
            await handlePreviewRingtone(ringtoneId);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleVolumeChange = async (value: number) => {
        try {
            const { error } = await api.updateProfile({ ringtone_volume: Math.round(value) });
            if (error) throw error;
            refetch();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handlePreviewRingtone = async (ringtoneId?: string) => {
        try {
            setIsPlayingPreview(true);
            const selectedRingtone = ringtoneId || profile?.ringtone_selection || 'default';
            const volume = profile?.ringtone_volume || 100;
            await previewRingtone(selectedRingtone as any, volume);

            // Auto-stop preview indicator after 3 seconds
            setTimeout(() => {
                setIsPlayingPreview(false);
            }, 3000);
        } catch (error) {
            console.error('Preview error:', error);
            setIsPlayingPreview(false);
        }
    };

    const handleStopPreview = async () => {
        await stopRingtone();
        setIsPlayingPreview(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const selectedRingtone = profile?.ringtone_selection || 'default';
    const ringtoneVolume = profile?.ringtone_volume ?? 100;
    const ringtoneEnabled = profile?.ringtone_enabled ?? true;

    return (
        <Screen style={styles.container}>
            <View style={styles.header}>
                <Text style={Typography.h1}>Settings</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Vacation Mode - Disabled until user feedback validates need
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Status</Text>
                    <View style={styles.row}>
                        <View style={styles.textColumn}>
                            <Text style={styles.label}>Vacation Mode</Text>
                            <Text style={styles.description}>Pause all check-ins and alerts.</Text>
                        </View>
                        <Switch
                            value={profile?.vacation_mode ?? false}
                            onValueChange={handleUpdateVacationMode}
                            trackColor={{ false: Colors.border, true: Colors.primary }}
                        />
                    </View>
                </View>
                */}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Check-in Schedule</Text>
                    <Text style={styles.description}>How often do you want to check in?</Text>

                    <View style={[styles.row, { marginTop: Spacing.md }]}>
                        <View style={styles.textColumn}>
                            <Text style={styles.label}>Every {profile?.checkin_interval_hours || 24} hours</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                            <Button
                                title="-"
                                variant="outline"
                                onPress={() => {
                                    const current = profile?.checkin_interval_hours || 24;
                                    if (current > 1) {
                                        api.updateProfile({ checkin_interval_hours: current - 1 }).then(() => refetch());
                                    }
                                }}
                                style={styles.stepperButton}
                            />
                            <Button
                                title="+"
                                variant="outline"
                                onPress={() => {
                                    const current = profile?.checkin_interval_hours || 24;
                                    api.updateProfile({ checkin_interval_hours: current + 1 }).then(() => refetch());
                                }}
                                style={styles.stepperButton}
                            />
                        </View>
                    </View>
                    <View style={[styles.row, { marginTop: Spacing.xs }]}>
                        <Button
                            title="Set to 12h"
                            variant="secondary"
                            onPress={() => api.updateProfile({ checkin_interval_hours: 12 }).then(() => refetch())}
                            style={{ flex: 1, marginRight: 8 }}
                            textStyle={{ fontSize: 12 }}
                        />
                        <Button
                            title="Set to 24h"
                            variant="secondary"
                            onPress={() => api.updateProfile({ checkin_interval_hours: 24 }).then(() => refetch())}
                            style={{ flex: 1 }}
                            textStyle={{ fontSize: 12 }}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Check-in Reminders</Text>

                    <View style={styles.row}>
                        <View style={styles.textColumn}>
                            <Text style={styles.label}>Reminder Notifications</Text>
                            <Text style={styles.description}>Get notified when check-in is due</Text>
                        </View>
                        <Switch
                            value={profile?.reminder_enabled ?? true}
                            onValueChange={async (value) => {
                                try {
                                    const { error } = await api.updateProfile({ reminder_enabled: value });
                                    if (error) throw error;
                                    refetch();
                                } catch (error: any) {
                                    Alert.alert('Error', error.message);
                                }
                            }}
                            trackColor={{ false: Colors.border, true: Colors.primary }}
                        />
                    </View>

                    {(profile?.reminder_enabled ?? true) && (
                        <View style={{ marginTop: Spacing.md }}>
                            <Text style={[styles.label, { marginBottom: Spacing.sm }]}>Remind me</Text>
                            {(() => {
                                const interval = profile?.checkin_interval_hours || 24;
                                const options = [
                                    { label: 'When check-in is due', value: 0 },
                                ];

                                // Only show options that are less than the check-in interval
                                if (interval > 1) options.push({ label: '1 hour before', value: 1 });
                                if (interval > 2) options.push({ label: '2 hours before', value: 2 });
                                if (interval > 4) options.push({ label: '4 hours before', value: 4 });
                                if (interval > 12) options.push({ label: '12 hours before', value: 12 });

                                return options.map((option) => (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[
                                            styles.ringtoneOption,
                                            (profile?.reminder_offset_hours ?? 0) === option.value && styles.ringtoneOptionSelected
                                        ]}
                                        onPress={async () => {
                                            try {
                                                const { error } = await api.updateProfile({ reminder_offset_hours: option.value });
                                                if (error) throw error;
                                                refetch();
                                            } catch (error: any) {
                                                Alert.alert('Error', error.message);
                                            }
                                        }}
                                    >
                                        <View style={styles.radioButton}>
                                            {(profile?.reminder_offset_hours ?? 0) === option.value && (
                                                <View style={styles.radioButtonInner} />
                                            )}
                                        </View>
                                        <Text style={styles.label}>{option.label}</Text>
                                    </TouchableOpacity>
                                ));
                            })()}
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Escalation Alert</Text>

                    {/* Enable/Disable Ringtone */}
                    <View style={styles.row}>
                        <View style={styles.textColumn}>
                            <Text style={styles.label}>Alert Sound</Text>
                            <Text style={styles.description}>Play sound when escalated</Text>
                        </View>
                        <Switch
                            value={ringtoneEnabled}
                            onValueChange={handleUpdateRingtoneEnabled}
                            trackColor={{ false: Colors.border, true: Colors.primary }}
                        />
                    </View>

                    {ringtoneEnabled && (
                        <>
                            {/* Ringtone Selection */}
                            <View style={{ marginTop: Spacing.md }}>
                                <Text style={[styles.label, { marginBottom: Spacing.sm }]}>Select Ringtone</Text>
                                {RINGTONE_OPTIONS.map((ringtone) => (
                                    <TouchableOpacity
                                        key={ringtone.id}
                                        style={[
                                            styles.ringtoneOption,
                                            selectedRingtone === ringtone.id && styles.ringtoneOptionSelected
                                        ]}
                                        onPress={() => handleSelectRingtone(ringtone.id)}
                                    >
                                        <View style={styles.radioButton}>
                                            {selectedRingtone === ringtone.id && (
                                                <View style={styles.radioButtonInner} />
                                            )}
                                        </View>
                                        <View style={styles.textColumn}>
                                            <Text style={styles.label}>{ringtone.name}</Text>
                                            <Text style={styles.description}>{ringtone.description}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Volume Control */}
                            <View style={{ marginTop: Spacing.md }}>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Volume</Text>
                                    <Text style={styles.label}>{ringtoneVolume}%</Text>
                                </View>
                                <Slider
                                    style={{ width: '100%', height: 40 }}
                                    minimumValue={0}
                                    maximumValue={100}
                                    step={10}
                                    value={ringtoneVolume}
                                    onSlidingComplete={handleVolumeChange}
                                    minimumTrackTintColor={Colors.primary}
                                    maximumTrackTintColor={Colors.border}
                                    thumbTintColor={Colors.primary}
                                />
                            </View>

                            {/* Test Button */}
                            <Button
                                title={isPlayingPreview ? "Stop Preview" : "Test Alert Sound"}
                                variant={isPlayingPreview ? "secondary" : "outline"}
                                onPress={isPlayingPreview ? handleStopPreview : () => handlePreviewRingtone()}
                                style={{ marginTop: Spacing.md }}
                            />
                        </>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <Text style={styles.email}>{session?.user?.email}</Text>
                    <Button
                        title="Sign Out"
                        variant="secondary"
                        onPress={handleLogout}
                        style={styles.logoutButton}
                    />
                </View>
            </ScrollView>

            <Text style={styles.version}>ImFine v1.0.0 (MVP)</Text>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: Spacing.lg,
    },
    header: {
        marginBottom: Spacing.lg,
    },
    content: {
        paddingBottom: Spacing.xxl,
    },
    section: {
        marginBottom: Spacing.xl,
        backgroundColor: Colors.surface,
        padding: Spacing.md,
        borderRadius: 12,
    },
    sectionTitle: {
        ...Typography.h2,
        fontSize: 18,
        marginBottom: Spacing.md,
        color: Colors.text,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    textColumn: {
        flex: 1,
        paddingRight: Spacing.md,
    },
    label: {
        ...Typography.body,
        fontWeight: '600',
    },
    description: {
        ...Typography.caption,
        marginTop: 2,
    },
    smallButton: {
        minHeight: 36,
        paddingVertical: 4,
        paddingHorizontal: 12,
    },
    stepperButton: {
        minHeight: 36,
        minWidth: 40,
        paddingVertical: 4,
        paddingHorizontal: 0,
    },
    email: {
        ...Typography.body,
        marginBottom: Spacing.md,
        color: Colors.textSecondary,
    },
    logoutButton: {
        marginTop: Spacing.sm,
    },
    version: {
        ...Typography.caption,
        textAlign: 'center',
        marginBottom: Spacing.lg,
        opacity: 0.5,
    },
    ringtoneOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.sm,
        borderRadius: 8,
        marginBottom: Spacing.xs,
        backgroundColor: Colors.background,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    ringtoneOptionSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.surface,
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: Colors.primary,
        marginRight: Spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioButtonInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary,
    },
});
