import { format } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../src/components/Screen';
import { api } from '../src/lib/api';
import { Colors, Spacing, Typography } from '../src/theme';

type NotificationDelivery = {
    id: string;
    channel: 'PUSH' | 'EMAIL' | 'SMS';
    destination: string;
    delivered_at: string | null;
    error: string | null;
    created_at: string;
    event: {
        id: string;
        type: string;
        created_at: string;
    };
};

export default function NotificationHistoryScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        try {
            const { data, error } = await api.getNotificationHistory();
            if (error) throw error;
            // Supabase returns event as array, flatten it
            const formattedData = (data || []).map((item: any) => ({
                ...item,
                event: Array.isArray(item.event) ? item.event[0] : item.event
            })) as NotificationDelivery[];
            setDeliveries(formattedData);
        } catch (error: any) {
            console.error(error);
            Alert.alert(t('common.error'), t('notification_history.error_fetch'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const getEventTypeLabel = (type: string) => {
        switch (type) {
            case 'ESCALATION_ALERT':
                return t('notification_history.event_escalation');
            case 'RESOLUTION_ALERT':
                return t('notification_history.event_resolution');
            case 'TEST_ALERT':
                return t('notification_history.event_test');
            case 'CONTACT_REQUEST':
                return t('notification_history.event_contact_request');
            default:
                return type;
        }
    };

    const getEventTypeColor = (type: string) => {
        switch (type) {
            case 'ESCALATION_ALERT':
                return '#EF4444';
            case 'RESOLUTION_ALERT':
                return '#10B981';
            case 'TEST_ALERT':
                return '#3B82F6';
            case 'CONTACT_REQUEST':
                return '#8B5CF6';
            default:
                return Colors.primary;
        }
    };

    const getEventTypeIcon = (type: string) => {
        switch (type) {
            case 'ESCALATION_ALERT':
                return '🚨';
            case 'RESOLUTION_ALERT':
                return '✅';
            case 'TEST_ALERT':
                return '🧪';
            case 'CONTACT_REQUEST':
                return '👤';
            default:
                return '📬';
        }
    };

    const renderItem = ({ item }: { item: NotificationDelivery }) => {
        const isDelivered = !!item.delivered_at && !item.error;
        const isFailed = !!item.error;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.icon}>{getEventTypeIcon(item.event.type)}</Text>
                        <View
                            style={[
                                styles.eventBadge,
                                { backgroundColor: getEventTypeColor(item.event.type) + '20' },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.eventBadgeText,
                                    { color: getEventTypeColor(item.event.type) },
                                ]}
                            >
                                {getEventTypeLabel(item.event.type)}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.statusContainer}>
                        {isDelivered && <Text style={styles.statusDelivered}>{t('notification_history.status_delivered')}</Text>}
                        {isFailed && <Text style={styles.statusFailed}>{t('notification_history.status_failed')}</Text>}
                        {!isDelivered && !isFailed && <Text style={styles.statusPending}>{t('notification_history.status_pending')}</Text>}
                    </View>
                </View>

                <Text style={styles.deliveryInfo}>
                    {t('notification_history.sent_to', { channel: item.channel, destination: item.destination })}
                </Text>

                <Text style={styles.timestamp}>
                    {format(new Date(item.created_at), 'MMM d, yyyy \'at\' h:mm a')}
                </Text>

                {isFailed && item.error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{item.error}</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <Screen style={styles.container}>
            <Stack.Screen options={{ title: 'Notification History', headerBackTitle: 'Back' }} />
            <View style={styles.header}>
                {/* Custom back button removed as native header provides it, but keeping structure if needed for subtitle */}
                {/* <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>{t('notification_history.back')}</Text>
                </TouchableOpacity> */}
                {/* Title removed as we use native header */}
                <Text style={[Typography.body, styles.subtitle]}>
                    {t('notification_history.subtitle')}
                </Text>
            </View>

            <FlatList
                data={deliveries}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={fetchHistory}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text style={styles.emptyText}>{t('notification_history.empty_title')}</Text>
                        <Text style={styles.emptySubtext}>
                            {t('notification_history.empty_subtitle')}
                        </Text>
                    </View>
                }
            />
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
    backButton: {
        marginBottom: Spacing.sm,
    },
    backButtonText: {
        ...Typography.body,
        color: Colors.primary,
        fontWeight: '600',
    },
    subtitle: {
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    list: {
        paddingBottom: Spacing.xl,
    },
    card: {
        backgroundColor: Colors.surface,
        padding: Spacing.md,
        borderRadius: 12,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    icon: {
        fontSize: 24,
    },
    eventBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    eventBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    statusContainer: {
        alignItems: 'flex-end',
    },
    statusDelivered: {
        fontSize: 12,
        color: '#10B981',
        fontWeight: '600',
    },
    statusFailed: {
        fontSize: 12,
        color: '#EF4444',
        fontWeight: '600',
    },
    statusPending: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    deliveryInfo: {
        ...Typography.body,
        marginBottom: Spacing.xs,
    },
    timestamp: {
        ...Typography.caption,
        color: Colors.textSecondary,
    },
    errorContainer: {
        marginTop: Spacing.sm,
        padding: Spacing.sm,
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
    },
    errorText: {
        ...Typography.caption,
        color: '#991B1B',
    },
    emptyContainer: {
        padding: Spacing.xl,
        alignItems: 'center',
        marginTop: Spacing.xxl,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: Spacing.md,
    },
    emptyText: {
        ...Typography.h2,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    emptySubtext: {
        ...Typography.caption,
        color: Colors.textSecondary,
        textAlign: 'center',
        maxWidth: 280,
    },
});
