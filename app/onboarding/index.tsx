import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Colors, Spacing, Typography } from '../../src/theme';

const STEPS = [
    {
        title: 'Welcome to ImFine',
        description: 'A simple way to let your loved ones know you are okay, without the complexity.',
        image: null,
    },
    {
        title: 'Peace of Mind',
        description: 'Set a regular interval. If you miss it, we notify your trusted contacts automatically.',
        image: null,
    },
    {
        title: 'Minimal Tracking',
        description: 'We don\'t track your location. We only care that you tell us you\'re fine.',
        image: null,
    }
];

export default function OnboardingScreen() {
    const [step, setStep] = useState(0);
    const router = useRouter();

    const handleNext = () => {
        if (step < STEPS.length - 1) {
            setStep(step + 1);
        } else {
            router.push('/(auth)/login');
        }
    };

    const currentStep = STEPS[step];

    return (
        <Screen style={styles.container}>
            <View style={styles.content}>
                <View style={styles.stepIndicator}>
                    {STEPS.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                { backgroundColor: i === step ? Colors.primary : Colors.border }
                            ]}
                        />
                    ))}
                </View>

                <View style={styles.textContainer}>
                    <Text style={Typography.h1}>{currentStep.title}</Text>
                    <Text style={[Typography.body, styles.description]}>
                        {currentStep.description}
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Button
                        title={step === STEPS.length - 1 ? "Get Started" : "Next"}
                        onPress={handleNext}
                    />
                    {step < STEPS.length - 1 && (
                        <Button
                            title="Skip"
                            variant="outline"
                            onPress={() => router.push('/(auth)/login')}
                            style={styles.skipButton}
                        />
                    )}
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
        justifyContent: 'space-between',
        paddingVertical: Spacing.xxl,
    },
    stepIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    textContainer: {
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
    },
    description: {
        textAlign: 'center',
        marginTop: Spacing.md,
        color: Colors.textSecondary,
        lineHeight: 24,
    },
    footer: {
        gap: Spacing.md,
    },
    skipButton: {
        marginTop: Spacing.sm,
    }
});
