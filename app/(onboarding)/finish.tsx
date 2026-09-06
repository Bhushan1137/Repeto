import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/context/OnboardingProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useTasks } from '@/providers/TaskProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/Button';
import { SettingRow } from '@/components/SettingRow';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { requestNotificationPermission } from '@/services/notifications';
import { Colors } from '@/constants/theme';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FinishScreen() {
  const router = useRouter();
  const { suggestions, pushOptIn, setPushOptIn, language } = useOnboarding();
  const { setLanguage } = useAuth();
  const { completeOnboarding } = useTasks();
  const { showToast } = useToast();
  const { translate } = useTranslation();
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const finish = async () => {
    setLoading(true);
    if (pushOptIn) await requestNotificationPermission();
    const accepted = suggestions.filter((s) => s.accepted);
    await setLanguage(language);
    await completeOnboarding({
      pushOptIn,
      selectedPresets: accepted.map((s) => ({
        title: language === 'hi' ? s.titleHi : s.title,
        category: s.category,
        freq: language === 'hi' ? s.freqHi : s.freq,
        amount: s.amount,
        finance: s.finance,
        icon: s.icon,
      })),
    });
    setLoading(false);
    showToast(translate('tasksAdded', { count: accepted.length }));
    router.replace('/(tabs)');
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
      <OnboardingProgress step={5} />
      <View style={styles.hero}>
        <View style={styles.celebrationBadge}>
          <Text style={styles.emoji}>🎉</Text>
        </View>
        <Text style={styles.title}>
          {language === 'hi' ? 'सब तैयार है!' : 'You’re All Set!'}
        </Text>
        <Text style={styles.sub}>
          {language === 'hi'
            ? `${suggestions.filter((s) => s.accepted).length} कार्य सेट किए गए हैं। अब आपका डैशबोर्ड तैयार है।`
            : `${suggestions.filter((s) => s.accepted).length} repeating tasks created. Your schedule is ready.`}
        </Text>
      </View>

      <View style={styles.settingBox}>
        <SettingRow
          label={translate('pushNotifications')}
          sub={translate('pushNotificationsSub')}
          value={pushOptIn}
          onValueChange={setPushOptIn}
        />
      </View>

      <Button
        title={language === 'hi' ? 'डैशबोर्ड पर जाएं 🚀' : 'Go to Dashboard 🚀'}
        style={styles.cta}
        loading={loading}
        onPress={finish}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 56, paddingBottom: 40, backgroundColor: Colors.surfaceMuted },
  hero: { alignItems: 'center', paddingVertical: 26 },
  celebrationBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    elevation: 2,
  },
  emoji: { fontSize: 36 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 26, color: Colors.ink, marginBottom: 8, textAlign: 'center' },
  sub: { fontFamily: 'Manrope_500Medium', fontSize: 13.5, color: Colors.inkSoft, textAlign: 'center', lineHeight: 21, maxWidth: 300 },
  settingBox: { backgroundColor: Colors.white, borderRadius: 16, padding: 4, marginVertical: 8, elevation: 1 },
  cta: { marginTop: 24, height: 48, borderRadius: 24 },
});

