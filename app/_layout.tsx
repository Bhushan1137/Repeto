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
import { useEffect, useState, useRef, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { View, Platform, StyleSheet, AppState } from 'react-native';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';

import { AppProviders, useAuth } from '@/providers/AppProviders';
import { Colors } from '@/constants/theme';
import { AnimatedSplashScreen } from '@/components/AnimatedSplashScreen';
import { DashboardSkeleton } from '@/components/SkeletonLoader';
import { OfflineBanner } from '@/components/OfflineBanner';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { AlarmOverlay } from '@/components/AlarmOverlay';
import { checkAndSendHeartbeat } from '@/services/heartbeatService';

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
  const { ready, user, deletedAccountInfo, updateUser } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const inFlightTargetRef = useRef<string | null>(null);

  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;
  const userRef = useRef(user);
  userRef.current = user;

  // Heartbeat & presence tracking (once per day gate + version check, minimal Firestore writes)
  useEffect(() => {
    if (!ready || !user?.id || user.isDeleted || deletedAccountInfo) return;

    checkAndSendHeartbeat(userRef.current, (patch) => updateUserRef.current(patch));

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkAndSendHeartbeat(userRef.current, (patch) => updateUserRef.current(patch));
      }
    });

    return () => {
      subscription.remove();
    };
  }, [ready, user?.id, user?.isDeleted, !!deletedAccountInfo]);

  const safeReplace = useCallback(
    (target: string) => {
      if (inFlightTargetRef.current === target) return;
      inFlightTargetRef.current = target;
      router.replace(target as unknown as Parameters<typeof router.replace>[0]);
    },
    [router]
  );

  useEffect(() => {
    if (!ready) return;

    const rootSegment = segments[0];
    const isInsideOnboarding = rootSegment === '(onboarding)';
    const isPrivacyOrTerms = rootSegment === 'privacy' || rootSegment === 'terms';
    const isStandaloneModal =
      rootSegment === 'help-support' ||
      rootSegment === 'notifications' ||
      rootSegment === 'presets';
    const currentScreen = segments[segments.length - 1];

    // Reset inFlightTarget if we have arrived at the destination
    if (inFlightTargetRef.current && (currentScreen === inFlightTargetRef.current.split('/').pop() || (rootSegment === '(tabs)' && inFlightTargetRef.current === '/(tabs)'))) {
      inFlightTargetRef.current = null;
    }

    if (isPrivacyOrTerms) return;

    // 0. Soft-deleted account detected -> MUST be on account-recovery
    if (deletedAccountInfo) {
      if (!isInsideOnboarding || currentScreen !== 'account-recovery') {
        safeReplace('/(onboarding)/account-recovery');
      }
      return;
    }

    // 1. Not logged in -> MUST be on sign-in or language (allow help-support for FAQs)
    if (!user) {
      if (rootSegment === 'help-support') return;
      const isAllowedUnauthScreen = currentScreen === 'sign-in' || currentScreen === 'language';
      if (!isInsideOnboarding || !isAllowedUnauthScreen) {
        safeReplace('/(onboarding)/sign-in');
      }
      return;
    }

    // 2. Fully onboarded -> MUST NOT be in onboarding (go to tabs if not already on tabs or standalone screen)
    const isFullyOnboarded = !!(user.languageSelected && user.profileComplete && user.onboardingComplete);
    if (isFullyOnboarded) {
      if (rootSegment !== '(tabs)' && !isStandaloneModal) {
        safeReplace('/(tabs)');
      }
      return;
    }

    // 3. Logged in, NOT fully onboarded:
    // A) If outside onboarding (e.g. at root "/" or trying to open tabs):
    //    route them into onboarding where they left off
    if (!isInsideOnboarding && !isStandaloneModal) {
      if (!user.languageSelected) {
        safeReplace('/(onboarding)/language');
      } else if (!user.profileComplete) {
        safeReplace('/(onboarding)/profile');
      } else {
        safeReplace('/(onboarding)/categories');
      }
      return;
    }

    // B) If inside onboarding on sign-in or account-recovery, but now logged in:
    //    route them into onboarding where they left off
    if (currentScreen === 'sign-in' || currentScreen === 'account-recovery') {
      if (!user.languageSelected) {
        safeReplace('/(onboarding)/language');
      } else if (!user.profileComplete) {
        safeReplace('/(onboarding)/profile');
      } else {
        safeReplace('/(onboarding)/categories');
      }
      return;
    }

    // C) If user is already on an active onboarding screen (language, profile, categories, suggestions, finish):
    //    Do not interfere — let screen transitions and back buttons work cleanly without double navigation.
  }, [
    ready,
    user?.id,
    user?.languageSelected,
    user?.profileComplete,
    user?.onboardingComplete,
    deletedAccountInfo,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    segments.join('/'),
    safeReplace,
  ]);

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

  if (!loaded) {
    return null;
  }

  return (
    <GlobalErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProviders>
          <PaperProvider theme={paperTheme}>
            <NavigationGuard>
              <StatusBar style="dark" />
              <OfflineBanner />
              <AlarmOverlay />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.surfaceMuted } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="help-support" options={{ presentation: 'modal' }} />
                <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
                <Stack.Screen name="presets" options={{ presentation: 'modal' }} />
                <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
                <Stack.Screen name="terms" options={{ presentation: 'modal' }} />
              </Stack>
            </NavigationGuard>
          </PaperProvider>
        </AppProviders>

        {!splashComplete && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents={splashComplete ? 'none' : 'auto'}>
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
          </View>
        )}
      </GestureHandlerRootView>
    </GlobalErrorBoundary>
  );
}
