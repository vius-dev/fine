import React from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Spacing, Typography } from '../theme';

interface FirstCheckInOverlayProps {
    onAcknowledge: () => void;
}

export const FirstCheckInOverlay: React.FC<FirstCheckInOverlayProps> = ({ onAcknowledge }) => {
    const { t } = useTranslation();
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

    React.useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Modal
            visible={true}
            transparent
            animationType="none"
            statusBarTranslucent
        >
            <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
                <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
                    <View style={styles.iconContainer}>
                        <Text style={styles.icon}>✅</Text>
                    </View>

                    <Text style={styles.title}>{t('onboarding.first_checkin_title')}</Text>

                    <Text style={styles.description}>
                        {t('onboarding.first_checkin_description')}
                    </Text>

                    <View style={styles.features}>
                        <View style={styles.feature}>
                            <Text style={styles.featureIcon}>🔔</Text>
                            <Text style={styles.featureText}>{t('onboarding.feature_reminders')}</Text>
                        </View>
                        <View style={styles.feature}>
                            <Text style={styles.featureIcon}>⏰</Text>
                            <Text style={styles.featureText}>{t('onboarding.feature_grace')}</Text>
                        </View>
                        <View style={styles.feature}>
                            <Text style={styles.featureIcon}>🛡️</Text>
                            <Text style={styles.featureText}>{t('onboarding.feature_alerts')}</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={onAcknowledge}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>{t('onboarding.got_it')}</Text>
                    </TouchableOpacity>

                    <Text style={styles.hint}>
                        {t('onboarding.customize_hint')}
                    </Text>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    card: {
        backgroundColor: Colors.surface,
        borderRadius: 24,
        padding: Spacing.xl,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        marginBottom: Spacing.lg,
    },
    icon: {
        fontSize: 64,
    },
    title: {
        ...Typography.h1,
        fontSize: 24,
        color: Colors.text,
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    description: {
        ...Typography.body,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.xl,
        lineHeight: 22,
    },
    features: {
        width: '100%',
        marginBottom: Spacing.xl,
    },
    feature: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
        paddingHorizontal: Spacing.sm,
    },
    featureIcon: {
        fontSize: 24,
        marginRight: Spacing.md,
    },
    featureText: {
        ...Typography.body,
        color: Colors.text,
        flex: 1,
    },
    button: {
        backgroundColor: Colors.active,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl * 2,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        marginBottom: Spacing.md,
        shadowColor: Colors.active,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        ...Typography.button,
        color: Colors.buttonText,
        fontSize: 18,
        fontWeight: '700',
    },
    hint: {
        ...Typography.caption,
        color: Colors.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
