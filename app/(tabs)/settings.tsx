import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from '../../src/components/Avatar';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/hooks/useAuth';
import { useProfile } from '../../src/hooks/useProfile';
import { api } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { Colors, Spacing, Typography } from '../../src/theme';
import { RINGTONE_OPTIONS, previewRingtone, stopRingtone } from '../../src/utils/audioPlayer';

export default function SettingsScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation(); // Use hook
    const { profile, refetch } = useProfile();
    const { session } = useAuth();
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const [intervalModalVisible, setIntervalModalVisible] = useState(false);
    const [gracePeriodModalVisible, setGracePeriodModalVisible] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const handleUpdateVacationMode = async (value: boolean) => {
        try {
            const { error } = await api.updateProfile({ vacation_mode: value });
            if (error) throw error;
            refetch();
        } catch (error: any) {
            Alert.alert(t('common.error'), error.message);
        }
    };

    const handleUpdateRingtoneEnabled = async (value: boolean) => {
        try {
            const { error } = await api.updateProfile({ ringtone_enabled: value });
            if (error) throw error;
            refetch();
        } catch (error: any) {
            Alert.alert(t('common.error'), error.message);
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
            Alert.alert(t('common.error'), error.message);
        }
    };

    const handleVolumeChange = async (value: number) => {
        try {
            const { error } = await api.updateProfile({ ringtone_volume: Math.round(value) });
            if (error) throw error;
            refetch();
        } catch (error: any) {
            Alert.alert(t('common.error'), error.message);
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

    const handleSendTestAlert = async () => {
        Alert.alert(
            t('settings.test_alert_confirm_title'),
            t('settings.test_alert_confirm_desc'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('settings.send_test'),
                    onPress: async () => {
                        try {
                            const { error } = await api.sendTestAlert();
                            if (error) throw error;
                            Alert.alert(t('settings.test_alert_sent_title'), t('settings.test_alert_sent_desc'));
                        } catch (error: any) {
                            Alert.alert(t('common.error'), error.message);
                        }
                    }
                }
            ]
        );
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handleUploadAvatar = async () => {
        try {
            // Request permission
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(t('common.error'), 'Permission to access photos is required');
                return;
            }

            // Pick image
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1,
            });

            if (result.canceled) return;

            setUploadingAvatar(true);
            const { error } = await api.uploadAvatar(result.assets[0].uri);
            if (error) throw error;

            Alert.alert(t('common.success'), 'Profile picture updated');
            refetch();
        } catch (error: any) {
            Alert.alert(t('common.error'), error.message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleDeleteAvatar = async () => {
        Alert.alert(
            'Remove Photo',
            'Are you sure you want to remove your profile picture?',
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setUploadingAvatar(true);
                            const { error } = await api.deleteAvatar();
                            if (error) throw error;
                            refetch();
                        } catch (error: any) {
                            Alert.alert(t('common.error'), error.message);
                        } finally {
                            setUploadingAvatar(false);
                        }
                    }
                }
            ]
        );
    };

    const selectedRingtone = profile?.ringtone_selection || 'default';
    const ringtoneVolume = profile?.ringtone_volume ?? 100;
    const ringtoneEnabled = profile?.ringtone_enabled ?? true;

    return (
        <Screen style={styles.container}>
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
                    <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
                    <View style={styles.row}>
                        {['en', 'es', 'fr', 'de'].map((lang) => (
                            <Button
                                key={lang}
                                title={lang.toUpperCase()}
                                variant={i18n.language === lang ? 'primary' : 'outline'}
                                size="small"
                                onPress={() => i18n.changeLanguage(lang)}
                                style={{ flex: 1, marginHorizontal: 4 }}
                            />
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.checkin_schedule')}</Text>
                    <Text style={styles.description}>{t('settings.checkin_schedule_desc')}</Text>

                    <TouchableOpacity
                        style={styles.intervalSelector}
                        onPress={() => setIntervalModalVisible(true)}
                    >
                        <View style={styles.textColumn}>

                            <Text style={styles.intervalValue}>
                                {t('message.every_hours', { hours: profile?.checkin_interval_hours || 24 })}
                            </Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.intervalSelector}
                        onPress={() => setGracePeriodModalVisible(true)}
                    >
                        <View style={styles.textColumn}>

                            <Text style={styles.description}>{t('settings.grace_period_desc')}</Text>
                            <Text style={styles.intervalValue}>
                                {(() => {
                                    const mins = profile?.grace_period_minutes || 720;
                                    if (mins < 60) return `${mins} ${t('common.minutes', { defaultValue: 'minutes' })}`;
                                    const hours = mins / 60;
                                    return hours === 1 ? `1 ${t('common.hour', { defaultValue: 'hour' })}` : `${hours} ${t('common.hours', { defaultValue: 'hours' })}`;
                                })()}
                            </Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.reminders')}</Text>

                    <View style={styles.row}>
                        <View style={styles.textColumn}>

                            <Text style={styles.description}>{t('settings.reminders_desc')}</Text>
                        </View>
                        <Switch
                            value={profile?.reminder_enabled ?? true}
                            onValueChange={async (value) => {
                                try {
                                    const { error } = await api.updateProfile({ reminder_enabled: value });
                                    if (error) throw error;
                                    refetch();
                                } catch (error: any) {
                                    Alert.alert(t('common.error'), error.message);
                                }
                            }}
                            trackColor={{ false: Colors.border, true: Colors.primary }}
                        />
                    </View>

                    {(profile?.reminder_enabled ?? true) && (
                        <View style={{ marginTop: Spacing.md }}>
                            <Text style={[styles.label, { marginBottom: Spacing.sm }]}>{t('settings.remind_me')}</Text>
                            {(() => {
                                const interval = profile?.checkin_interval_hours || 24;
                                const options = [
                                    { label: t('settings.reminder_picker_due'), value: 0 },
                                ];

                                // Only show options that are less than the check-in interval
                                if (interval > 1) options.push({ label: t('settings.reminder_picker_before', { hours: 1 }), value: 1 });
                                if (interval > 2) options.push({ label: t('settings.reminder_picker_before_plural', { hours: 2 }), value: 2 });
                                if (interval > 4) options.push({ label: t('settings.reminder_picker_before_plural', { hours: 4 }), value: 4 });
                                if (interval > 12) options.push({ label: t('settings.reminder_picker_before_plural', { hours: 12 }), value: 12 });

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
                                                Alert.alert(t('common.error'), error.message);
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
                    <Text style={styles.sectionTitle}>{t('settings.escalation_alert')}</Text>

                    {/* Enable/Disable Ringtone */}
                    <View style={styles.row}>
                        <View style={styles.textColumn}>

                            <Text style={styles.description}>{t('settings.escalation_sound_desc')}</Text>
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
                                <Text style={[styles.label, { marginBottom: Spacing.sm }]}>{t('settings.select_ringtone')}</Text>
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
                                            <Text style={styles.label}>{t(`ringtones.${ringtone.id}.name`)}</Text>
                                            <Text style={styles.description}>{t(`ringtones.${ringtone.id}.desc`)}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Volume Control */}
                            <View style={{ marginTop: Spacing.md }}>
                                <View style={styles.row}>
                                    <Text style={styles.label}>{t('settings.volume')}</Text>
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
                                title={isPlayingPreview ? t('settings.stop_preview') : t('settings.test_alert_sound')}
                                variant={isPlayingPreview ? "secondary" : "outline"}
                                onPress={isPlayingPreview ? handleStopPreview : () => handlePreviewRingtone()}
                                style={{ marginTop: Spacing.md }}
                            />
                        </>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.system_check')}</Text>
                    <Text style={styles.description}>{t('settings.system_check_desc')}</Text>
                    <Button
                        title={t('settings.send_test')}
                        variant="outline"
                        onPress={handleSendTestAlert}
                        style={{ marginTop: Spacing.md }}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.transparency')}</Text>
                    <Text style={styles.description}>{t('settings.view_notification_activity')}</Text>
                    <Button
                        title={t('settings.view_notification_history')}
                        variant="outline"
                        onPress={() => router.push('/notification-history' as any)}
                        style={{ marginTop: Spacing.md }}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.timezone')}</Text>
                    <Text style={styles.description}>
                        {t('settings.current_timezone', { timezone: profile?.timezone || t('status.unknown') })}
                    </Text>
                    <Text style={[styles.description, { marginTop: Spacing.xs, fontSize: 11 }]}>
                        {t('settings.timezone_description')}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.account')}</Text>

                    {/* Avatar Section */}
                    <View style={styles.avatarSection}>
                        <Avatar
                            uri={profile?.avatar_url}
                            size={80}
                            fallbackInitials={session?.user?.email?.charAt(0).toUpperCase()}
                        />
                        <View style={styles.avatarButtons}>
                            <Button
                                title={uploadingAvatar ? '...' : (profile?.avatar_url ? 'Change' : 'Add')}
                                variant="outline"
                                size="small"
                                onPress={handleUploadAvatar}
                                disabled={uploadingAvatar}
                                style={{ paddingHorizontal: 12 }}
                                textStyle={{ fontSize: 12 }}
                            />
                            {profile?.avatar_url && (
                                <Button
                                    title="Remove"
                                    variant="secondary"
                                    size="small"
                                    onPress={handleDeleteAvatar}
                                    disabled={uploadingAvatar}
                                    style={{ marginLeft: Spacing.xs, paddingHorizontal: 12 }}
                                    textStyle={{ fontSize: 12 }}
                                />
                            )}
                        </View>
                    </View>

                    <Text style={styles.email}>{session?.user?.email}</Text>
                    <Button
                        title={t('settings.sign_out')}
                        variant="secondary"
                        onPress={handleLogout}
                        style={styles.logoutButton}
                    />

                    <View style={{ marginTop: Spacing.xl, paddingTop: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border }}>
                        <Button
                            title="Delete Account"
                            variant="primary" // Using primary with red style override
                            onPress={() => {
                                Alert.alert(
                                    'Delete Account',
                                    'Are you sure? This action cannot be undone. all your data will be permanently removed.',
                                    [
                                        { text: t('common.cancel'), style: 'cancel' },
                                        {
                                            text: 'Delete',
                                            style: 'destructive',
                                            onPress: async () => {
                                                try {
                                                    const { error } = await api.deleteAccount();
                                                    if (error) throw error;
                                                    await supabase.auth.signOut();
                                                    router.replace('/(auth)/login');
                                                    Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
                                                } catch (error: any) {
                                                    Alert.alert(t('common.error'), error.message);
                                                }
                                            }
                                        }
                                    ]
                                );
                            }}
                            style={{ backgroundColor: Colors.escalated, borderColor: Colors.escalated }}
                            textStyle={{ color: 'white' }}
                        />
                        <Text style={[styles.description, { textAlign: 'center', marginTop: Spacing.sm, color: Colors.escalated }]}>
                            {t('settings.danger_zone_warning')}
                        </Text>
                    </View>
                    <Text style={styles.version}>{t('settings.footer_version')}</Text>
                </View>
            </ScrollView>

            {/* Interval Selection Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={intervalModalVisible}
                onRequestClose={() => setIntervalModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalView}>
                        <Text style={[Typography.h2, { marginBottom: Spacing.md }]}>Check-in Interval</Text>
                        <Text style={[styles.description, { marginBottom: Spacing.lg }]}>
                            How often do you want to check in?
                        </Text>

                        {[1, 4, 8, 12, 24, 48].map((hours) => (
                            <TouchableOpacity
                                key={hours}
                                style={[
                                    styles.intervalOption,
                                    (profile?.checkin_interval_hours === hours) && styles.intervalOptionSelected
                                ]}
                                onPress={async () => {
                                    try {
                                        const { error } = await api.updateProfile({ checkin_interval_hours: hours });
                                        if (error) throw error;
                                        refetch();
                                        setIntervalModalVisible(false);
                                    } catch (error: any) {
                                        Alert.alert(t('common.error'), error.message);
                                    }
                                }}
                            >
                                <View style={styles.radioButton}>
                                    {(profile?.checkin_interval_hours === hours) && (
                                        <View style={styles.radioButtonInner} />
                                    )}
                                </View>
                                <Text style={styles.label}>
                                    {hours === 1 ? '1 hour' : `${hours} hours`}
                                </Text>
                            </TouchableOpacity>
                        ))}

                        <Button
                            title="Cancel"
                            variant="outline"
                            onPress={() => setIntervalModalVisible(false)}
                            style={{ marginTop: Spacing.md }}
                        />
                    </View>
                </View>
            </Modal>

            {/* Grace Period Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={gracePeriodModalVisible}
                onRequestClose={() => setGracePeriodModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalView}>
                        <Text style={[Typography.h2, { marginBottom: Spacing.md }]}>{t('settings.grace_period_modal_title')}</Text>
                        <Text style={[styles.description, { marginBottom: Spacing.lg }]}>
                            {t('settings.grace_period_modal_desc')}
                        </Text>

                        {[15, 30, 60, 240, 720, 1440].map((minutes) => (
                            <TouchableOpacity
                                key={minutes}
                                style={[
                                    styles.intervalOption,
                                    (profile?.grace_period_minutes === minutes) && styles.intervalOptionSelected
                                ]}
                                onPress={async () => {
                                    try {
                                        const { error } = await api.updateProfile({ grace_period_minutes: minutes });
                                        if (error) throw error;
                                        refetch();
                                        setGracePeriodModalVisible(false);
                                    } catch (error: any) {
                                        Alert.alert(t('common.error'), error.message);
                                    }
                                }}
                            >
                                <View style={styles.radioButton}>
                                    {(profile?.grace_period_minutes === minutes) && (
                                        <View style={styles.radioButtonInner} />
                                    )}
                                </View>
                                <Text style={styles.label}>
                                    {minutes < 60
                                        ? `${minutes} ${t('common.minutes', { defaultValue: 'minutes' })}`
                                        : minutes === 60
                                            ? `1 ${t('common.hour', { defaultValue: 'hour' })}`
                                            : `${minutes / 60} ${t('common.hours', { defaultValue: 'hours' })}`}
                                </Text>
                            </TouchableOpacity>
                        ))}

                        <Button
                            title={t('common.cancel')}
                            variant="outline"
                            onPress={() => setGracePeriodModalVisible(false)}
                            style={{ marginTop: Spacing.md }}
                        />
                    </View>
                </View>
            </Modal>
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
        fontSize: 16,
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
        marginTop: Spacing.md,
        opacity: 0.4,
        fontSize: 11,
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
    intervalSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        backgroundColor: Colors.background,
        borderRadius: 8,
        marginTop: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    intervalValue: {
        ...Typography.body,
        color: Colors.primary,
        fontWeight: '600',
        marginTop: 4,
    },
    chevron: {
        fontSize: 24,
        color: Colors.textSecondary,
        fontWeight: '300',
    },
    intervalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: 8,
        marginBottom: Spacing.xs,
        backgroundColor: Colors.background,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    intervalOptionSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.surface,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: Spacing.lg,
    },
    modalView: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: Spacing.xl,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    avatarSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
        gap: Spacing.md,
    },
    avatarButtons: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
});
