import React from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/providers/AuthProvider';
import { useTasks } from '@/providers/TaskProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { SettingRow, LanguagePicker } from '@/components/SettingRow';
import { ScreenShell, SectionHeader } from '@/components/ScreenShell';
import { Colors, Gradients, Radius, Typography } from '@/constants/theme';
import { initials } from '@/domain/insights';
import { requestNotificationPermission } from '@/services/notifications';
import type { Language } from '@/types';
import { exportCalendar } from '@/services/calendarExport';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setLanguage, updateUser, signOut } = useAuth();
  const { tasks, resetTasks } = useTasks();
  const { showToast } = useToast();
  const { translate } = useTranslation();

  if (!user) return null;

  const handleLanguage = async (code: string) => {
    await setLanguage(code as Language);
    showToast(code === 'hi' ? translate('languageSwitchedHi') : translate('languageSwitched'));
  };

  const displayPhone = user.phone
    ? user.phone.replace(/(\+91\s)(\d{2})\d{4}(\d{4})/, '$1$2••••$3')
    : translate('noPhoneAdded');

  return (
    <ScreenShell title={translate('profTitle')} subtitle={user.email}>
      <Card style={styles.heroCard} mode="elevated">
        <LinearGradient colors={[...Gradients.hero]} style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.phone}>{displayPhone}</Text>
          </View>
        </LinearGradient>
      </Card>

      <SectionHeader label={translate('language')} />
      <LanguagePicker
        selected={user.language}
        onSelect={handleLanguage}
        options={[
          { code: 'en', label: 'English', native: 'English' },
          { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
        ]}
      />

      <SectionHeader label={translate('notifications')} />
      <SettingRow
        label={translate('pushNotifications')}
        sub={translate('pushNotificationsSub')}
        value={user.pushOptIn}
        onValueChange={async (v) => {
          if (v) await requestNotificationPermission();
          updateUser({ pushOptIn: v });
        }}
      />

      <SectionHeader label={translate('more')} />
      <LinkRow label={translate('manageHousehold')} onPress={() => router.push('/(tabs)/household')} />
      <LinkRow
        label={user.language === 'hi' ? 'कैलेंडर में एक्सपोर्ट करें' : 'Export tasks to Calendar'}
        onPress={async () => {
          const ok = await exportCalendar(tasks);
          if (ok) {
            showToast(user.language === 'hi' ? 'कैलेंडर फ़ाइल तैयार है!' : 'Calendar exported successfully!');
          } else {
            showToast(translate('saveError'));
          }
        }}
      />
      <LinkRow
        label={translate('helpSupport')}
        onPress={() => Linking.openURL('mailto:support@repeato.app?subject=Repeato%20Support')}
      />
      <LinkRow
        label={translate('privacyPolicy')}
        onPress={() => router.push('/privacy')}
      />
      <LinkRow
        label={translate('termsOfService')}
        onPress={() => router.push('/terms')}
      />
      <LinkRow
        label={translate('logOut')}
        danger
        onPress={async () => {
          await signOut();
          resetTasks();
          router.replace('/(onboarding)/language');
        }}
      />
    </ScreenShell>
  );
}

function LinkRow({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Card style={styles.linkCard} mode="elevated">
      <TouchableRipple onPress={onPress} style={styles.linkRipple} borderless>
        <View style={styles.linkInner}>
          <Text style={[styles.linkLabel, danger && styles.danger]}>{label}</Text>
          <Text style={styles.linkArrow}>›</Text>
        </View>
      </TouchableRipple>
    </Card>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: 14,
    elevation: 2,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(251,247,239,0.3)',
  },
  avatarText: { fontFamily: 'Fraunces_700Bold', fontSize: 22, color: Colors.indigo950 },
  name: { fontFamily: 'Manrope_800ExtraBold', fontSize: 17, color: Colors.onDark },
  phone: { ...Typography.caption, color: Colors.onDarkMuted, marginTop: 4 },
  linkCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    marginBottom: 8,
    elevation: 1,
    overflow: 'hidden',
  },
  linkRipple: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  linkInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkLabel: { ...Typography.title, fontSize: 14, color: Colors.ink },
  linkArrow: { fontSize: 20, color: Colors.inkFaint },
  danger: { color: Colors.clayDeep },
});
