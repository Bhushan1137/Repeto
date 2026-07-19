import React, { useState } from 'react';
import { View, StyleSheet, Linking, Alert, Platform, Modal, Pressable, KeyboardAvoidingView, ScrollView } from 'react-native';
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
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { validateName, validatePhone, formatPhone } from '@/domain/validation';
import type { Language } from '@/types';
import { exportCalendar } from '@/services/calendarExport';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setLanguage, updateUser, signOut } = useAuth();
  const { tasks, resetTasks } = useTasks();
  const { showToast } = useToast();
  const { translate } = useTranslation();

  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editName, setEditName] = useState(user?.name ?? '');
  const [editPhone, setEditPhone] = useState(user?.phone?.replace('+91 ', '') ?? '');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleLanguage = async (code: string) => {
    await setLanguage(code as Language);
    showToast(code === 'hi' ? translate('languageSwitchedHi') : translate('languageSwitched'));
  };

  const handleOpenEdit = () => {
    setEditName(user.name ?? '');
    setEditPhone(user.phone?.replace('+91 ', '') ?? '');
    setErrors({});
    setShowEditSheet(true);
  };

  const handleSaveProfile = async () => {
    const nameResult = validateName(editName);
    const nextErrors: typeof errors = {};

    if (!nameResult.valid && nameResult.error) {
      nextErrors.name = translate(nameResult.error as any);
    }

    const phoneResult = validatePhone(editPhone);
    if (!phoneResult.valid && phoneResult.error) {
      nextErrors.phone = translate(phoneResult.error as any);
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const formatted = formatPhone(editPhone);
      await updateUser({
        name: editName.trim(),
        phone: formatted,
      });
      showToast(user.language === 'hi' ? 'प्रोफ़ाइल सहेजी गई!' : 'Profile updated successfully!');
      setShowEditSheet(false);
    } catch (err) {
      console.warn('[Repeato] Profile update failed:', err);
      showToast(translate('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const displayPhone = user.phone
    ? user.phone.replace(/(\+91\s)(\d{2})\d{4}(\d{4})/, '$1$2••••$3')
    : translate('noPhoneAdded');

  return (
    <ScreenShell title={translate('profTitle')} subtitle={translate('profSub')}>
      <Card style={styles.heroCard} mode="elevated">
        <LinearGradient colors={[...Gradients.hero]} style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.phone}>{displayPhone}</Text>
          </View>
          <TouchableRipple style={styles.editBtn} onPress={handleOpenEdit} borderless>
            <AppIcon name="create-outline" size={20} color={Colors.onDark} />
          </TouchableRipple>
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
        onPress={() => router.push('/help-support')}
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
        onPress={() => {
          const performLogout = async () => {
            await signOut();
            resetTasks();
          };
          if (Platform.OS === 'web') {
            if (window.confirm(user.language === 'hi' ? 'क्या आप वाकई लॉग आउट करना चाहते हैं?' : 'Are you sure you want to log out?')) {
              performLogout();
            }
          } else {
            Alert.alert(
              user.language === 'hi' ? 'लॉग आउट करें' : 'Log Out',
              user.language === 'hi' ? 'क्या आप वाकई लॉग आउट करना चाहते हैं?' : 'Are you sure you want to log out?',
              [
                { text: user.language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
                {
                  text: user.language === 'hi' ? 'लॉग आउट' : 'Log Out',
                  style: 'destructive',
                  onPress: performLogout,
                },
              ]
            );
          }
        }}
      />

      {/* Edit Profile Bottom Sheet Modal */}
      <Modal visible={showEditSheet} transparent animationType="slide" onRequestClose={() => setShowEditSheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContainer}>
          <Pressable style={styles.backdrop} onPress={() => setShowEditSheet(false)} />
          <Card style={styles.sheet} mode="elevated">
            <View style={styles.modalHandle} />
            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>
                {user.language === 'hi' ? 'प्रोफ़ाइल संपादित करें' : 'Edit Profile'}
              </Text>
              <Text style={styles.sheetSub}>
                {user.language === 'hi' ? 'अपने खाते का विवरण अपडेट करें।' : 'Update your account details.'}
              </Text>

              <FormField
                label={translate('fullName')}
                value={editName}
                onChangeText={setEditName}
                placeholder={translate('fullNamePlaceholder')}
                error={errors.name}
              />

              <FormField
                label={translate('mobileNumberOptional').replace(' (optional)', '').replace(' (वैकल्पिक)', '')}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="98765 43210"
                keyboardType="phone-pad"
                error={errors.phone}
              />

              {/* Read-only Email Field with Lock Icon */}
              <Text style={styles.readOnlyLabel}>{translate('email')}</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyValue}>{user.email}</Text>
                <AppIcon name="lock-closed-outline" size={16} color={Colors.inkFaint} />
              </View>
              <Text style={styles.readOnlyHint}>{translate('emailFromGoogle')}</Text>

              <Button
                title={user.language === 'hi' ? 'सहेजें' : 'Save Details'}
                onPress={handleSaveProfile}
                loading={saving}
                disabled={saving}
                style={{ marginTop: 24 }}
              />
              <Button
                title={translate('backBtn')}
                variant="ghost"
                disabled={saving}
                style={{ marginTop: 10, marginBottom: 20 }}
                onPress={() => setShowEditSheet(false)}
              />
            </ScrollView>
          </Card>
        </KeyboardAvoidingView>
      </Modal>
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
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
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
  // Modal layout
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(23, 27, 54, 0.45)',
  },
  sheet: {
    backgroundColor: Colors.surfaceMuted,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: '90%',
    elevation: 16,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.ivoryLine,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetBody: {
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'Fraunces_700Bold',
    color: Colors.ink,
    marginTop: 6,
    marginBottom: 2,
  },
  sheetSub: {
    fontSize: 12.5,
    color: Colors.inkSoft,
    marginBottom: 18,
    fontFamily: 'Manrope_400Regular',
  },
  readOnlyLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    opacity: 0.8,
  },
  readOnlyValue: {
    fontSize: 13.5,
    color: Colors.inkSoft,
    fontFamily: 'Manrope_600SemiBold',
  },
  readOnlyHint: {
    fontSize: 10,
    color: Colors.inkFaint,
    marginTop: 4,
    fontFamily: 'Manrope_500Medium',
  },
});
