import { useFonts, Fraunces_700Bold, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { Stack, useSegments, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { View, Platform } from 'react-native';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';

import { AppProviders, useAuth } from '@/providers/AppProviders';
import { Colors } from '@/constants/theme';
import { AnimatedSplashScreen } from '@/components/AnimatedSplashScreen';
import { DashboardSkeleton } from '@/components/SkeletonLoader';
import { OfflineBanner } from '@/components/OfflineBanner';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';

export { ErrorBoundary } from 'expo-router';


SplashScreen.preventAutoHideAsync();

const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.marigoldDeep,
    primaryContainer: Colors.marigoldLight,
    secondary: Colors.teal,
    secondaryContainer: Colors.tealLight,
    background: Colors.surfaceMuted,
    surface: Colors.white,
    error: Colors.clay,
    onPrimary: Colors.indigo950,
    onSecondary: Colors.white,
    onBackground: Colors.ink,
    onSurface: Colors.ink,
    outline: Colors.ivoryLine,
  },
};

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;

    const rootSegment = segments[0];
    const isInsideOnboarding = rootSegment === '(onboarding)';
    const isPrivacyOrTerms = rootSegment === 'privacy' || rootSegment === 'terms';
    const currentScreen = segments[segments.length - 1];

    if (isPrivacyOrTerms) return;

    if (!user) {
      // 1. Not logged in: must go to sign-in screen.
      if (!isInsideOnboarding || currentScreen !== 'sign-in') {
        router.replace('/(onboarding)/sign-in');
      }
    } else if (!user.languageSelected) {
      // 2. Logged in, language preference not set: must select language.
      if (!isInsideOnboarding || currentScreen !== 'language') {
        router.replace('/(onboarding)/language');
      }
    } else if (!user.profileComplete) {
      // 3. Logged in, language set, profile not complete: must complete profile.
      if (!isInsideOnboarding || currentScreen !== 'profile') {
        router.replace('/(onboarding)/profile');
      }
    } else if (!user.onboardingComplete) {
      // 4. Logged in, language set, profile complete, onboarding tasks not complete:
      // must be on onboarding categories, suggestions, or finish.
      const allowed = ['categories', 'suggestions', 'finish'];
      if (!isInsideOnboarding || !allowed.includes(currentScreen)) {
        router.replace('/(onboarding)/categories');
      }
    } else {
      // 5. Fully onboarded: cannot access onboarding screens.
      if (isInsideOnboarding) {
        router.replace('/(tabs)');
      }
    }
  }, [ready, user, segments]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.surfaceMuted, paddingTop: 50 }}>
        <DashboardSkeleton />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {

  const [loaded] = useFonts({
    Fraunces_700Bold,
    Fraunces_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [splashComplete, setSplashComplete] = useState(false);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded]);

  if (!loaded) return null;

  if (!splashComplete) {
    return (
      <AnimatedSplashScreen
        onAnimationFinish={() => {
          if (Platform.OS === 'web' && typeof document !== 'undefined') {
            document.fonts.ready.then(() => {
              setSplashComplete(true);
            });
          } else {
            setSplashComplete(true);
          }
        }}
      />
    );
  }

  return (
    <GlobalErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProviders>
          <PaperProvider theme={paperTheme}>
            <NavigationGuard>
              <StatusBar style="dark" />
              <OfflineBanner />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.surfaceMuted } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="presets" options={{ presentation: 'modal' }} />
                <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
                <Stack.Screen name="terms" options={{ presentation: 'modal' }} />
              </Stack>
            </NavigationGuard>
          </PaperProvider>
        </AppProviders>
      </GestureHandlerRootView>
    </GlobalErrorBoundary>
  );
}
