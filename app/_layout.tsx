import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

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
      <RootLayoutNav />
    </AuthProvider>
  );
}


import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

  // Initialize notifications
  useNotifications();

  useEffect(() => {
    AsyncStorage.getItem('hasCompletedOnboarding')
      .then(value => {
        setHasCompletedOnboarding(value === 'true');
        setIsReady(true);
      })
      .catch(() => {
        setHasCompletedOnboarding(false);
        setIsReady(true);
      });
  }, []);

  useEffect(() => {
    if (!initialized || !isReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === 'onboarding';

    if (!hasCompletedOnboarding && !inOnboardingGroup) {
      // 1. If onboarding not done, force onboarding
      router.replace('/onboarding');
    } else if (hasCompletedOnboarding && !session && !inAuthGroup) {
      // 2. If onboarding done but not logged in, go to login
      router.replace('/(auth)/login');
    } else if (session && (inAuthGroup || inOnboardingGroup)) {
      // 3. If logged in but in auth/onboarding, go home
      router.replace('/(tabs)');
    }
  }, [session, initialized, isReady, hasCompletedOnboarding, segments, router]);

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
