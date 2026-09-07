import React, { useState } from 'react';
import { View, StyleSheet, Alert, Platform, Modal, Pressable, KeyboardAvoidingView, ScrollView } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
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

import { ArchivedTasksSheet } from '@/components/ArchivedTasksSheet';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setLanguage, updateUser, signOut } = useAuth();
  const { tasks, resetTasks } = useTasks();
  const { showToast } = useToast();
  const { translate } = useTranslation();

  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showArchivedSheet, setShowArchivedSheet] = useState(false);
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

  const userLang = user?.language ?? 'en';
  const displayPhone = user?.phone
    ? user.phone.replace(/(\+91\s)(\d{2})\d{4}(\d{4})/, '$1$2••••$3')
    : translate('noPhoneAdded');

  if (!user) {
    return (
      <ScreenShell title={translate('profTitle')} subtitle={translate('profSub')}>
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: Colors.inkSoft }}>Loading profile...</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={translate('profTitle')} subtitle={translate('profSub')}>
      <Card style={styles.heroCard} mode="elevated">
        <LinearGradient colors={[...Gradients.hero]} style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user?.name ?? '')}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} testID="settings-profile-name">{user?.name ?? ''}</Text>
            <Text style={styles.phone} testID="settings-profile-phone">{displayPhone}</Text>
            {user?.userCode && (
              <Pressable
                onPress={() => setShowQrModal(true)}
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}
              >
                <AppIcon name="qr-code-outline" size={14} color={Colors.marigold} />
                <Text style={{ fontSize: 11, fontFamily: 'Manrope_700Bold', color: Colors.marigold }}>
                  {userLang === 'hi' ? 'मेरा क्यूआर / कोड:' : 'My QR / Code:'} {user.userCode}
                </Text>
              </Pressable>
            )}
          </View>
          <TouchableRipple style={styles.editBtn} onPress={handleOpenEdit} testID="settings-profile-edit-btn" borderless>
            <AppIcon name="create-outline" size={20} color={Colors.onDark} />
          </TouchableRipple>
        </LinearGradient>
      </Card>

      <SectionHeader label={translate('language')} />
      <LanguagePicker
        selected={userLang}
        onSelect={handleLanguage}
        options={[
          { code: 'en', label: 'English', native: 'English' },
          { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
        ]}
        testID="settings-language-picker"
      />

      <SectionHeader label={translate('notifications')} />
      <SettingRow
        label={translate('pushNotifications')}
        sub={translate('pushNotificationsSub')}
        value={!!user?.pushOptIn}
        onValueChange={async (v) => {
          if (v) await requestNotificationPermission();
          updateUser({ pushOptIn: v });
        }}
        testID="settings-push-toggle"
      />

      <SectionHeader label={translate('more')} />
      <LinkRow
        label={userLang === 'hi' ? 'आर्काइव किए गए कार्य' : 'Archived Tasks'}
        onPress={() => setShowArchivedSheet(true)}
        testID="settings-archived-link"
      />
      <LinkRow label={translate('manageHousehold')} onPress={() => router.push('/(tabs)/household')} testID="settings-household-link" />
      <LinkRow
        label={userLang === 'hi' ? 'कैलेंडर में एक्सपोर्ट करें' : 'Export tasks to Calendar'}
        onPress={async () => {
          const ok = await exportCalendar(tasks);
          if (ok) {
            showToast(userLang === 'hi' ? 'कैलेंडर फ़ाइल तैयार है!' : 'Calendar exported successfully!');
          } else {
            showToast(translate('saveError'));
          }
        }}
        testID="settings-export-link"
      />
      <LinkRow
        label={translate('helpSupport')}
        onPress={() => router.push('/help-support')}
        testID="settings-support-link"
      />
      <LinkRow
        label={translate('privacyPolicy')}
        onPress={() => router.push('/privacy')}
        testID="settings-privacy-link"
      />
      <LinkRow
        label={translate('termsOfService')}
        onPress={() => router.push('/terms')}
        testID="settings-terms-link"
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
        testID="settings-logout-link"
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
                testID="settings-edit-name-input"
              />

              <FormField
                label={translate('mobileNumberOptional').replace(' (optional)', '').replace(' (वैकल्पिक)', '')}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="98765 43210"
                keyboardType="phone-pad"
                error={errors.phone}
                testID="settings-edit-phone-input"
              />

              {/* Read-only Email Field with Lock Icon */}
              <Text style={styles.readOnlyLabel}>{translate('email')}</Text>
              <View style={styles.readOnlyField} testID="settings-edit-email-container">
                <Text style={styles.readOnlyValue} testID="settings-edit-email-value">{user.email}</Text>
                <AppIcon name="lock-closed-outline" size={16} color={Colors.inkFaint} />
              </View>
              <Text style={styles.readOnlyHint}>{translate('emailFromGoogle')}</Text>

              <Button
                title={user.language === 'hi' ? 'सहेजें' : 'Save Details'}
                onPress={handleSaveProfile}
                loading={saving}
                disabled={saving}
                style={{ marginTop: 24 }}
                testID="settings-edit-save-btn"
              />
              <Button
                title={translate('backBtn')}
                variant="ghost"
                disabled={saving}
                style={{ marginTop: 10, marginBottom: 20 }}
                onPress={() => setShowEditSheet(false)}
                testID="settings-edit-back-btn"
              />
            </ScrollView>
          </Card>
        </KeyboardAvoidingView>
      </Modal>

      {/* Personal Member QR Code Modal */}
      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
        <View style={styles.qrCenteredView}>
          <Pressable style={styles.backdrop} onPress={() => setShowQrModal(false)} />
          <Card style={styles.qrSheet} mode="elevated">
            <Card.Content style={styles.qrContent}>
              <Text style={styles.qrTitle}>
                {user.language === 'hi' ? 'मेरा सदस्य क्यूआर कोड' : 'My Member QR Code'}
              </Text>
              <Text style={styles.qrSub}>
                {user.language === 'hi'
                  ? 'परिवार के एडमिन से कहें कि वे आपको घर में जोड़ने के लिए इस कोड को स्कैन करें।'
                  : 'Show this QR code to a Household Admin to get added to their household.'}
              </Text>
              {user.userCode ? (
                <QRCode
                  value={user.userCode}
                  size={180}
                />
              ) : null}
              <Text style={styles.qrCodeText}>{user.userCode}</Text>
              <Button
                title={user.language === 'hi' ? 'बंद करें' : 'Close'}
                onPress={() => setShowQrModal(false)}
                style={{ width: '90%', marginTop: 8 }}
              />
            </Card.Content>
          </Card>
        </View>
      </Modal>

      <ArchivedTasksSheet
        visible={showArchivedSheet}
        onClose={() => setShowArchivedSheet(false)}
        language={user.language}
      />
    </ScreenShell>
  );
}

function LinkRow({ label, onPress, danger, testID }: { label: string; onPress: () => void; danger?: boolean; testID?: string }) {
  return (
    <Card style={styles.linkCard} mode="elevated" testID={testID}>
      <TouchableRipple onPress={onPress} style={styles.linkRipple} testID={testID ? `${testID}-ripple` : undefined} borderless>
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
  qrCenteredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrSheet: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    width: 300,
    elevation: 8,
    overflow: 'hidden',
  },
  qrContent: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 12,
  },
  qrTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
    color: Colors.ink,
    textAlign: 'center',
  },
  qrSub: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    color: Colors.inkSoft,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 4,
  },
  qrCodeText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 20,
    color: Colors.marigoldDeep,
    letterSpacing: 2,
  },
});
