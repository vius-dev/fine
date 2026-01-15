import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import { useOnboarding } from '../src/hooks/useOnboarding';
import { Colors, Spacing, Typography } from '../src/theme';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
    const { t } = useTranslation();
    const [currentIndex, setCurrentIndex] = useState(0);
    const router = useRouter();
    const { completeOnboarding } = useOnboarding();

    const SLIDES = [
        {
            title: t('onboarding.slide1.title'),
            description: t('onboarding.slide1.description'),
            icon: '✅',
        },
        {
            title: t('onboarding.slide2.title'),
            description: t('onboarding.slide2.description'),
            icon: '⏳',
        },
        {
            title: t('onboarding.slide3.title'),
            description: t('onboarding.slide3.description'),
            icon: '🛡️',
        },
    ];

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            handleComplete();
        }
    };

    const handleComplete = async () => {
        try {
            // Update state globally - this will trigger the redirect in _layout.tsx
            await completeOnboarding();
            // No need to manually replace route, the effect in _layout.tsx will handle it
            // checking 'hasCompletedOnboarding' which will now be true.
            // But just in case of race/delay, we can let the effect do the job.
        } catch (error) {
            console.error('Failed to complete onboarding:', error);
        }
    };

    return (
        <Screen style={styles.container}>
            <View style={styles.content}>
                <View style={styles.slideContainer}>
                    <Text style={styles.icon}>{SLIDES[currentIndex].icon}</Text>
                    <Text style={styles.title}>{SLIDES[currentIndex].title}</Text>
                    <Text style={styles.description}>{SLIDES[currentIndex].description}</Text>
                </View>

                <View style={styles.pagination}>
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                index === currentIndex ? styles.activeDot : styles.inactiveDot,
                            ]}
                        />
                    ))}
                </View>
            </View>

            <View style={styles.footer}>
                <Button
                    title={currentIndex === SLIDES.length - 1 ? t('onboarding.get_started') : t('onboarding.next')}
                    onPress={handleNext}
                    size="large"
                    style={styles.button}
                />
                {currentIndex < SLIDES.length - 1 && (
                    <Button
                        title={t('onboarding.skip')}
                        variant="text"
                        onPress={handleComplete}
                        style={styles.skipButton}
                    />
                )}
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: Spacing.xl,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    slideContainer: {
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
    },
    icon: {
        fontSize: 80,
        marginBottom: Spacing.xl,
    },
    title: {
        ...Typography.h1,
        textAlign: 'center',
        marginBottom: Spacing.md,
        color: Colors.primary,
    },
    description: {
        ...Typography.body,
        textAlign: 'center',
        color: Colors.textSecondary,
        lineHeight: 24,
    },
    pagination: {
        flexDirection: 'row',
        marginTop: Spacing.xl * 2,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginHorizontal: 6,
    },
    activeDot: {
        backgroundColor: Colors.primary,
        width: 20,
    },
    inactiveDot: {
        backgroundColor: Colors.border,
    },
    footer: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.lg,
        width: '100%',
    },
    button: {
        width: '100%',
    },
    skipButton: {
        marginTop: Spacing.sm,
    }
});
