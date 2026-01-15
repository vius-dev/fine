import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type OnboardingContextType = {
    hasCompletedOnboarding: boolean | null; // null means loading
    completeOnboarding: () => Promise<void>;
    resetOnboarding: () => Promise<void>; // Useful for testing
};

const OnboardingContext = createContext<OnboardingContextType>({
    hasCompletedOnboarding: null,
    completeOnboarding: async () => { },
    resetOnboarding: async () => { },
});

export const useOnboarding = () => useContext(OnboardingContext);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

    useEffect(() => {
        checkOnboardingStatus();
    }, []);

    const checkOnboardingStatus = async () => {
        try {
            const value = await AsyncStorage.getItem('hasCompletedOnboarding');
            setHasCompletedOnboarding(value === 'true');
        } catch (error) {
            console.error('Failed to check onboarding status:', error);
            setHasCompletedOnboarding(false);
        }
    };

    const completeOnboarding = async () => {
        try {
            await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
            setHasCompletedOnboarding(true);
        } catch (error) {
            console.error('Failed to complete onboarding:', error);
        }
    };

    const resetOnboarding = async () => {
        try {
            await AsyncStorage.removeItem('hasCompletedOnboarding');
            setHasCompletedOnboarding(false);
        } catch (error) {
            console.error('Failed to reset onboarding:', error);
        }
    };

    return (
        <OnboardingContext.Provider value={{ hasCompletedOnboarding, completeOnboarding, resetOnboarding }}>
            {children}
        </OnboardingContext.Provider>
    );
};
