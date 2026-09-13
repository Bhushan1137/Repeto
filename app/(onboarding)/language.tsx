import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/context/OnboardingProvider';
import { Button } from '@/components/Button';
import { LanguagePicker } from '@/components/SettingRow';
import { ProgressRing } from '@/components/ProgressRing';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { Colors } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Language } from '@/types';
import { useAuth } from '@/providers/AuthProvider';

export default function LanguageScreen() {
  const router = useRouter();
  const { language, setLanguage } = useOnboarding();
  const { setLanguage: setAuthLanguage, user } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 16) + 16,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        },
      ]}
      showsVerticalScrollIndicator={false}
      testID="language-screen-scroll"
    >
      <OnboardingProgress step={1} />
      <View style={styles.hero} testID="language-hero-container">
        <ProgressRing percent={100} color={Colors.marigold} size={72} stroke={6} />
        <Text style={styles.heroTitle}>
          {language === 'hi' ? 'भाषा का चयन करें' : 'Choose Your Language'}
        </Text>
        <Text style={styles.heroSub}>
          {language === 'hi'
            ? 'वह भाषा चुनें जिसमें Repeto आपसे बात करे — आप इसे कभी भी बदल सकते हैं।'
            : 'Select your preferred language for reminders and navigation — you can update this anytime in Settings.'}
        </Text>
      </View>

      <View style={styles.pickerCard}>
        <LanguagePicker
          selected={language}
          onSelect={(code) => {
            setLanguage(code as Language);
            setAuthLanguage(code as Language);
          }}
          options={[
            { code: 'en', label: 'English', native: 'English (US/IN)' },
            { code: 'hi', label: 'Hindi', native: 'हिन्दी (Hindi)' },
          ]}
          testID="language-picker"
        />
      </View>

      <Button
        title={language === 'hi' ? 'आगे बढ़ें →' : 'Continue with English →'}
        style={styles.cta}
        onPress={async () => {
          await setAuthLanguage(language);
          if (!user) {
            router.replace('/(onboarding)/sign-in');
          } else {
            router.replace('/(onboarding)/profile');
          }
        }}
        testID="language-continue-btn"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 56, paddingBottom: 40, backgroundColor: Colors.surfaceMuted },
  hero: { alignItems: 'center', paddingVertical: 26 },
  heroTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 26,
    color: Colors.ink,
    marginTop: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13.5,
    color: Colors.inkSoft,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },
  pickerCard: {
    marginVertical: 12,
  },
  cta: { marginTop: 22, height: 48, borderRadius: 24 },
});

