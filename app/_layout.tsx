import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import 'react-native-reanimated';
import '../src/i18n';

// Ignore specific warning: expo-notifications functionality removed in Expo Go SDK 53
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
]);

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
import { useNotifications } from '../src/hooks/useNotifications';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

import { OnboardingProvider, useOnboarding } from '../src/hooks/useOnboarding';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <OnboardingProvider>
        <RootLayoutNav />
      </OnboardingProvider>
    </AuthProvider>
  );
}


import { useTimezoneDetection } from '@/src/hooks/useTimezoneDetection';
import { useState } from 'react';

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, initialized } = useAuth();
  const { hasCompletedOnboarding } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // Initialize notifications
  useNotifications();

  // Initialize timezone detection
  useTimezoneDetection();

  // Simple readiness check - wait for both auth and onboarding to load
  useEffect(() => {
    if (initialized && hasCompletedOnboarding !== null) {
      setIsReady(true);
    }
  }, [initialized, hasCompletedOnboarding]);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === 'onboarding';

    if (!hasCompletedOnboarding) {
      // If we haven't completed onboarding, always go to onboarding
      if (!inOnboardingGroup) {
        router.replace('/onboarding');
      }
    } else {
      // Onboarding is complete
      if (inOnboardingGroup) {
        // If we are still in onboarding group loop, get out
        // Determine where to go based on auth
        if (!session) {
          router.replace('/(auth)/login');
        } else {
          router.replace('/(tabs)');
        }
      } else if (!session) {
        // Not in onboarding, no session -> login
        if (!inAuthGroup) {
          router.replace('/(auth)/login');
        }
      } else if (session) {
        // Has session -> tabs
        if (inAuthGroup) {
          router.replace('/(tabs)');
        }
      }
    }
  }, [session, isReady, hasCompletedOnboarding, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
