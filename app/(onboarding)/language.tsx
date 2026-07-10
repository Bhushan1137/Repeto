import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/context/OnboardingProvider';
import { useTranslation } from '@/hooks/useTranslation';
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
  const { setLanguage: setAuthLanguage } = useAuth();
  const { translate } = useTranslation(language);
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
    >
      <OnboardingProgress step={1} />
      <View style={styles.hero}>
        <ProgressRing percent={100} color={Colors.marigold} size={72} stroke={6} />
        <Text style={styles.heroTitle}>{translate('obWelcomeTitle')}</Text>
        <Text style={styles.heroSub}>
          {language === 'hi'
            ? 'वह भाषा चुनें जिसमें Repeato आपसे बात करे — आप इसे कभी भी बदल सकते हैं।'
            : 'Choose the language Repeato should speak to you in — you can change this anytime.'}
        </Text>
      </View>

      <LanguagePicker
        selected={language}
        onSelect={(code) => {
          setLanguage(code as Language);
          setAuthLanguage(code as Language);
        }}
        options={[
          { code: 'en', label: 'English', native: 'English' },
          { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
        ]}
      />

      <Button
        title={translate('continueBtn')}
        style={styles.cta}
        onPress={async () => {
          await setAuthLanguage(language);
          router.replace('/(onboarding)/profile');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 56, paddingBottom: 40, backgroundColor: Colors.surfaceMuted },
  hero: { alignItems: 'center', paddingVertical: 26 },
  heroTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 24,
    color: Colors.ink,
    marginTop: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSub: { fontSize: 13.5, color: Colors.inkSoft, textAlign: 'center', lineHeight: 21, maxWidth: 280 },
  cta: { marginTop: 22 },
});

