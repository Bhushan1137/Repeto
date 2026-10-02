import { AppIcon } from '@/components/AppIcon';
import { ArchivedTasksSheet } from '@/components/ArchivedTasksSheet';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { GroupedSettingCard, SettingItem } from '@/components/profile/GroupedSettingCard';
import { MemberPassModal } from '@/components/profile/MemberPassModal';
import { PresetLibrarySheet } from '@/components/profile/PresetLibrarySheet';
import { ManageCategoriesSheet } from '@/components/category/ManageCategoriesSheet';
import { ScreenShell, SectionHeader } from '@/components/ScreenShell';
import { Toggle } from '@/components/Toggle';
import { Colors, Radius, Shadows, Typography } from '@/constants/theme';
import { initials } from '@/domain/insights';
import { formatPhone, validateName, validatePhone } from '@/domain/validation';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/providers/AuthProvider';
import { useTasks } from '@/providers/TaskProvider';
import { useToast } from '@/providers/ToastProvider';
import { exportCalendar } from '@/services/calendarExport';
import { cancelAllNotifications, requestNotificationPermission, scheduleTaskReminder } from '@/services/notifications';
import type { Language } from '@/types';
import { getAppVersionLabel } from '@/utils/version';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Card, Text, TouchableRipple } from 'react-native-paper';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.repeto.tasks';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, activeHousehold, setLanguage, updateUser, signOut, deleteAccount } = useAuth();
  const { tasks, archivedTasks, resetTasks } = useTasks();
  const { showToast } = useToast();
  const { translate } = useTranslation();

  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showArchivedSheet, setShowArchivedSheet] = useState(false);
  const [showPresetLibrary, setShowPresetLibrary] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editName, setEditName] = useState(user?.name ?? '');
  const [editPhone, setEditPhone] = useState(user?.phone?.replace('+91 ', '') ?? '');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteReasonModal, setShowDeleteReasonModal] = useState(false);
  const [selectedDeleteReason, setSelectedDeleteReason] = useState<string | null>(null);

  const userLang = user?.language ?? 'en';
  const isHi = userLang === 'hi';

  const handleLanguage = async (code: string) => {
    if (code === userLang) return;
    await setLanguage(code as Language);
    showToast(code === 'hi' ? translate('languageSwitchedHi') : translate('languageSwitched'));
  };

  const handleShareApp = async () => {
    try {
      const codeSnippet = user?.userCode ? `\n(My code: ${user.userCode})` : '';
      const message = isHi
        ? `हे! मैं आवर्ती कार्यों, आदतों और घर के कामों को ट्रैक करने के लिए Repeto का उपयोग कर रहा हूँ। इसे आज़माएं:\n👉 डाउनलोड करें: ${PLAY_STORE_URL}${user?.userCode ? `\n(मेरा कोड: ${user.userCode})` : ''}`
        : `Hey! I'm using Repeto to track repeating chores, habits, and household tasks. It makes staying on track super easy!\n👉 Download Repeto: ${PLAY_STORE_URL}${codeSnippet}`;

      await Share.share({
        title: isHi ? 'Repeto ऐप शेयर करें' : 'Invite Friends to Repeto',
        message,
      });
    } catch {
      // Ignored
    }
  };

  const handleOpenEdit = () => {
    setEditName(user?.name ?? '');
    setEditPhone(user?.phone?.replace('+91 ', '') ?? '');
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
      showToast(isHi ? 'प्रोफ़ाइल सहेजी गई!' : 'Profile updated successfully!');
      setShowEditSheet(false);
    } catch (err) {
      console.warn('[Repeato] Profile update failed:', err);
      showToast(translate('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const [showDeletedNoticeModal, setShowDeletedNoticeModal] = useState(false);
  const deleteModalResolverRef = useRef<(() => void) | null>(null);

  const executeDelete = async (reason: string) => {
    setDeleting(true);
    try {
      const res = await deleteAccount(reason, async () => {
        setDeleting(false);
        setShowDeletedNoticeModal(true);
        await new Promise<void>((resolve) => {
          deleteModalResolverRef.current = resolve;
          // Generous timeout fallback so modal doesn't prematurely disappear while reading
          setTimeout(() => {
            if (deleteModalResolverRef.current) {
              deleteModalResolverRef.current();
              deleteModalResolverRef.current = null;
            }
          }, 60000);
        });
      });
      if (!res.ok) {
        showToast(translate('deleteAccountError'));
        setDeleting(false);
        return;
      }
      resetTasks();
    } catch {
      showToast(translate('deleteAccountError'));
      setDeleting(false);
    }
  };

  const handleDismissDeletedNotice = () => {
    setShowDeletedNoticeModal(false);
    if (deleteModalResolverRef.current) {
      deleteModalResolverRef.current();
      deleteModalResolverRef.current = null;
    }
  };

  const renderRecoveryNoticeModal = () => (
    <Modal
      visible={showDeletedNoticeModal}
      transparent
      animationType="fade"
      onRequestClose={handleDismissDeletedNotice}
    >
      <View style={styles.noticeModalBackdrop} testID="delete-recovery-notice-modal">
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismissDeletedNotice} />
        <Card style={styles.noticeModalCard} mode="elevated">
          <View style={styles.noticeIconCircle}>
            <AppIcon name="shield-checkmark" size={36} color={Colors.tealDeep} />
          </View>
          <Text style={styles.noticeModalTitle}>
            {translate('deleteAccountPopupTitle')}
          </Text>
          <View style={styles.graceBadge}>
            <AppIcon name="time-outline" size={16} color={Colors.marigoldDeep} />
            <Text style={styles.graceBadgeText}>
              {isHi ? '30 दिन की रिकवरी अवधि' : '30-Day Recovery Window'}
            </Text>
          </View>
          <Text style={styles.noticeModalBody}>
            {translate('deleteAccountRecoveryNotice')}
          </Text>
          <Button
            title={translate('deleteAccountPopupBtn')}
            onPress={handleDismissDeletedNotice}
            style={styles.noticeModalBtn}
            testID="delete-recovery-popup-ok-btn"
          />
        </Card>
      </View>
    </Modal>
  );

  // Activity stats calculation
  const stats = useMemo(() => {
    const activeTasksCount = tasks.length;
    let completedCount = 0;
    let onTimeCount = 0;

    for (const t of tasks) {
      for (const h of t.history ?? []) {
        if (h.status === 'on_time' || h.status === 'late') {
          completedCount += 1;
          if (h.status === 'on_time') onTimeCount += 1;
        }
      }
    }

    const onTimeRate = completedCount > 0 ? Math.round((onTimeCount / completedCount) * 100) : 100;
    return {
      activeTasks: activeTasksCount,
      onTimeRate,
      householdName: activeHousehold?.name || (isHi ? 'व्यक्तिगत' : 'Personal'),
      householdIcon: activeHousehold?.icon || '🏠',
    };
  }, [tasks, activeHousehold, isHi]);

  const displayPhone = user?.phone
    ? user.phone.replace(/(\+91\s)(\d{2})\d{4}(\d{4})/, '$1$2••••$3')
    : translate('noPhoneAdded');

  if (!user) {
    return (
      <ScreenShell title={translate('profTitle')} subtitle={translate('profSub')}>
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: Colors.inkSoft }}>Loading profile...</Text>
        </View>
        {renderRecoveryNoticeModal()}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={translate('profTitle')} subtitle={translate('profSub')}>
      {/* ── 1. Executive Profile Hero Card ── */}
      <Card style={styles.heroCard} mode="elevated">
        <LinearGradient colors={[Colors.indigo950, Colors.indigo900, '#252B52']} style={styles.hero}>
          <View style={styles.heroTopRow}>
            {/* Avatar with golden border */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(user.name ?? 'User')}</Text>
            </View>

            <View style={styles.identityCol}>
              <View style={styles.nameRow}>
                <Text style={styles.name} testID="settings-profile-name" numberOfLines={1}>
                  {user.name ?? ''}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <AppIcon name="call-outline" size={12} color={Colors.onDarkMuted} />
                <Text style={styles.phone} testID="settings-profile-phone">
                  {displayPhone}
                </Text>
              </View>

              {user.email ? (
                <View style={styles.metaRow}>
                  <AppIcon name="mail-outline" size={12} color={Colors.onDarkMuted} />
                  <Text style={styles.email} numberOfLines={1}>
                    {user.email}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Edit Button */}
            <TouchableRipple
              style={styles.editBtn}
              onPress={handleOpenEdit}
              testID="settings-profile-edit-btn"
              borderless
            >
              <AppIcon name="create-outline" size={18} color={Colors.onDark} />
            </TouchableRipple>
          </View>

          {/* Member Code Badge Pill */}
          {user.userCode ? (
            <TouchableRipple
              onPress={() => setShowPassModal(true)}
              style={styles.memberPassPill}
              borderless
            >
              <View style={styles.memberPassContent}>
                <AppIcon name="qr-code-outline" size={14} color={Colors.marigold} />
                <Text style={styles.memberPassLabel}>
                  {isHi ? 'मेरा क्यूआर कोड:' : 'My QR Code:'}{' '}
                  <Text style={styles.memberPassCode}>{user.userCode}</Text>
                </Text>
                <AppIcon name="chevron-forward" size={13} color={Colors.marigold} />
              </View>
            </TouchableRipple>
          ) : null}
        </LinearGradient>
      </Card>

      {/* ── 2. Quick Activity Stats Strip ── */}
      <Card style={styles.statsCard} mode="elevated">
        <View style={styles.statsRow}>
          {/* Active Tasks */}
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{stats.activeTasks}</Text>
            <Text style={styles.statLabel}>{translate('activeTasks')}</Text>
          </View>

          <View style={styles.statDivider} />

          {/* On-Time Reliability */}
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{stats.onTimeRate}%</Text>
            <Text style={styles.statLabel}>{translate('onTimeRate')}</Text>
          </View>

          <View style={styles.statDivider} />

          {/* Household Context Shortcut */}
          <TouchableRipple
            style={[styles.statCol, styles.householdStatCol]}
            onPress={() => router.push('/(tabs)/household')}
            borderless
          >
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statValue} numberOfLines={1}>
                {stats.householdIcon} {stats.householdName}
              </Text>
              <Text style={styles.statLabel}>{translate('householdLabel')}</Text>
            </View>
          </TouchableRipple>
        </View>
      </Card>

      {/* ── Referral / Invite Friends Banner ── */}
      <Card style={styles.referralCard} mode="elevated">
        <View style={styles.referralInner}>
          <View style={styles.referralIconCircle}>
            <AppIcon name="gift" size={20} color={Colors.marigoldDeep} />
          </View>
          <View style={styles.referralTextCol}>
            <Text style={styles.referralTitle}>{translate('inviteFriendsTitle')}</Text>
            <Text style={styles.referralSubtitle}>{translate('inviteFriendsSub')}</Text>
          </View>
          <TouchableRipple
            style={styles.referralBtn}
            onPress={handleShareApp}
            borderless
            testID="profile-invite-friends-btn"
          >
            <View style={styles.referralBtnContent}>
              <AppIcon name="share-social-outline" size={13} color={Colors.white} />
              <Text style={styles.referralBtnText}>{translate('inviteFriendsBtn')}</Text>
            </View>
          </TouchableRipple>
        </View>
      </Card>

      {/* ── 3. Section: Preferences ── */}
      <SectionHeader label={translate('preferences')} />
      <GroupedSettingCard>
        {/* Push Notifications Toggle */}
        <SettingItem
          icon="notifications-outline"
          iconColor={Colors.indigo900}
          iconBg="rgba(30, 36, 68, 0.08)"
          title={translate('pushNotifications')}
          subtitle={translate('pushNotificationsSub')}
          rightElement={
            <Toggle
              value={!!user?.pushOptIn}
              onValueChange={async (v) => {
                if (v) {
                  const granted = await requestNotificationPermission();
                  if (!granted) {
                    showToast(
                      isHi
                        ? 'सूचनाएं फ़ोन सेटिंग्स में बंद हैं। कृपया अनुमति दें।'
                        : 'Notifications are disabled in device settings. Please enable them.'
                    );
                    await updateUser({ pushOptIn: false });
                    return;
                  }
                  await updateUser({ pushOptIn: true });
                  for (const t of tasks) {
                    if (!t.archived) scheduleTaskReminder(t).catch(() => {});
                  }
                  showToast(isHi ? 'सूचनाएं चालू कर दी गई हैं' : 'Notifications enabled');
                } else {
                  await updateUser({ pushOptIn: false });
                  await cancelAllNotifications();
                  showToast(isHi ? 'सूचनाएं बंद कर दी गई हैं' : 'Notifications disabled');
                }
              }}
              testID="settings-push-toggle"
            />
          }
          showChevron={false}
          testID="settings-push-row"
        />

        {/* Inline Segmented Language Selector */}
        <SettingItem
          icon="globe-outline"
          iconColor={Colors.tealDeep}
          iconBg="rgba(62, 124, 106, 0.12)"
          title={translate('language')}
          rightElement={
            <View style={styles.langSegment} testID="settings-language-picker">
              <Pressable
                style={[styles.langPill, userLang === 'en' && styles.langPillActive]}
                onPress={() => handleLanguage('en')}
                testID="settings-language-en"
              >
                <Text style={[styles.langPillText, userLang === 'en' && styles.langPillTextActive]}>
                  English
                </Text>
              </Pressable>
              <Pressable
                style={[styles.langPill, userLang === 'hi' && styles.langPillActive]}
                onPress={() => handleLanguage('hi')}
                testID="settings-language-hi"
              >
                <Text style={[styles.langPillText, userLang === 'hi' && styles.langPillTextActive]}>
                  हिन्दी
                </Text>
              </Pressable>
            </View>
          }
          showChevron={false}
          isLast
          testID="settings-language-row"
        />
      </GroupedSettingCard>

      {/* ── 4. Section: Data & Organization ── */}
      <SectionHeader label={translate('dataAndArchive')} />
      <GroupedSettingCard>
        {/* Add from Preset */}
        <SettingItem
          icon="sparkles"
          iconColor={Colors.tealDeep}
          iconBg="rgba(62, 124, 106, 0.12)"
          title={translate('addFromPreset')}
          subtitle={translate('browsePresetsSub')}
          onPress={() => setShowPresetLibrary(true)}
          testID="settings-preset-library-link"
        />

        {/* My Custom Categories */}
        <SettingItem
          icon="grid-outline"
          iconColor={Colors.marigoldDeep}
          iconBg="rgba(232, 163, 61, 0.12)"
          title={translate('myCategories')}
          subtitle={translate('myCategoriesSub')}
          onPress={() => setShowCategoryManager(true)}
          testID="settings-categories-link"
        />

        {/* Archived Tasks */}
        <SettingItem
          icon="archive-outline"
          iconColor={Colors.marigoldDeep}
          iconBg="rgba(232, 163, 61, 0.12)"
          title={translate('archivedTasksCount')}
          subtitle={isHi ? 'छिपाए गए या पुराने कार्य देखें' : 'View or restore archived tasks'}
          badge={archivedTasks.length > 0 ? archivedTasks.length : undefined}
          onPress={() => setShowArchivedSheet(true)}
          testID="settings-archived-link"
        />

        {/* Export to Calendar */}
        <SettingItem
          icon="calendar-outline"
          iconColor={Colors.indigo900}
          iconBg="rgba(30, 36, 68, 0.08)"
          title={translate('exportToCalendar')}
          subtitle={isHi ? '.ics फ़ाइल में कार्य एक्सपोर्ट करें' : 'Export tasks to Google / Apple Calendar'}
          onPress={async () => {
            const ok = await exportCalendar(tasks);
            if (ok) {
              showToast(isHi ? 'कैलेंडर फ़ाइल तैयार है!' : 'Calendar exported successfully!');
            } else {
              showToast(translate('saveError'));
            }
          }}
          testID="settings-export-link"
        />

        {/* Manage Household */}
        <SettingItem
          icon="home-outline"
          iconColor={Colors.tealDeep}
          iconBg="rgba(62, 124, 106, 0.12)"
          title={translate('manageHousehold')}
          subtitle={activeHousehold?.name ? `${stats.householdIcon} ${activeHousehold.name}` : undefined}
          onPress={() => router.push('/(tabs)/household')}
          isLast
          testID="settings-household-link"
        />
      </GroupedSettingCard>

      {/* ── 5. Section: About & Support ── */}
      <SectionHeader label={translate('aboutAndLegal')} />
      <GroupedSettingCard>
        {/* Help & Support */}
        <SettingItem
          icon="help-circle-outline"
          iconColor={Colors.indigo900}
          iconBg="rgba(30, 36, 68, 0.08)"
          title={translate('helpSupport')}
          onPress={() => router.push('/help-support')}
          testID="settings-support-link"
        />

        {/* Privacy Policy */}
        <SettingItem
          icon="shield-outline"
          iconColor={Colors.tealDeep}
          iconBg="rgba(62, 124, 106, 0.12)"
          title={translate('privacyPolicy')}
          onPress={() => router.push('/privacy')}
          testID="settings-privacy-link"
        />

        {/* Terms of Service */}
        <SettingItem
          icon="document-text-outline"
          iconColor={Colors.marigoldDeep}
          iconBg="rgba(232, 163, 61, 0.12)"
          title={translate('termsOfService')}
          onPress={() => router.push('/terms')}
          isLast
          testID="settings-terms-link"
        />
      </GroupedSettingCard>

      {/* ── 6. Account Actions (Log Out + Delete Account) ── */}
      <SectionHeader label={translate('accountActions')} />
      <GroupedSettingCard>
        <SettingItem
          icon="log-out-outline"
          iconColor={Colors.clayDeep}
          iconBg="rgba(193, 80, 46, 0.1)"
          title={translate('logOut')}
          danger
          showChevron={false}
          onPress={() => {
            const performLogout = async () => {
              await signOut();
              resetTasks();
            };
            if (Platform.OS === 'web') {
              if (
                window.confirm(
                  isHi
                    ? 'क्या आप वाकई लॉग आउट करना चाहते हैं?'
                    : 'Are you sure you want to log out?'
                )
              ) {
                performLogout();
              }
            } else {
              Alert.alert(
                isHi ? 'लॉग आउट करें' : 'Log Out',
                isHi
                  ? 'क्या आप वाकई लॉग आउट करना चाहते हैं?'
                  : 'Are you sure you want to log out?',
                [
                  { text: isHi ? 'रद्द करें' : 'Cancel', style: 'cancel' },
                  {
                    text: isHi ? 'लॉग आउट' : 'Log Out',
                    style: 'destructive',
                    onPress: performLogout,
                  },
                ]
              );
            }
          }}
          testID="settings-logout-link"
        />

        {/* Delete Account */}
        <SettingItem
          icon="trash-outline"
          iconColor={Colors.clayDeep}
          iconBg="rgba(193, 80, 46, 0.1)"
          title={translate('deleteAccount')}
          subtitle={translate('deleteAccountSub')}
          danger
          showChevron={false}
          isLast
          onPress={() => setShowDeleteReasonModal(true)}
          testID="settings-delete-account-link"
        />
      </GroupedSettingCard>

      {/* ── 7. App Version Footer ── */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerVersionText}>{getAppVersionLabel(isHi ? 'hi' : 'en')}</Text>
      </View>

      {/* ── Modals & Sheets ── */}

      {/* Member Pass QR Modal */}
      <MemberPassModal
        visible={showPassModal}
        onClose={() => setShowPassModal(false)}
        user={user}
        language={userLang}
      />

      {/* Archived Tasks Sheet */}
      <ArchivedTasksSheet
        visible={showArchivedSheet}
        onClose={() => setShowArchivedSheet(false)}
        language={userLang}
      />

      {/* Preset Library Sheet */}
      {showPresetLibrary && (
        <PresetLibrarySheet
          visible={showPresetLibrary}
          onClose={() => setShowPresetLibrary(false)}
          language={userLang}
        />
      )}

      {/* Custom Categories Manager Sheet */}
      <ManageCategoriesSheet
        visible={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        language={userLang}
      />

      {/* Edit Profile Bottom Sheet Modal */}
      <Modal
        visible={showEditSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditSheet(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContainer}
        >
          <Pressable style={styles.backdrop} onPress={() => setShowEditSheet(false)} />
          <Card style={styles.sheet} mode="elevated">
            <View style={styles.modalHandle} />
            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              {/* Header with avatar preview */}
              <View style={styles.editAvatarPreviewRow}>
                <View style={styles.editAvatarPreview}>
                  <Text style={styles.editAvatarText}>
                    {initials(editName.trim() || user.name || 'User')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>
                    {isHi ? 'प्रोफ़ाइल संपादित करें' : 'Edit Profile'}
                  </Text>
                  <Text style={styles.sheetSub}>
                    {isHi ? 'अपने खाते का विवरण अपडेट करें।' : 'Update your account details.'}
                  </Text>
                </View>
              </View>

              <FormField
                label={translate('fullName')}
                value={editName}
                onChangeText={setEditName}
                placeholder={translate('fullNamePlaceholder')}
                error={errors.name}
                testID="settings-edit-name-input"
              />

              <FormField
                label={translate('mobileNumber')}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                maxLength={10}
                error={errors.phone}
                testID="settings-edit-phone-input"
              />

              {/* Read-only Google Email Field */}
              <Text style={styles.readOnlyLabel}>{translate('email')}</Text>
              <View style={styles.readOnlyField} testID="settings-edit-email-container">
                <View style={styles.readOnlyTextRow}>
                  <AppIcon name="logo-google" size={14} color={Colors.inkSoft} />
                  <Text style={styles.readOnlyValue} testID="settings-edit-email-value">
                    {user.email}
                  </Text>
                </View>
                <AppIcon name="lock-closed-outline" size={16} color={Colors.inkFaint} />
              </View>
              <Text style={styles.readOnlyHint}>{translate('emailFromGoogle')}</Text>

              <Button
                title={isHi ? 'सहेजें' : 'Save Details'}
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

      {/* Delete Account — Reason Picker Modal */}
      <Modal
        visible={showDeleteReasonModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeleteReasonModal(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowDeleteReasonModal(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContainer}
          pointerEvents="box-none"
        >
          <Card style={styles.deleteSheet} mode="elevated">
            <View style={styles.modalHandle} />

            {/* Danger header */}
            <View style={styles.deleteSheetHeader}>
              <View style={styles.deleteIconBadge}>
                <AppIcon name="trash-outline" size={24} color={Colors.clayDeep} />
              </View>
              <Text style={styles.deleteSheetTitle}>
                {translate('deleteReasonTitle')}
              </Text>
              <Text style={styles.deleteSheetSub}>
                {translate('deleteReasonSubtitle')}
              </Text>
            </View>

            {/* Reason Options */}
            {([
              { key: 'not_useful', label: translate('deleteReasonNotUseful') },
              { key: 'too_many_notifications', label: translate('deleteReasonNotifications') },
              { key: 'privacy', label: translate('deleteReasonPrivacy') },
              { key: 'switching', label: translate('deleteReasonSwitching') },
              { key: 'other', label: translate('deleteReasonOther') },
            ] as const).map((reason) => (
              <Pressable
                key={reason.key}
                style={[
                  styles.reasonRow,
                  selectedDeleteReason === reason.key && styles.reasonRowSelected,
                ]}
                onPress={() => setSelectedDeleteReason(reason.key)}
                testID={`delete-reason-${reason.key}`}
              >
                <View style={[
                  styles.reasonRadio,
                  selectedDeleteReason === reason.key && styles.reasonRadioSelected,
                ]}>
                  {selectedDeleteReason === reason.key && (
                    <View style={styles.reasonRadioDot} />
                  )}
                </View>
                <Text style={styles.reasonLabel}>{reason.label}</Text>
              </Pressable>
            ))}

            {/* CTA Buttons */}
            <Button
              title={translate('deleteAccountConfirmBtn')}
              onPress={() => {
                setShowDeleteReasonModal(false);
                const reason = selectedDeleteReason ?? 'user_requested';
                setTimeout(() => {
                  if (Platform.OS === 'web') {
                    if (window.confirm(translate('deleteAccountConfirmBody'))) {
                      executeDelete(reason);
                    }
                  } else {
                    Alert.alert(
                      translate('deleteAccountConfirmTitle'),
                      translate('deleteAccountConfirmBody'),
                      [
                        { text: isHi ? 'रद्द करें' : 'Cancel', style: 'cancel' },
                        {
                          text: translate('deleteAccountConfirmBtn'),
                          style: 'destructive',
                          onPress: () => executeDelete(reason),
                        },
                      ]
                    );
                  }
                }, 300);
              }}
              loading={deleting}
              disabled={deleting}
              style={styles.deleteConfirmBtn}
              testID="settings-delete-confirm-btn"
            />
            <Button
              title={isHi ? 'रद्द करें' : 'Cancel'}
              variant="ghost"
              disabled={deleting}
              style={{ marginTop: 8, marginBottom: 20 }}
              onPress={() => setShowDeleteReasonModal(false)}
              testID="settings-delete-cancel-btn"
            />
          </Card>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full-Screen Deletion Blocking Overlay */}
      {deleting && (
        <View style={styles.deletingOverlay} testID="account-deleting-overlay">
          <View style={styles.deletingCard}>
            <ActivityIndicator size="large" color={Colors.marigoldDeep} />
            <Text style={styles.deletingTitle}>
              {isHi ? 'खाता हटाया जा रहा है...' : 'Deleting Account...'}
            </Text>
            <Text style={styles.deletingSub}>
              {isHi
                ? 'आपका डेटा सुरक्षित रूप से हटाया जा रहा है...'
                : 'Safely scheduling deletion...'}
            </Text>
            <View style={styles.deletingRecoveryNoticeCard}>
              <AppIcon name="shield-outline" size={18} color={Colors.marigoldDeep} style={{ marginRight: 6 }} />
              <Text style={styles.deletingRecoveryNoticeText}>
                {translate('deleteAccountRecoveryNotice')}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 30-Day Recovery Notice Modal Popup */}
      {renderRecoveryNoticeModal()}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  // Hero Card
  heroCard: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: 12,
    elevation: 4,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  hero: {
    padding: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(251, 247, 239, 0.4)',
    shadowColor: Colors.marigold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 22,
    color: Colors.indigo950,
  },
  identityCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
    color: Colors.onDark,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  phone: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: Colors.onDarkMuted,
  },
  email: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11.5,
    color: Colors.onDarkFaint,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  memberPassPill: {
    marginTop: 16,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(232, 163, 61, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.35)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  memberPassContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberPassLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11.5,
    color: Colors.marigold,
  },
  memberPassCode: {
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.marigoldLight,
    letterSpacing: 1,
  },

  // Stats Card
  statsCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  householdStatCol: {
    paddingVertical: 2,
  },
  statValue: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 16,
    color: Colors.ink,
  },
  statLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 3,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.ivoryLine,
  },

  // Referral / Invite Friends Banner
  referralCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.28)',
    elevation: 2,
    shadowColor: Colors.marigoldDeep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  referralInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  referralIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralTextCol: {
    flex: 1,
  },
  referralTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.indigo950,
    marginBottom: 2,
  },
  referralSubtitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkSoft,
    lineHeight: 15,
  },
  referralBtn: {
    backgroundColor: Colors.marigoldDeep,
    borderRadius: Radius.full,
    paddingVertical: 7,
    paddingHorizontal: 12,
    elevation: 1,
  },
  referralBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  referralBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.white,
  },

  // Language Segment Switcher
  langSegment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(23, 27, 54, 0.06)',
    borderRadius: Radius.full,
    padding: 3,
    gap: 2,
  },
  langPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  langPillActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  langPillText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.inkSoft,
  },
  langPillTextActive: {
    color: Colors.ink,
    fontFamily: 'Manrope_700Bold',
  },

  // Footer
  footerContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  footerVersionText: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    color: Colors.inkFaint,
  },

  // Edit Profile Bottom Sheet
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
    backgroundColor: 'rgba(23, 27, 54, 0.48)',
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
    paddingBottom: 48,
  },
  editAvatarPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  editAvatarPreview: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(251, 247, 239, 0.8)',
    elevation: 2,
  },
  editAvatarText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: Colors.indigo950,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'Fraunces_700Bold',
    color: Colors.ink,
    marginBottom: 2,
  },
  sheetSub: {
    fontSize: 12.5,
    color: Colors.inkSoft,
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
  },
  readOnlyTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  // ── Delete Account Modal ──
  deleteSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    elevation: 24,
  },
  deleteSheetHeader: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
  },
  deleteIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(193, 80, 46, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  deleteSheetTitle: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  deleteSheetSub: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.ivoryLine,
    gap: 14,
  },
  reasonRowSelected: {
    backgroundColor: 'rgba(193, 80, 46, 0.04)',
    borderRadius: Radius.sm,
  },
  reasonRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.ivoryLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonRadioSelected: {
    borderColor: Colors.clayDeep,
  },
  reasonRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.clayDeep,
  },
  reasonLabel: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.ink,
    flex: 1,
  },
  deleteConfirmBtn: {
    marginTop: 20,
    backgroundColor: Colors.clayDeep,
  },
  deletingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23, 27, 54, 0.78)',
    zIndex: 99999,
    elevation: 99999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deletingCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    ...Shadows.md,
  },
  deletingTitle: {
    ...Typography.title,
    fontSize: 18,
    color: Colors.ink,
    marginTop: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  deletingSub: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
  },
  deletingRecoveryNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF8EE',
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.25)',
    borderRadius: Radius.md,
    padding: 10,
    marginTop: 14,
  },
  deletingRecoveryNoticeText: {
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: Colors.indigo950,
    lineHeight: 17,
  },
  noticeModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 27, 54, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noticeModalCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...Shadows.md,
  },
  noticeIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(20, 110, 120, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  noticeModalTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: Colors.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  graceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    gap: 6,
    marginBottom: 12,
  },
  graceBadgeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12.5,
    color: Colors.indigo950,
  },
  noticeModalBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13.5,
    color: Colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  noticeModalBtn: {
    width: '100%',
    backgroundColor: Colors.white
  },
});

