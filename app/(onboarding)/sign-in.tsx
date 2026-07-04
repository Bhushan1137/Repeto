import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, Pressable } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/context/OnboardingProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/Button';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { Colors, Radius } from '@/constants/theme';

function navigateAfterSignIn(
  router: ReturnType<typeof useRouter>,
  profile: { onboardingComplete?: boolean; profileComplete?: boolean }
) {
  if (profile.onboardingComplete) {
    router.replace('/(tabs)');
  } else if (profile.profileComplete) {
    router.replace('/(onboarding)/categories');
  } else {
    router.replace('/(onboarding)/profile');
  }
}

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SignInScreen() {
  const router = useRouter();
  const { language } = useOnboarding();
  const { signInWithGoogle, user, ready } = useAuth();
  const { translate } = useTranslation(language);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const insets = useSafeAreaInsets();

  // After redirect sign-in, auth state updates and we navigate
  React.useEffect(() => {
    if (ready && user) {
      navigateAfterSignIn(router, user);
    }
  }, [ready, user?.id, user?.onboardingComplete, user?.profileComplete]);

  const handleSignIn = async () => {
    if (!agreed) {
      setError(translate('agreeRequired'));
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    const result = await signInWithGoogle(language);
    setLoading(false);

    if (!result.ok) {
      if (result.error === 'cancelled') return;
      if (result.error === 'redirect_pending') {
        setInfo(result.message ?? translate('redirectingGoogle'));
        return;
      }
      if (result.message?.includes('Firebase Console')) {
        setError(result.message);
        return;
      }
      setError(result.message ?? translate('signInFailed'));
      return;
    }

    if (result.user) {
      navigateAfterSignIn(router, result.user);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 16) + 16,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        },
      ]}
    >
      <OnboardingProgress step={1} />
      <View style={styles.hero}>
        <Surface style={styles.logo} elevation={2}>
          <Text style={styles.logoText}>R</Text>
        </Surface>
        <Text style={styles.title}>{translate('signInTitle')}</Text>
        <Text style={styles.sub}>{translate('signInSub')}</Text>
      </View>

      {info ? <Text style={styles.info}>{info}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.agreeRow}>
        <Pressable onPress={() => setAgreed(!agreed)} style={styles.checkboxContainer} hitSlop={12}>
          <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
            {agreed && <Text style={styles.checkboxCheck}>✓</Text>}
          </View>
        </Pressable>
        <Text style={styles.agreeText}>
          {language === 'hi' ? 'मैं ' : 'I agree to the '}
          <Text style={styles.linkText} onPress={() => router.push('/terms')}>{translate('termsOfService')}</Text>
          {language === 'hi' ? ' और ' : ' and '}
          <Text style={styles.linkText} onPress={() => router.push('/privacy')}>{translate('privacyPolicy')}</Text>
          {language === 'hi' ? ' से सहमत हूँ।' : '.'}
        </Text>
      </View>

      <Button
        title={translate('continueWithGoogle')}
        variant="outline"
        style={[styles.googleBtn, !agreed && { opacity: 0.6 }]}
        loading={loading}
        onPress={handleSignIn}
      />

      {Platform.OS === 'web' ? (
        <Text style={styles.webHint}>{translate('signInWebHint')}</Text>
      ) : null}

      <Button title={translate('backBtn')} variant="ghost" style={{ marginTop: 8 }} onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 56, paddingBottom: 40, backgroundColor: Colors.surfaceMuted },
  hero: { alignItems: 'center', paddingVertical: 32 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 36,
    color: Colors.indigo950,
  },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 24, color: Colors.ink, marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 13.5, color: Colors.inkSoft, textAlign: 'center', lineHeight: 21, maxWidth: 280 },
  info: { color: Colors.tealDeep, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  error: { color: Colors.clayDeep, fontSize: 13, marginBottom: 12, textAlign: 'center', lineHeight: 19 },
  webHint: { fontSize: 11.5, color: Colors.inkFaint, textAlign: 'center', marginTop: 12, lineHeight: 17 },
  googleBtn: { backgroundColor: Colors.white, borderColor: Colors.ivoryLine },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  checkboxContainer: {
    padding: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: Colors.marigoldDeep,
    backgroundColor: Colors.marigold,
  },
  checkboxCheck: {
    color: Colors.white,
    fontSize: 12,
    fontFamily: 'Manrope_800ExtraBold',
    lineHeight: 14,
  },
  agreeText: {
    fontSize: 12.5,
    color: Colors.inkSoft,
    lineHeight: 18,
    flex: 1,
    fontFamily: 'Manrope_500Medium',
  },
  linkText: {
    color: Colors.marigoldDeep,
    fontFamily: 'Manrope_700Bold',
    textDecorationLine: 'underline',
  },
});

