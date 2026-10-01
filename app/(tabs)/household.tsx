import { useTranslation } from '@/hooks/useTranslation';
import { useAuth, useNetworkStatus } from '@/providers/AppProviders';
import { useTasks } from '@/providers/TaskProvider';
import { useToast } from '@/providers/ToastProvider';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { ActivityFeed } from '@/components/ActivityFeed';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/Button';
import { CreateHouseholdSheet } from "@/components/CreateHouseholdSheet";
import { HouseholdContextSwitcher } from '@/components/HouseholdContextSwitcher';
import { HouseholdSettingsSheet } from "@/components/HouseholdSettingsSheet";
import { EmptyState, ScreenShell } from '@/components/ScreenShell';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { TaskFormSheet } from '@/components/TaskFormSheet';
import { CATEGORY_MAP } from '@/constants/categories';
import { Colors, Radius, Typography } from '@/constants/theme';
import { userRepository } from '@/data/repositories/userRepository';
import {
  addMemberToHousehold,
  HOUSEHOLD_COLORS,
  householdMemberFromInvite,
  isValidInviteCode,
  listHouseholds,
  memberColor,
  normalizeInviteCode,
  pendingMemberFromCode,
} from '@/domain/household';
import { initials } from '@/domain/insights';
import { taskToFormValues } from '@/domain/preset';
import { daysUntilDue } from '@/domain/recurrence';
import { useHousehold } from '@/hooks/useInsights';
import { useNudge } from '@/hooks/useNudge';
import { useNotifications } from '@/providers/NotificationProvider';
import type { CategoryKey, HouseholdContext, HouseholdMemberProfile, RepeatingTask } from '@/types';
import type { AppNotification } from '@/types/notification';
import { broadcastMemberJoinedHousehold } from '@/services/householdBroadcastService';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

function SharedTaskCard({
  task,
  language,
  onPress,
  user,
  members,
  onClaim,
  onNudge,
}: {
  task: RepeatingTask;
  language: 'en' | 'hi';
  onPress: () => void;
  user: any;
  members?: HouseholdMemberProfile[];
  onClaim?: () => void;
  onNudge?: () => void;
}) {
  const cat = CATEGORY_MAP[task.category as CategoryKey] || CATEGORY_MAP['home'] || { icon: '📋' };
  const days = daysUntilDue(task.nextDueDate);
  const overdue = days < 0;

  const catBg =
    task.category === 'bills' || task.category === 'finance' ? '#FFF3E0' : // light orange
      task.category === 'home' ? '#E3F2FD' : // light blue
        '#FCE7F3'; // light pink

  const catColor =
    task.category === 'bills' || task.category === 'finance' ? '#E65100' :
      task.category === 'home' ? '#0D47A1' :
        '#880E4F';

  const creatorName = task.creatorName === user?.name ? (language === 'hi' ? 'आप' : 'You') : task.creatorName || (language === 'hi' ? 'अन्य' : 'Other');

  const assigneeName = useMemo(() => {
    if (!task.assignedTo) return language === 'hi' ? 'कोई नहीं' : 'Unassigned';
    if (task.assignedTo === user?.id || task.assignedTo === user?.userCode) return language === 'hi' ? 'आपको' : 'You';
    const allMembers = members ?? user?.householdMembers ?? [];
    const member = allMembers.find((m: any) => m.userId === task.assignedTo || m.code === task.assignedTo);
    return member ? member.name : (language === 'hi' ? 'अन्य' : 'Other');
  }, [task.assignedTo, user, members, language]);

  const statusStyle = useMemo(() => {
    if (overdue) {
      return { text: language === 'hi' ? 'विलंबित' : 'Overdue', color: '#B91C1C', bg: '#FEF2F2' };
    }
    if (days === 0) {
      return { text: language === 'hi' ? 'आज देय' : 'Due Today', color: '#B45309', bg: '#FFFBEB' };
    }
    if (days === 1) {
      return { text: language === 'hi' ? 'कल देय' : 'Due Tomorrow', color: '#15803D', bg: '#F0FDF4' };
    }
    return { text: language === 'hi' ? `${days} दिनों में` : `Due in ${days} days`, color: '#1E3A8A', bg: '#EFF6FF' };
  }, [days, overdue, language]);

  const formattedDate = useMemo(() => {
    const d = new Date(task.nextDueDate);
    const dateStr = d.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', { day: 'numeric', month: 'short' });
    const timeStr = task.reminderTime || '9:00 AM';
    return `${dateStr}, ${timeStr}`;
  }, [task.nextDueDate, task.reminderTime, language]);

  const isAssignedToMe = useMemo(() => {
    if (!task.assignedTo) return false;
    return task.assignedTo === user?.id || task.assignedTo === user?.userCode;
  }, [task.assignedTo, user?.id, user?.userCode]);

  const canClaim = !task.assignedTo && Boolean(onClaim);
  const canNudge = Boolean(task.assignedTo && !isAssignedToMe && days <= 0 && onNudge);
  const hasAction = canClaim || canNudge;

  const respConfig = useMemo(() => {
    if (task.isRotating) {
      const turnLabel = isAssignedToMe
        ? (language === 'hi' ? 'आपकी बारी' : 'Your turn')
        : (language === 'hi' ? `बारी: ${assigneeName}` : `Turn: ${assigneeName}`);
      return {
        label: turnLabel,
        icon: <Text style={styles.rotIconEmoji}>🔄</Text>,
        bgStyle: styles.respRotatingBadge,
        textColor: '#0284C7',
      };
    }

    if (task.assignedTo) {
      const assignedLabel = isAssignedToMe
        ? (language === 'hi' ? 'सौंपा: आप' : 'Assigned: You')
        : (language === 'hi' ? `सौंपा: ${assigneeName}` : `Assigned: ${assigneeName}`);
      return {
        label: assignedLabel,
        icon: (
          <AppIcon
            name="person-circle-outline"
            size={12}
            color={isAssignedToMe ? Colors.tealDeep : Colors.inkSoft}
            style={{ marginRight: 3 }}
          />
        ),
        bgStyle: isAssignedToMe ? styles.respMeBadge : styles.respMemberBadge,
        textColor: isAssignedToMe ? Colors.tealDeep : Colors.ink,
      };
    }

    return {
      label: language === 'hi' ? 'सभी के लिए खुला' : 'Open to all',
      icon: (
        <AppIcon
          name="people-outline"
          size={12}
          color={Colors.marigoldDeep}
          style={{ marginRight: 3 }}
        />
      ),
      bgStyle: styles.respOpenBadge,
      textColor: Colors.marigoldDeep,
    };
  }, [task.isRotating, task.assignedTo, isAssignedToMe, assigneeName, language]);

  return (
    <Card style={styles.sharedCard} mode="elevated" onPress={onPress}>
      <Card.Content style={styles.sharedCardContent}>
        <View style={[styles.sharedCatIconWrap, { backgroundColor: catBg }]}>
          <Text style={[styles.sharedCatIcon, { color: catColor }]}>{task.icon || cat.icon}</Text>
        </View>

        <View style={styles.sharedBodyCol}>
          {/* Row 1: Title + Due Status Pill + Chevron */}
          <View style={styles.sharedTopRow}>
            <Text style={styles.sharedTitle} numberOfLines={1} ellipsizeMode="tail">
              {task.title}
            </Text>
            <View style={styles.sharedStatusWrap}>
              <View style={[styles.sharedStatusPill, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.sharedStatusText, { color: statusStyle.color }]}>
                  {statusStyle.text}
                </Text>
              </View>
              <AppIcon name="chevron-forward" size={14} color={Colors.inkFaint} style={{ marginLeft: 4 }} />
            </View>
          </View>

          {/* Row 2: Sub Row (Shared by & Due Date) */}
          <View style={styles.sharedSubRow}>
            <Text style={styles.sharedSubText} numberOfLines={1} ellipsizeMode="tail">
              {language === 'hi' ? 'साझाकर्ता: ' : 'Shared by '}
              <Text style={styles.sharedSubBold}>{creatorName}</Text>
            </Text>
            <Text style={styles.sharedDotSep}>•</Text>
            <View style={styles.sharedDateRow}>
              <AppIcon name="calendar-outline" size={11} color={Colors.inkFaint} style={{ marginRight: 3 }} />
              <Text style={styles.sharedDateText}>{formattedDate}</Text>
            </View>
          </View>

          {/* Row 3: Responsibility Pill + Action (Claim / Nudge) */}
          <View style={styles.sharedBottomRow}>
            <View
              style={[
                styles.sharedRespBadge,
                respConfig.bgStyle,
                hasAction && styles.sharedRespBadgeConstrained,
              ]}
            >
              {respConfig.icon}
              <Text
                style={[styles.sharedRespText, { color: respConfig.textColor }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {respConfig.label}
              </Text>
            </View>

            {canClaim && (
              <TouchableOpacity
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onClaim?.();
                }}
                style={styles.claimMiniBtn}
                hitSlop={6}
                activeOpacity={0.8}
              >
                <Text style={styles.claimMiniBtnText}>✋ {language === 'hi' ? 'मैं करूंगा' : 'Claim'}</Text>
              </TouchableOpacity>
            )}

            {canNudge && (
              <TouchableOpacity
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onNudge?.();
                }}
                style={styles.nudgeMiniBtn}
                hitSlop={6}
                activeOpacity={0.8}
              >
                <Text style={styles.nudgeMiniBtnText}>👉 {language === 'hi' ? 'नज़' : 'Nudge'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// HouseholdView — Renders everything scoped to ONE active household.
// All stats/members/tasks are derived from props here, so they update
// instantly whenever the user switches household pills.
// ────────────────────────────────────────────────────────────────────────────
interface HouseholdViewProps {
  user: any;
  activeHousehold: HouseholdContext;
  households: HouseholdContext[];
  householdScopedTasks: import('@/types').RepeatingTask[];
  allTasks: import('@/types').RepeatingTask[];
  language: 'en' | 'hi';
  translate: (key: import('@/i18n').TranslationKey) => string;
  showToast: (msg: string) => void;
  addNotification: (type: any, title: string, body: string) => Promise<void>;
  updateUser: (patch: Partial<import('@/types').UserProfile>) => Promise<void>;
  createHousehold: (name: string, icon: string, color: string) => Promise<{ ok: boolean; error?: string }>;
  switchHousehold: (id: string) => Promise<void>;
  setCreateSheetVisible: (v: boolean) => void;
  setSelectedTaskId: (id: string | null) => void;
  setEditingTaskId: (id: string | null) => void;
  setActivityVisible: (v: boolean) => void;
  removeHouseholdMemberAndCleanup: (code: string, deleteTasks: boolean) => Promise<void>;
  removeMemberFromHousehold: (householdId: string, memberCode: string, memberUserId?: string) => Promise<{ ok: boolean; error?: string }>;
  scrollRef: React.RefObject<ScrollView | null>;
  sharedTasksY: React.MutableRefObject<number>;
  activityY: React.MutableRefObject<number>;
  onOpenSettings: () => void;
}

function HouseholdView({
  user,
  activeHousehold,
  households,
  householdScopedTasks,
  allTasks: _allTasks,
  language,
  translate,
  showToast,
  addNotification,
  updateUser,
  createHousehold: _createHousehold,
  switchHousehold,
  setCreateSheetVisible,
  setSelectedTaskId,
  setEditingTaskId: _setEditingTaskId,
  setActivityVisible,
  removeHouseholdMemberAndCleanup,
  removeMemberFromHousehold,
  scrollRef: _scrollRef,
  sharedTasksY,
  activityY: _activityY,
  onOpenSettings,
}: HouseholdViewProps) {
  const { isOnline } = useNetworkStatus();
  const { claimTask } = useTasks();
  const { handleNudge } = useNudge();
  const { stats, members } = useHousehold(householdScopedTasks);

  type HouseholdSegment = 'all' | 'my_duties' | 'claimable' | 'rotations';
  const [activeSegment, setActiveSegment] = useState<HouseholdSegment>('all');
  const [filterMemberCode, setFilterMemberCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [addingCode, setAddingCode] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const { joinHouseholdByCode } = useAuth();
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joiningHh, setJoiningHh] = useState(false);
  const [joinScannerVisible, setJoinScannerVisible] = useState(false);

  const overdueCount = useMemo(() => {
    return householdScopedTasks.filter((t) => daysUntilDue(t.nextDueDate) < 0).length;
  }, [householdScopedTasks]);

  const dueTodayCount = useMemo(() => {
    return householdScopedTasks.filter((t) => daysUntilDue(t.nextDueDate) === 0).length;
  }, [householdScopedTasks]);

  const isAllClean = overdueCount === 0 && dueTodayCount === 0 && (householdScopedTasks.length === 0 || stats.onTime === stats.total);

  const handleCopyCode = async () => {
    const codeToCopy = activeHousehold.code || user?.userCode;
    if (!codeToCopy) return;
    await Clipboard.setStringAsync(codeToCopy);
    setCopiedCode(true);
    showToast(language === 'hi' ? 'घर का कोड कॉपी हो गया!' : 'Household invite code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleJoinHousehold = async (customCode?: string) => {
    if (!isOnline) {
      showToast(translate('offlineHouseholdAction'));
      return;
    }
    const code = normalizeInviteCode(customCode ?? joinCodeInput);
    if (!isValidInviteCode(code)) {
      showToast(translate('invalidInviteCode'));
      return;
    }
    setJoiningHh(true);
    try {
      const res = await joinHouseholdByCode(code);
      if (res.ok) {
        showToast(
          language === 'hi'
            ? `"${res.household?.name || 'घर'}" में शामिल हो गए!`
            : `Joined "${res.household?.name || 'household'}"!`
        );
        setJoinModalVisible(false);
        setJoinCodeInput('');
      } else if (res.alreadyMember) {
        showToast(
          language === 'hi'
            ? 'आप पहले से ही इस घर के सदस्य हैं'
            : 'You are already a member of this household'
        );
        setJoinModalVisible(false);
        setJoinCodeInput('');
      } else if (res.error === 'limit_reached') {
        showToast(
          language === 'hi'
            ? 'अधिकतम घर सीमा समाप्त हो गई है (5)'
            : 'Maximum household limit reached (5)'
        );
      } else if (res.error === 'household_not_found') {
        showToast(
          language === 'hi'
            ? 'घर नहीं मिला। कृपया कोड जांचें।'
            : 'Household not found. Please check code.'
        );
      } else {
        showToast(language === 'hi' ? 'शामिल होने में विफल' : 'Failed to join household');
      }
    } catch {
      showToast(language === 'hi' ? 'शामिल होने में विफल' : 'Failed to join household');
    } finally {
      setJoiningHh(false);
    }
  };

  const handleJoinBarcodeScanned = async ({ data }: { data: string }) => {
    setJoinScannerVisible(false);
    if (data) {
      setJoinCodeInput(data);
      Keyboard.dismiss();
      await handleJoinHousehold(data);
    }
  };

  // Reset filter when switching households
  useEffect(() => {
    setFilterMemberCode(null);
    setActiveSegment('all');
    setCodeInput('');
  }, [activeHousehold.id]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => b.onTimePercent - a.onTimePercent);
  }, [members]);

  const counts = useMemo(() => {
    let myDuties = 0;
    let claimable = 0;
    let rotations = 0;
    for (const t of householdScopedTasks) {
      if (t.assignedTo === user?.id || t.assignedTo === user?.userCode) myDuties++;
      if (!t.assignedTo) claimable++;
      if (t.isRotating) rotations++;
    }
    return {
      all: householdScopedTasks.length,
      myDuties,
      claimable,
      rotations,
    };
  }, [householdScopedTasks, user?.id, user?.userCode]);

  const filteredSharedTasks = useMemo(() => {
    let list = householdScopedTasks;

    if (activeSegment === 'my_duties') {
      list = list.filter((t) => t.assignedTo === user?.id || t.assignedTo === user?.userCode);
    } else if (activeSegment === 'claimable') {
      list = list.filter((t) => !t.assignedTo);
    } else if (activeSegment === 'rotations') {
      list = list.filter((t) => t.isRotating);
    }

    if (filterMemberCode) {
      list = list.filter((t) => {
        if (filterMemberCode === 'you') {
          return !t.assignedTo || t.assignedTo === user?.id || t.assignedTo === user?.userCode;
        }
        return (
          t.sharedWith.some((m: any) => m.code === filterMemberCode || m.userId === filterMemberCode) ||
          t.assignedTo === filterMemberCode
        );
      });
    }
    return list;
  }, [householdScopedTasks, activeSegment, filterMemberCode, user?.id, user?.userCode]);

  const activeMembers = activeHousehold.members ?? [];

  const addByCode = async (customCode?: string) => {
    if (!isOnline) {
      showToast(translate('offlineHouseholdAction'));
      return;
    }
    if (!user) return;

    const code = normalizeInviteCode(customCode ?? codeInput);
    if (!isValidInviteCode(code)) {
      showToast(translate('invalidInviteCode'));
      return;
    }
    if (user.userCode && code === user.userCode) {
      showToast(translate('cannotAddOwnCode'));
      return;
    }
    setAddingCode(true);

    // If the scanned/entered code is actually a household code for another household, join it!
    const hhMatch = await userRepository.resolveHouseholdCode(code);
    if (hhMatch && hhMatch.householdId !== activeHousehold.id) {
      setAddingCode(false);
      setCodeInput('');
      const joinRes = await joinHouseholdByCode(code);
      if (joinRes.ok) {
        showToast(
          language === 'hi'
            ? `"${joinRes.household?.name || 'घर'}" में शामिल हो गए!`
            : `Joined "${joinRes.household?.name || 'household'}"!`
        );
      } else if (joinRes.alreadyMember) {
        showToast(language === 'hi' ? 'आप पहले से ही इस घर के सदस्य हैं' : 'You are already in this household');
      } else if (joinRes.error === 'limit_reached') {
        showToast(language === 'hi' ? 'अधिकतम घर सीमा समाप्त हो गई है (5)' : 'Maximum household limit reached (5)');
      } else {
        showToast(language === 'hi' ? 'शामिल होने में विफल' : 'Failed to join household');
      }
      return;
    }

    if (activeMembers.some((m: HouseholdMemberProfile) => normalizeInviteCode(m.code) === code)) {
      setAddingCode(false);
      showToast(translate('memberAlreadyAdded'));
      return;
    }

    const userCodeMatch = await userRepository.resolveUserCode(code);
    let member: HouseholdMemberProfile;

    if (userCodeMatch) {
      member = {
        code: userCodeMatch.userCode,
        userId: userCodeMatch.userId,
        name: userCodeMatch.name,
        color: userCodeMatch.color,
        addedAt: new Date().toISOString(),
        status: 'active',
      };
    } else {
      const invite = await userRepository.resolveHouseholdInvite(code);
      member = invite ? householdMemberFromInvite(invite) : pendingMemberFromCode(code);
    }

    let updatedHh: HouseholdContext | undefined = undefined;

    const updatedPatch = addMemberToHousehold(user, activeHousehold.id, member);
    await updateUser(updatedPatch);
    updatedHh = (updatedPatch.households ?? []).find(h => h.id === activeHousehold.id);
    if (updatedHh) {
      await userRepository.saveHousehold(updatedHh);
    }

    await addNotification(
      'household',
      language === 'hi' ? 'परिवार का सदस्य जुड़ गया' : 'Household Member Linked',
      language === 'hi' ? `${member.name || code} को परिवार में जोड़ा गया।` : `Linked ${member.name || code} to your household.`
    );

    // Broadcast push notification to all members of the household
    broadcastMemberJoinedHousehold({
      householdId: activeHousehold.id,
      householdName: activeHousehold.name || 'Home',
      newMember: { id: member.userId, name: member.name, code: member.code },
      actorUser: user,
      allMembers: updatedHh?.members ?? activeMembers,
    }).catch((err) => console.warn('[Repeato] Member join broadcast failed:', err));

    if (member.userId) {
      try {
        const peerNotif: AppNotification = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'household',
          title: language === 'hi' ? 'नया परिवार सदस्य जोड़ा गया' : 'Added to Household',
          body: language === 'hi'
            ? `${user.name} ने आपको "${activeHousehold.name || 'Home'}" में जोड़ा।`
            : `${user.name} added you to "${activeHousehold.name || 'Home'}".`,
          timestamp: new Date().toISOString(),
          read: false,
        };
        await userRepository.saveNotification(member.userId, peerNotif);
      } catch (err) {
        console.warn('[Repeato] Remote notification to added member failed:', err);
      }
    }

    setAddingCode(false);
    setCodeInput('');
    showToast(userCodeMatch
      ? (language === 'hi' ? 'सदस्य को घर में जोड़ा गया' : 'Member added to household!')
      : translate('memberAddedPending'));
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setScannerVisible(false);
    if (data) {
      setCodeInput(data);
      Keyboard.dismiss();
      await addByCode(data);
    }
  };

  const _removeMember = async (code?: string) => {
    if (!user || !code) return;
    const member = activeMembers.find((m: HouseholdMemberProfile) => m.code === code);
    const memberName = member ? member.name : code;

    const performRemoval = async (deleteTasks: boolean) => {
      if (activeHousehold?.id) {
        await removeMemberFromHousehold(activeHousehold.id, code, member?.userId);
      }
      await removeHouseholdMemberAndCleanup(code, deleteTasks);
    };

    if (Platform.OS === 'web') {
      const confirmRemove = window.confirm(
        language === 'hi'
          ? `क्या आप वाकई ${memberName} को अपने परिवार से हटाना चाहते हैं?`
          : `Are you sure you want to remove ${memberName} from your household?`
      );
      if (!confirmRemove) return;
      const deleteTasks = window.confirm(
        language === 'hi'
          ? 'क्या आप दोनों उपकरणों से इस सदस्य के सभी साझा कार्यों को भी हटाना चाहते हैं?'
          : 'Do you want to delete all shared tasks associated with this member from both devices?'
      );
      await performRemoval(deleteTasks);
    } else {
      Alert.alert(
        language === 'hi' ? 'सदस्य को हटाएं?' : 'Remove Member?',
        language === 'hi'
          ? `क्या आप वाकई ${memberName} को अपने परिवार से हटाना चाहते हैं?`
          : `Are you sure you want to remove ${memberName} from your household?`,
        [
          { text: language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
          {
            text: language === 'hi' ? 'हटाएं' : 'Remove',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                language === 'hi' ? 'साझा कार्य हटाएं?' : 'Remove Shared Tasks?',
                language === 'hi'
                  ? 'क्या आप दोनों उपकरणों से इस सदस्य के सभी साझा कार्यों को भी हटाना चाहते हैं?'
                  : 'Do you want to delete all shared tasks associated with this member from both devices?',
                [
                  { text: language === 'hi' ? 'कार्य रखें' : 'Keep Tasks', onPress: () => performRemoval(false) },
                  { text: language === 'hi' ? 'कार्य हटाएं' : 'Remove Tasks', style: 'destructive', onPress: () => performRemoval(true) },
                ]
              );
            },
          },
        ]
      );
    }
  };

  return (
    <>
      {/* ── 1. Household Context Switcher Pills ── */}
      <HouseholdContextSwitcher
        households={households}
        activeHouseholdId={activeHousehold.id}
        onSwitch={switchHousehold}
        onCreateNew={() => setCreateSheetVisible(true)}
        onScanOrJoin={() => setJoinModalVisible(true)}
        language={language}
        currentUserId={user?.id}
      />

      {/* ── 2. Ultra-Compact Household Pulse & Member Filter Strip (~68px) ── */}
      <View style={styles.pulseStripContainer}>
        {/* Top Status & Invite Row */}
        <View style={styles.pulseStatusRow}>
          <View style={styles.pulseStatusLeft}>
            <View
              style={[
                styles.pulseStatusDot,
                {
                  backgroundColor: isAllClean
                    ? '#10B981'
                    : overdueCount > 0
                      ? '#EF4444'
                      : '#F59E0B',
                },
              ]}
            />
            <Text style={styles.pulseStatusText}>
              {isAllClean
                ? (language === 'hi' ? 'सब कुछ ठीक है ✨' : '100% All Caught Up ✨')
                : overdueCount > 0
                  ? (language === 'hi' ? `${overdueCount} कार्य विलंबित` : `${overdueCount} chore${overdueCount > 1 ? 's' : ''} overdue`)
                  : (language === 'hi' ? `${stats.onTime} / ${stats.total} कार्य समय पर` : `${stats.onTime} of ${stats.total} on-track`)}
            </Text>
            <Text style={styles.pulseStatusSub}>
              • {members.length} {language === 'hi' ? 'सदस्य' : members.length === 1 ? 'member' : 'members'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setInviteModalVisible(true)}
            style={styles.pulseInviteBtn}
            activeOpacity={0.7}
            hitSlop={6}
          >
            <AppIcon name="add" size={13} color={Colors.marigoldDeep} />
            <Text style={styles.pulseInviteText}>{language === 'hi' ? 'आमंत्रित करें' : 'Invite'}</Text>
          </TouchableOpacity>
        </View>

        {/* Interactive Member & Segment Filter Scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pulseFilterScroll}>
          {/* 'All' Filter Chip */}
          <TouchableOpacity
            onPress={() => {
              setFilterMemberCode(null);
              setActiveSegment('all');
            }}
            style={[
              styles.pulseFilterChip,
              activeSegment === 'all' && !filterMemberCode && styles.pulseFilterChipActive,
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.pulseFilterChipText,
                activeSegment === 'all' && !filterMemberCode && styles.pulseFilterChipTextActive,
              ]}
            >
              {language === 'hi' ? 'सभी' : 'All'}
            </Text>
            <View
              style={[
                styles.pulseCountBadge,
                activeSegment === 'all' && !filterMemberCode && styles.pulseCountBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.pulseCountBadgeText,
                  activeSegment === 'all' && !filterMemberCode && styles.pulseCountBadgeTextActive,
                ]}
              >
                {counts.all}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Roommate / Member Filter Chips */}
          {sortedMembers.map((m: any) => {
            const isSelected = filterMemberCode === m.code;
            return (
              <TouchableOpacity
                key={m.code || m.name}
                onPress={() => {
                  setFilterMemberCode(isSelected ? null : m.code);
                  setActiveSegment('all');
                }}
                style={[
                  styles.pulseMemberChip,
                  isSelected && styles.pulseMemberChipActive,
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.pulseMiniAvatar, { backgroundColor: m.color || Colors.tealDeep }]}>
                  <Text style={styles.pulseMiniAvatarText}>{initials(m.name)}</Text>
                </View>
                <Text
                  style={[styles.pulseMemberName, isSelected && styles.pulseMemberNameActive]}
                  numberOfLines={1}
                >
                  {m.name.split(' ')[0]}
                </Text>
                <View style={[styles.pulseCountBadge, isSelected && styles.pulseCountBadgeActive]}>
                  <Text
                    style={[
                      styles.pulseCountBadgeText,
                      isSelected && styles.pulseCountBadgeTextActive,
                    ]}
                  >
                    {m.tasksCount || 0}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* 'Open / Claimable' Chip */}
          <TouchableOpacity
            onPress={() => {
              setFilterMemberCode(null);
              setActiveSegment('claimable');
            }}
            style={[
              styles.pulseFilterChip,
              activeSegment === 'claimable' && styles.pulseFilterChipActive,
            ]}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 11, marginRight: 2 }}>✋</Text>
            <Text
              style={[
                styles.pulseFilterChipText,
                activeSegment === 'claimable' && styles.pulseFilterChipTextActive,
              ]}
            >
              {language === 'hi' ? 'दावा करें' : 'Claimable'}
            </Text>
            <View
              style={[
                styles.pulseCountBadge,
                activeSegment === 'claimable' && styles.pulseCountBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.pulseCountBadgeText,
                  activeSegment === 'claimable' && styles.pulseCountBadgeTextActive,
                ]}
              >
                {counts.claimable}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 'Rotations' Chip */}
          {counts.rotations > 0 && (
            <TouchableOpacity
              onPress={() => {
                setFilterMemberCode(null);
                setActiveSegment('rotations');
              }}
              style={[
                styles.pulseFilterChip,
                activeSegment === 'rotations' && styles.pulseFilterChipActive,
              ]}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 11, marginRight: 2 }}>🔄</Text>
              <Text
                style={[
                  styles.pulseFilterChipText,
                  activeSegment === 'rotations' && styles.pulseFilterChipTextActive,
                ]}
              >
                {language === 'hi' ? 'रोटेशन' : 'Rotations'}
              </Text>
              <View
                style={[
                  styles.pulseCountBadge,
                  activeSegment === 'rotations' && styles.pulseCountBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.pulseCountBadgeText,
                    activeSegment === 'rotations' && styles.pulseCountBadgeTextActive,
                  ]}
                >
                  {counts.rotations}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* ── 3. Chores Section Header ── */}
      <View
        style={styles.sharedHeaderRow}
        onLayout={(e) => { sharedTasksY.current = e.nativeEvent.layout.y; }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.hhSectionHeading}>
            {language === 'hi' ? 'घर के कार्य' : 'Household Chores'}
          </Text>
          <View style={styles.choresCountBadge}>
            <Text style={styles.choresCountBadgeText}>{filteredSharedTasks.length}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {filterMemberCode && (
            <TouchableOpacity onPress={() => setFilterMemberCode(null)} hitSlop={6}>
              <Text style={styles.clearFilterText}>{language === 'hi' ? 'फ़िल्टर हटाएं ✕' : 'Clear filter ✕'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onOpenSettings} hitSlop={8} style={{ padding: 4 }}>
            <AppIcon name="settings-outline" size={18} color={Colors.inkSoft} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 4. Chores List / Empty State ── */}
      {householdScopedTasks.length === 0 ? (
        <EmptyState
          icon="🏠"
          title={language === 'hi' ? `${activeHousehold.name} में कोई कार्य नहीं` : `No tasks in ${activeHousehold.name} yet`}
          subtitle={language === 'hi' ? 'इस घर में जोड़े गए कार्य सभी सदस्यों को यहाँ दिखाई देंगे।' : 'Tasks added to this household will appear here for all members.'}
        />
      ) : filteredSharedTasks.length === 0 ? (
        <View style={styles.emptyFilteredBox}>
          <Text style={styles.emptyFilteredTitle}>
            {language === 'hi' ? 'इस फ़िल्टर में कोई कार्य नहीं मिला' : 'No chores match current filter'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setFilterMemberCode(null);
              setActiveSegment('all');
            }}
            style={styles.resetFilterBtn}
          >
            <Text style={styles.resetFilterBtnText}>
              {language === 'hi' ? 'सभी कार्य दिखाएं' : 'Show All Chores'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        filteredSharedTasks.map((task) => (
          <SharedTaskCard
            key={task.id}
            task={task}
            language={language}
            onPress={() => setSelectedTaskId(task.id)}
            user={user}
            members={activeMembers}
            onClaim={() => claimTask(task.id)}
            onNudge={() => {
              const targetMember = activeMembers.find(
                (m) => m.userId === task.assignedTo || m.code === task.assignedTo
              );
              handleNudge(task, targetMember);
            }}
          />
        ))
      )}

      {/* ── 5. Quick-Access Activity Hub ── */}
      <View style={styles.quickAccessHub}>
        <TouchableOpacity
          onPress={() => setActivityVisible(true)}
          style={styles.quickAccessCard}
          activeOpacity={0.7}
        >
          <View style={styles.quickAccessLeft}>
            <View style={[styles.quickAccessIconWrap, { backgroundColor: 'rgba(232, 163, 61, 0.12)' }]}>
              <AppIcon name="stats-chart-outline" size={18} color={Colors.marigoldDeep} />
            </View>
            <View>
              <Text style={styles.quickAccessTitle}>
                {language === 'hi' ? 'गतिविधि इतिहास' : 'Recent Activity Log'}
              </Text>
              <Text style={styles.quickAccessSub}>
                {language === 'hi' ? 'कार्यों को पूरा करने का इतिहास देखें' : 'View recent completions, claims, and nudges'}
              </Text>
            </View>
          </View>
          <AppIcon name="chevron-forward" size={16} color={Colors.inkFaint} />
        </TouchableOpacity>
      </View>

      {/* ── 6. Invite & Add Member Bottom Sheet Modal ── */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        {/* Full-screen wrapper so KeyboardAvoidingView can push the sheet up */}
        <View style={{ flex: 1 }}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setInviteModalVisible(false)}
          />
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: 'flex-end' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <View style={styles.inviteSheetContainer}>
              <View style={styles.sheetHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <AppIcon name="people-outline" size={20} color={Colors.marigoldDeep} />
                  <Text style={styles.sheetTitle}>
                    {language === 'hi' ? 'परिवार में जोड़ें' : 'Add Roommate or Family'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setInviteModalVisible(false)} hitSlop={10} style={styles.sheetCloseBtn}>
                  <AppIcon name="close" size={20} color={Colors.ink} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                {(activeHousehold.code || user?.userCode) && (
                  <View style={styles.inviteShareCard}>
                    <Text style={styles.inviteShareLabel}>
                      {language === 'hi' ? 'घर का आमंत्रण कोड (रूममेट्स के साथ साझा करें):' : 'Household Invite Code (Share with Roommates):'}
                    </Text>
                    <View style={styles.inviteShareCodeRow}>
                      <Text style={styles.inviteShareCodeText}>{activeHousehold.code || user.userCode}</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={handleCopyCode}
                          style={styles.inviteCopyBtn}
                          activeOpacity={0.7}
                        >
                          <AppIcon name={copiedCode ? 'checkmark' : 'copy-outline'} size={13} color={Colors.tealDeep} />
                          <Text style={styles.inviteCopyBtnText}>
                            {copiedCode ? (language === 'hi' ? 'कॉपी!' : 'Copied!') : (language === 'hi' ? 'कॉपी' : 'Copy')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setShowQrCode(!showQrCode)}
                          style={styles.inviteQrBtn}
                          activeOpacity={0.7}
                        >
                          <AppIcon name="qr-code-outline" size={13} color={Colors.marigoldDeep} />
                          <Text style={styles.inviteQrBtnText}>
                            {showQrCode ? (language === 'hi' ? 'छिपाएं' : 'Hide QR') : 'QR'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {showQrCode && (
                      <View style={styles.qrCodeWrapper}>
                        <QRCode value={activeHousehold.code || user.userCode} size={140} />
                        <Text style={styles.qrCodeInstruction}>
                          {language === 'hi' ? 'रूममेट इस कोड को अपने फोन से स्कैन करके घर में शामिल हो सकते हैं' : 'Roommate can scan this with Repeto scanner to join this household'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.inviteDividerRow}>
                  <View style={styles.inviteDividerLine} />
                  <Text style={styles.inviteDividerText}>
                    {language === 'hi' ? 'या रूममेट का कोड दर्ज करें' : "OR ENTER ROOMMATE'S CODE"}
                  </Text>
                  <View style={styles.inviteDividerLine} />
                </View>

                <View style={styles.manualJoinRow} testID="household-manual-join-row">
                  <View style={styles.codeInputBox}>
                    <TextInput
                      value={codeInput}
                      onChangeText={setCodeInput}
                      autoCapitalize="characters"
                      placeholder={language === 'hi' ? 'यूज़र कोड (जैसे: RPT-XXXXXX)' : 'User Code (e.g. RPT-XXXXXX)'}
                      placeholderTextColor={Colors.inkFaint}
                      style={styles.codeInputField}
                      testID="household-join-code-input"
                      returnKeyType="done"
                      onSubmitEditing={async () => { await addByCode(); if (codeInput.trim()) setInviteModalVisible(false); }}
                    />
                    <TouchableOpacity
                      onPress={async () => {
                        if (!permission || !permission.granted) {
                          const res = await requestPermission();
                          if (!res.granted) {
                            showToast(language === 'hi' ? 'कैमरा अनुमति आवश्यक है' : 'Camera permission is required');
                            return;
                          }
                        }
                        Keyboard.dismiss();
                        setScannerVisible(true);
                      }}
                      style={styles.codeInputCameraBtn}
                      testID="household-scanner-btn"
                      hitSlop={8}
                    >
                      <AppIcon name="camera-outline" size={18} color={Colors.indigo950} />
                    </TouchableOpacity>
                  </View>
                  <Button
                    title={language === 'hi' ? 'जोड़ें' : 'Add'}
                    loading={addingCode}
                    onPress={async () => {
                      await addByCode();
                      if (codeInput.trim()) {
                        setInviteModalVisible(false);
                      }
                    }}
                    style={styles.manualJoinBtn}
                    testID="household-join-btn"
                  />
                </View>

                <Text style={styles.inviteFooterNote}>
                  {language === 'hi'
                    ? 'जुड़ने के बाद, सभी सदस्य एक साथ कार्य साझा कर सकते हैं और रोटेशन सेट कर सकते हैं।'
                    : 'Linked members can immediately share chores, claim duties, and set turn rotations.'}
                </Text>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── 7. Join Household Modal (From Context Switcher Scan/Join Pill) ── */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setJoinModalVisible(false)}
          />
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: 'flex-end' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.inviteSheetContainer}>
              <View style={styles.sheetHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <AppIcon name="home-outline" size={20} color={Colors.tealDeep} />
                  <Text style={styles.sheetTitle}>
                    {language === 'hi' ? 'घर से जुड़ें' : 'Join a Household'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setJoinModalVisible(false)} hitSlop={10} style={styles.sheetCloseBtn}>
                  <AppIcon name="close" size={20} color={Colors.ink} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                <Text style={{ fontFamily: 'Manrope_500Medium', fontSize: 13, color: Colors.inkSoft, marginBottom: 14 }}>
                  {language === 'hi'
                    ? 'किसी भी घर का कोड दर्ज करें या उसका क्यूआर कोड स्कैन करें:'
                    : 'Enter any household invite code or scan its QR code to join:'}
                </Text>

                <View style={styles.manualJoinRow}>
                  <View style={styles.codeInputBox}>
                    <TextInput
                      value={joinCodeInput}
                      onChangeText={setJoinCodeInput}
                      autoCapitalize="characters"
                      placeholder={language === 'hi' ? 'घर का कोड (जैसे: RPT-XXXXXX)' : 'Household Code (e.g. RPT-XXXXXX)'}
                      placeholderTextColor={Colors.inkFaint}
                      style={styles.codeInputField}
                      returnKeyType="done"
                      onSubmitEditing={async () => {
                        await handleJoinHousehold();
                      }}
                    />
                    <TouchableOpacity
                      onPress={async () => {
                        if (!permission || !permission.granted) {
                          const res = await requestPermission();
                          if (!res.granted) {
                            showToast(language === 'hi' ? 'कैमरा अनुमति आवश्यक है' : 'Camera permission is required');
                            return;
                          }
                        }
                        Keyboard.dismiss();
                        setJoinScannerVisible(true);
                      }}
                      style={styles.codeInputCameraBtn}
                      hitSlop={8}
                    >
                      <AppIcon name="camera-outline" size={18} color={Colors.indigo950} />
                    </TouchableOpacity>
                  </View>
                  <Button
                    title={language === 'hi' ? 'जुड़ें' : 'Join'}
                    loading={joiningHh}
                    onPress={async () => {
                      await handleJoinHousehold();
                    }}
                    style={styles.manualJoinBtn}
                  />
                </View>

                <Text style={styles.inviteFooterNote}>
                  {language === 'hi'
                    ? 'जुड़ने के बाद, आप इस घर के सभी साझा कार्यों, रोटेशन और जिम्मेदारियों को तुरंत देख और प्रबंधित कर सकेंगे।'
                    : 'Once joined, you will immediately see and collaborate on all chores, turn rotations, and shared tasks for that household.'}
                </Text>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Join QR Scanner Modal ── */}
      <Modal visible={joinScannerVisible} transparent={false} animationType="slide" onRequestClose={() => setJoinScannerVisible(false)}>
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleJoinBarcodeScanned}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scanTarget} />
            <Text style={styles.scannerInstructions}>
              {language === 'hi' ? 'घर का क्यूआर कोड स्कैन करने के लिए फ्रेम में रखें' : 'Align household QR code inside the frame to scan'}
            </Text>
            <Button
              title={language === 'hi' ? 'रद्द करें' : 'Cancel'}
              onPress={() => setJoinScannerVisible(false)}
              style={styles.scannerCloseBtn}
            />
          </View>
        </View>
      </Modal>

      {/* ── 8. QR Scanner Modal ── */}
      <Modal visible={scannerVisible} transparent={false} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scanTarget} />
            <Text style={styles.scannerInstructions}>
              {language === 'hi' ? 'आमंत्रण कोड स्कैन करने के लिए क्यूआर कोड को फ्रेम में रखें' : 'Align QR code inside the frame to scan'}
            </Text>
            <Button
              title={language === 'hi' ? 'रद्द करें' : 'Cancel'}
              onPress={() => setScannerVisible(false)}
              style={styles.scannerCloseBtn}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// HouseholdScreen — Top-level shell: manages modals, auth state, task actions.
// ────────────────────────────────────────────────────────────────────────────
export default function HouseholdScreen() {
  const { user, updateUser, activeHousehold, switchHousehold, createHousehold, deleteHousehold, leaveHousehold, removeMemberFromHousehold } = useAuth();
  const { tasks, completeTask, snoozeTask, skipTask, deleteTask, archiveTask, pinTask, duplicateTask, setTaskDueDate, updateTask, deleteHistoryEntry, removeHouseholdMemberAndCleanup, unshareAllLocalTasks, claimTask, refreshTasks, purgeHouseholdTasks } = useTasks();
  const { handleNudge } = useNudge();
  const { showToast } = useToast();
  const { translate, language } = useTranslation();
  const { addNotification } = useNotifications();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [activityVisible, setActivityVisible] = useState(false);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const households = listHouseholds(user ?? ({} as any));

  // Scope tasks to the active household
  const householdScopedTasks = useMemo(() => {
    if (!activeHousehold) return [];
    return tasks.filter((t) => t.householdId === activeHousehold.id);
  }, [tasks, activeHousehold?.id]);

  const { members: activeHouseholdMembers } = useHousehold(householdScopedTasks);

  const scrollRef = useRef<ScrollView>(null);
  const sharedTasksY = useRef<number>(0);
  const activityY = useRef<number>(0);

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  const editingTask = editingTaskId ? tasks.find((t) => t.id === editingTaskId) ?? null : null;
  const editingInitialValues = useMemo(
    () => (editingTask ? taskToFormValues(editingTask, language) : null),
    [editingTask?.id, editingTask?.updatedAt, language]
  );

  useEffect(() => {
    if (user?.removedBy) {
      const removedBy = user.removedBy;
      if (Platform.OS === 'web') {
        window.alert(
          language === 'hi'
            ? `आपको ${removedBy} द्वारा परिवार से हटा दिया गया है। सभी साझा कार्य अनशेयर या हटा दिए गए हैं।`
            : `You were removed from the household by ${removedBy}. All shared tasks are unshared or removed.`
        );
        (async () => {
          await updateUser({ removedBy: undefined });
          await unshareAllLocalTasks();
        })();
      } else {
        Alert.alert(
          language === 'hi' ? 'परिवार से हटाया गया' : 'Removed from Household',
          language === 'hi'
            ? `आपको ${removedBy} द्वारा परिवार से हटा दिया गया है। सभी साझा कार्य अनशेयर या हटा दिए गए हैं।`
            : `You were removed from the household by ${removedBy}. All shared tasks are unshared or removed.`,
          [{
            text: 'OK',
            onPress: async () => {
              await updateUser({ removedBy: undefined });
              await unshareAllLocalTasks();
            },
          }]
        );
      }
    }
  }, [user?.removedBy, language, unshareAllLocalTasks, updateUser]);

  const handleAction = async (action: () => Promise<void>) => {
    await action();
    setSelectedTaskId(null);
  };

  return (
    <View style={styles.root}>
      <ScreenShell
        title={translate('hhTitle') + ' 🏠'}
        subtitle={translate('hhSub')}
        scrollRef={scrollRef}
        onRefresh={refreshTasks}
      >
        {households.length === 0 ? (
          // ── Zero-Household State ──
          <ZeroHouseholdCard
            language={language}
            showToast={showToast}
            translate={translate}
            setCreateSheetVisible={setCreateSheetVisible}
            user={user}
          />
        ) : (
          // ── Active Household View (all content scoped here) ──
          <HouseholdView
            user={user}
            activeHousehold={activeHousehold!}
            households={households}
            householdScopedTasks={householdScopedTasks}
            allTasks={tasks}
            language={language}
            translate={translate}
            showToast={showToast}
            addNotification={addNotification}
            updateUser={updateUser}
            createHousehold={createHousehold}
            switchHousehold={switchHousehold}
            setCreateSheetVisible={setCreateSheetVisible}
            setSelectedTaskId={setSelectedTaskId}
            setEditingTaskId={setEditingTaskId}
            setActivityVisible={setActivityVisible}
            removeHouseholdMemberAndCleanup={removeHouseholdMemberAndCleanup}
            removeMemberFromHousehold={removeMemberFromHousehold}
            scrollRef={scrollRef}
            sharedTasksY={sharedTasksY}
            activityY={activityY}
            onOpenSettings={() => setSettingsVisible(true)}
          />
        )}
      </ScreenShell>

      {/* ── Create Household Sheet ── */}
      <CreateHouseholdSheet
        visible={createSheetVisible}
        onClose={() => setCreateSheetVisible(false)}
        onCreate={async (name, icon, color) => {
          const result = await createHousehold(name, icon, color);
          if (result.ok) {
            showToast(language === 'hi' ? 'घर बना दिया!' : 'Household created!');
          } else if (result.error === 'name_exists') {
            showToast(language === 'hi' ? 'इस नाम का घर पहले से मौजूद है' : 'Household with this name already exists');
          } else if (result.error === 'limit_reached') {
            showToast(language === 'hi' ? 'अधिक घर जोड़ने के लिए अपग्रेड करें' : 'Upgrade to add more households');
          }
          return result;
        }}
        existingCount={households.length}
        language={language}
      />

      {/* ── Household Settings Sheet ── */}
      {activeHousehold && (
        <HouseholdSettingsSheet
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          activeHousehold={activeHousehold}
          currentUserId={user?.id ?? ''}
          currentUserName={user?.name ?? ''}
          language={language}
          membersWithStats={activeHouseholdMembers}
          onDeleteHousehold={async (hhId) => {
            await purgeHouseholdTasks(hhId);
            return await deleteHousehold(hhId);
          }}
          onLeaveHousehold={async (hhId) => {
            await purgeHouseholdTasks(hhId);
            return await leaveHousehold(hhId);
          }}
          onRemoveMember={removeMemberFromHousehold}
          showToast={showToast}
        />
      )}

      {/* Recent Activity Modal */}
      <Modal
        visible={activityVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setActivityVisible(false)}
      >
        <Pressable style={styles.activityBackdrop} onPress={() => setActivityVisible(false)} />
        <View style={styles.activitySheet}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityTitle}>
              {language === 'hi' ? 'हालिया गतिविधि' : 'Recent Activity'}
            </Text>
            <Pressable onPress={() => setActivityVisible(false)} hitSlop={12} style={styles.activityCloseBtn}>
              <AppIcon name="close" size={20} color={Colors.ink} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            <ActivityFeed
              tasks={householdScopedTasks}
              members={activeHousehold?.members ?? []}
              currentUserId={user?.id}
              currentUserName={user?.name ?? 'You'}
              language={language}
            />
          </ScrollView>
        </View>
      </Modal>

      <TaskDetailSheet
        task={selectedTask}
        visible={!!selectedTask}
        language={language}
        translate={translate}
        onClose={() => setSelectedTaskId(null)}
        onComplete={(id, note, options) => handleAction(() => completeTask(id, note, options))}
        onSnooze={(id, days) => handleAction(() => snoozeTask(id, days))}
        onSkip={(id) => handleAction(() => skipTask(id))}
        onDelete={(id) => handleAction(() => deleteTask(id))}
        onArchive={(id) => handleAction(() => archiveTask(id))}
        onPin={(id) => handleAction(() => pinTask(id))}
        onDuplicate={(id) => { duplicateTask(id); setSelectedTaskId(null); }}
        onEdit={(id) => {
          setSelectedTaskId(null);
          setEditingTaskId(id);
        }}
        onSetDueDate={(id, date) => handleAction(() => setTaskDueDate(id, date))}
        onDeleteHistoryEntry={deleteHistoryEntry}
        onClaim={(id) => handleAction(() => claimTask(id))}
        onNudge={(id) => {
          const t = tasks.find((x) => x.id === id);
          if (t) {
            const allMembers = activeHousehold?.members ?? user?.householdMembers ?? [];
            const targetMember = allMembers.find(
              (m) => m.userId === t.assignedTo || m.code === t.assignedTo
            );
            handleNudge(t, targetMember);
          }
        }}
      />

      <TaskFormSheet
        visible={!!editingTask}
        language={language}
        translate={translate}
        heading={translate('editTask')}
        initial={editingInitialValues}
        initialShared={editingTask?.sharedWith}
        editingTaskId={editingTask?.id}
        mode="edit"
        saveLabel={translate('savePreset')}
        onClose={() => setEditingTaskId(null)}
        onSave={async (values, shared) => {
          if (!editingTaskId) return;
          await updateTask(editingTaskId, values, shared);
          setEditingTaskId(null);
        }}
      />
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ZeroHouseholdCard — Clean empty state when user has no households.
// ────────────────────────────────────────────────────────────────────────────
function ZeroHouseholdCard({
  language,
  showToast,
  translate,
  setCreateSheetVisible,
  user,
}: {
  language: 'en' | 'hi';
  showToast: (msg: string) => void;
  translate: (key: import('@/i18n').TranslationKey) => string;
  setCreateSheetVisible: (v: boolean) => void;
  user: any;
}) {
  const [codeInput, setCodeInput] = useState('');
  const [addingCode, setAddingCode] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const { updateUser, createHousehold, joinHouseholdByCode } = useAuth();

  const addByCode = async (customCode?: string) => {
    if (!user) return;
    const code = normalizeInviteCode(customCode ?? codeInput);
    if (!isValidInviteCode(code)) {
      showToast(translate('invalidInviteCode'));
      return;
    }
    if (user.userCode && code === user.userCode) {
      showToast(translate('cannotAddOwnCode'));
      return;
    }

    setAddingCode(true);

    try {
      const joinRes = await joinHouseholdByCode(code);
      if (joinRes.ok) {
        showToast(
          language === 'hi'
            ? `"${joinRes.household?.name || 'घर'}" में शामिल हो गए!`
            : `Joined "${joinRes.household?.name || 'household'}"!`
        );
        setCodeInput('');
        return;
      }
      if (joinRes.alreadyMember) {
        showToast(language === 'hi' ? 'आप पहले से ही इस घर के सदस्य हैं' : 'You are already in this household');
        setCodeInput('');
        return;
      }
      if (joinRes.error === 'limit_reached') {
        showToast(
          language === 'hi'
            ? 'अधिकतम घर सीमा समाप्त हो गई है (5)'
            : 'Maximum household limit reached (5)'
        );
        return;
      }
      if (joinRes.error === 'household_not_found') {
        showToast(
          language === 'hi'
            ? 'घर नहीं मिला। कृपया कोड जांचें या घर का QR कोड स्कैन करें।'
            : 'Household not found. Please check code or scan Household QR code.'
        );
        return;
      }
      showToast(language === 'hi' ? 'शामिल होने में विफल' : 'Failed to join household');
    } catch {
      showToast(language === 'hi' ? 'शामिल होने में विफल' : 'Failed to join household');
    } finally {
      setAddingCode(false);
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setScannerVisible(false);
    if (data) {
      setCodeInput(data);
      Keyboard.dismiss();
      await addByCode(data);
    }
  };

  return (
    <>
      <Card style={styles.noHouseholdCard} mode="elevated">
        <Card.Content style={styles.noHouseholdContent}>
          <View style={styles.noHouseholdIconWrap}>
            <Text style={{ fontSize: 34 }}>🏠</Text>
          </View>
          <Text style={styles.noHouseholdTitle}>
            {language === 'hi' ? 'कोई परिवार/घर नहीं जुड़ा' : 'No Household Created Yet'}
          </Text>
          <Text style={styles.noHouseholdSub}>
            {language === 'hi'
              ? 'अपने परिवार, रूममेट्स या कार्यालय के साथ मिलकर आवर्ती कार्यों को प्रबंधित करें। एक नया घर बनाएं या कोड से जुड़ें।'
              : 'Manage recurring tasks together with family or flatmates. Create a new household or join an existing one using a code.'}
          </Text>

          <View style={styles.noHouseholdActionRow}>
            <Button
              title={language === 'hi' ? '+ नया घर बनाएं' : '+ Create Household'}
              onPress={() => setCreateSheetVisible(true)}
              style={styles.createHhBtn}
            />
          </View>

          <View style={styles.joinHhDivider}>
            <Text style={styles.joinHhDividerText}>{language === 'hi' ? 'या कोड से जुड़ें' : 'OR JOIN WITH CODE'}</Text>
          </View>

          <View style={styles.manualJoinRow} testID="household-manual-join-row">
            <View style={styles.codeInputBox}>
              <TextInput
                value={codeInput}
                onChangeText={setCodeInput}
                autoCapitalize="characters"
                placeholder={language === 'hi' ? 'घर या यूज़र कोड (जैसे: RPT-XXXXXX)' : 'Household or User Code (e.g. RPT-XXXXXX)'}
                placeholderTextColor={Colors.inkFaint}
                style={styles.codeInputField}
                testID="household-join-code-input"
                returnKeyType="done"
                onSubmitEditing={() => addByCode()}
              />
              <TouchableOpacity
                onPress={async () => {
                  if (!permission || !permission.granted) {
                    const res = await requestPermission();
                    if (!res.granted) {
                      showToast(language === 'hi' ? 'कैमरा अनुमति आवश्यक है' : 'Camera permission is required');
                      return;
                    }
                  }
                  Keyboard.dismiss();
                  setScannerVisible(true);
                }}
                style={styles.codeInputCameraBtn}
                testID="household-scanner-btn"
                hitSlop={8}
              >
                <AppIcon name="camera-outline" size={18} color={Colors.indigo950} />
              </TouchableOpacity>
            </View>
            <Button
              title={language === 'hi' ? 'जोड़ें' : 'Join'}
              loading={addingCode}
              onPress={() => addByCode()}
              style={styles.manualJoinBtn}
              testID="household-join-btn"
            />
          </View>
        </Card.Content>
      </Card>

      {/* QR Scanner for zero-household join */}
      <Modal visible={scannerVisible} transparent={false} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scanTarget} />
            <Text style={styles.scannerInstructions}>
              {language === 'hi' ? 'आमंत्रण कोड स्कैन करने के लिए क्यूआर कोड को फ्रेम में रखें' : 'Align QR code inside the frame to scan'}
            </Text>
            <Button
              title={language === 'hi' ? 'रद्द करें' : 'Cancel'}
              onPress={() => setScannerVisible(false)}
              style={styles.scannerCloseBtn}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}




const styles = StyleSheet.create({
  root: { flex: 1 },
  inviteCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: 14,
    elevation: 2,
  },
  inviteLabel: { ...Typography.label, color: Colors.inkFaint, marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  codeActions: { flexDirection: 'row', gap: 8 },
  qrCenteredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23, 27, 54, 0.45)',
  },
  qrSheet: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    width: 290,
    elevation: 8,
    overflow: 'hidden',
  },
  qrContent: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16,
  },
  qrTitle: {
    ...Typography.title,
    fontSize: 16,
    color: Colors.ink,
    textAlign: 'center',
  },
  qrCodeText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 22,
    color: Colors.marigoldDeep,
    letterSpacing: 2,
  },
  qrCloseBtn: {
    width: '90%',
    marginVertical: 0,
  },
  codeText: {
    flex: 1,
    fontFamily: 'Fraunces_700Bold',
    fontSize: 28,
    letterSpacing: 1.8,
    color: Colors.indigo950,
  },
  shareIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.ivoryDim,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inviteHint: { ...Typography.bodySm, color: Colors.inkSoft, marginTop: 6, lineHeight: 19 },
  shareRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  shareBtn: {
    flex: 1,
    marginVertical: 0,
  },
  joinLabel: { ...Typography.label, color: Colors.inkFaint, marginTop: 18, marginBottom: 8 },
  joinRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  codeInput: {
    flex: 1,
    fontSize: 15,
    height: 48,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 1,
  },
  joinBtn: { minWidth: 82, marginVertical: 0 },
  // 1. Ultra-Compact Household Pulse & Interactive Filter Strip Styles
  pulseStripContainer: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  pulseStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pulseStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pulseStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pulseStatusText: {
    fontSize: 12.5,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.indigo950,
  },
  pulseStatusSub: {
    fontSize: 11.5,
    fontFamily: 'Manrope_500Medium',
    color: Colors.inkSoft,
  },
  pulseInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pulseInviteText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: '#B45309',
  },
  pulseFilterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingRight: 6,
  },
  pulseFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  pulseFilterChipActive: {
    backgroundColor: Colors.tealDeep,
    borderColor: Colors.tealDeep,
  },
  pulseFilterChipText: {
    fontSize: 11.5,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.inkSoft,
  },
  pulseFilterChipTextActive: {
    color: Colors.white,
    fontFamily: 'Manrope_800ExtraBold',
  },
  pulseMemberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  pulseMemberChipActive: {
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    borderColor: Colors.tealDeep,
  },
  pulseMiniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseMiniAvatarText: {
    fontSize: 9.5,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.white,
  },
  pulseMemberName: {
    fontSize: 11.5,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.inkSoft,
  },
  pulseMemberNameActive: {
    color: Colors.tealDeep,
    fontFamily: 'Manrope_800ExtraBold',
  },
  pulseCountBadge: {
    marginLeft: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.full,
    backgroundColor: Colors.ivoryLine,
  },
  pulseCountBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  pulseCountBadgeText: {
    fontSize: 9.5,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.ink,
  },
  pulseCountBadgeTextActive: {
    color: Colors.white,
  },

  // 2. Headings & View All Links
  hhSectionHeading: {
    fontSize: 18,
    fontFamily: 'Fraunces_700Bold',
    color: Colors.indigo950,
  },
  hhViewAllLink: {
    fontSize: 12.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.marigoldDeep,
  },

  // 3. SharedTaskCard Styles
  sharedCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    elevation: 2,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  sharedCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
  },
  sharedCatIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    marginTop: 1,
  },
  sharedCatIcon: {
    fontSize: 20,
  },
  sharedBodyCol: {
    flex: 1,
    gap: 5,
  },
  sharedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sharedTitle: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.indigo950,
    marginRight: 8,
  },
  sharedStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  sharedStatusPill: {
    paddingHorizontal: 7.5,
    paddingVertical: 2.5,
    borderRadius: Radius.full,
  },
  sharedStatusText: {
    fontSize: 9.5,
    fontFamily: 'Manrope_800ExtraBold',
  },
  sharedSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 5,
  },
  sharedSubText: {
    fontSize: 10.5,
    fontFamily: 'Manrope_500Medium',
    color: Colors.inkSoft,
    flexShrink: 1,
  },
  sharedSubBold: {
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
  },
  sharedDotSep: {
    fontSize: 10,
    color: Colors.inkFaint,
  },
  sharedDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  sharedDateText: {
    fontSize: 10,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.inkFaint,
  },
  sharedBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sharedRespBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7.5,
    paddingVertical: 2.5,
    borderRadius: Radius.full,
    borderWidth: 1,
    flexShrink: 1,
  },
  sharedRespBadgeConstrained: {
    maxWidth: '70%',
  },
  sharedRespText: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
  },
  rotIconEmoji: {
    fontSize: 10,
    marginRight: 3,
  },
  respRotatingBadge: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  respMeBadge: {
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
    borderColor: 'rgba(13, 148, 136, 0.22)',
  },
  respMemberBadge: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  respOpenBadge: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  claimMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.tealDeep,
    flexShrink: 0,
  },
  claimMiniBtnText: {
    fontSize: 9.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.white,
  },
  nudgeMiniBtn: {
    marginLeft: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    flexShrink: 0,
  },
  nudgeMiniBtnText: {
    fontSize: 9.5,
    fontFamily: 'Manrope_700Bold',
    color: '#B45309',
  },
  choresCountBadge: {
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choresCountBadgeText: {
    fontSize: 11,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.tealDeep,
  },
  clearFilterText: {
    fontSize: 11.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.marigoldDeep,
  },
  emptyFilteredBox: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    marginVertical: 12,
  },
  emptyFilteredTitle: {
    fontSize: 13.5,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.inkSoft,
    marginBottom: 10,
  },
  resetFilterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.tealDeep,
  },
  resetFilterBtnText: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: Colors.white,
  },
  quickAccessHub: {
    marginTop: 18,
    marginBottom: 28,
    gap: 10,
  },
  quickAccessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 1,
  },
  quickAccessLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  quickAccessIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessTitle: {
    fontSize: 13.5,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.indigo950,
  },
  quickAccessSub: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    color: Colors.inkSoft,
    marginTop: 1,
  },
  sheetModalContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    padding: 20,
  },
  // Same as sheetModalContainer but without position:absolute — used in modals
  // where KeyboardAvoidingView needs the sheet in the normal flex flow
  inviteSheetContainer: {
    maxHeight: '85%',
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    padding: 20,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'Fraunces_700Bold',
    color: Colors.indigo950,
  },
  sheetCloseBtn: {
    padding: 4,
  },
  sheetInviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  sheetInviteBannerText: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: '#B45309',
  },
  inviteShareCard: {
    backgroundColor: '#FFFDF5',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.25)',
    padding: 14,
    marginBottom: 16,
  },
  inviteShareLabel: {
    fontSize: 11.5,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.inkSoft,
    marginBottom: 8,
  },
  inviteShareCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteShareCodeText: {
    fontSize: 20,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.tealDeep,
    letterSpacing: 1.5,
  },
  inviteCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inviteCopyBtnText: {
    fontSize: 11.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.tealDeep,
  },
  inviteQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  inviteQrBtnText: {
    fontSize: 11.5,
    fontFamily: 'Manrope_700Bold',
    color: '#B45309',
  },
  qrCodeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryLine,
    gap: 8,
  },
  qrCodeInstruction: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  inviteDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10,
  },
  inviteDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.ivoryLine,
  },
  inviteDividerText: {
    fontSize: 10.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkFaint,
    letterSpacing: 0.8,
  },
  inviteFooterNote: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    color: Colors.inkFaint,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 14,
  },
  memberSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  removeMemberBtn: {
    padding: 8,
  },
  manualJoinRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingTop: 12,
  },
  codeInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    borderRadius: Radius.sm,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    height: 48,
  },
  codeInputField: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.ink,
    height: 48,
  },
  codeInputCameraBtn: {
    padding: 4,
  },
  manualJoinInput: {
    flex: 1,
    fontSize: 13,
    backgroundColor: Colors.white,
  },
  manualJoinBtn: {
    minWidth: 70,
    alignSelf: 'center',
    marginVertical: 0,
    borderRadius: Radius.xs,
  },

  // 5. Member Card Styles
  memberCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 12,
    elevation: 1.5,
    overflow: 'hidden',
  },
  memberCardContent: {
    padding: 0,
  },
  memberRowRipple: {
    width: '100%',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  memberAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: Colors.white, fontFamily: 'Manrope_800ExtraBold', fontSize: 12 },
  memberInfo: { flex: 1 },
  memberName: { ...Typography.title, fontSize: 14, color: Colors.ink, marginBottom: 2 },
  memberMetaRow: { flexDirection: 'row', alignItems: 'center' },
  memberStat: { ...Typography.caption, color: Colors.inkSoft, fontSize: 11 },
  memberBullet: { color: Colors.inkFaint, marginHorizontal: 4, fontSize: 10 },
  memberOnTimeText: { ...Typography.caption, color: Colors.tealDeep, fontSize: 11, fontFamily: 'Manrope_700Bold' },
  progressLineBg: {
    height: 3,
    backgroundColor: Colors.ivoryLine,
    borderRadius: 2,
    marginTop: 6,
    width: '80%',
    overflow: 'hidden',
  },
  progressLineFill: {
    height: '100%',
    backgroundColor: Colors.teal,
    borderRadius: 2,
  },
  removeBtn: {
    padding: 6,
    borderRadius: 999,
  },
  emptySub: { ...Typography.bodySm, color: Colors.inkSoft, textAlign: 'center', paddingVertical: 16, lineHeight: 20 },
  memberRowRippleActive: {
    backgroundColor: 'rgba(232,163,61,0.06)',
  },
  memberAvatarSelected: {
    borderWidth: 2,
    borderColor: Colors.marigold,
  },
  rankBadge: {
    backgroundColor: Colors.marigold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  rankBadgeText: {
    color: Colors.white,
    fontSize: 9.5,
    fontFamily: 'Manrope_800ExtraBold',
  },
  sharedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },

  // Zero-Household Card Styles
  noHouseholdCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginVertical: 14,
    elevation: 2,
    overflow: 'hidden',
  },
  noHouseholdContent: {
    padding: 22,
    alignItems: 'center',
  },
  noHouseholdIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  noHouseholdTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 19,
    color: Colors.indigo950,
    textAlign: 'center',
    marginBottom: 6,
  },
  noHouseholdSub: {
    fontSize: 12.5,
    color: Colors.inkSoft,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  noHouseholdActionRow: {
    width: '100%',
    marginBottom: 14,
  },
  createHhBtn: {
    width: '100%',
  },
  joinHhDivider: {
    width: '100%',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryLine,
    paddingTop: 14,
    marginBottom: 12,
  },
  joinHhDividerText: {
    fontSize: 10.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkFaint,
    letterSpacing: 0.8,
  },

  // Scanner Styles
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTarget: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: Colors.marigold,
    backgroundColor: 'transparent',
    borderRadius: Radius.md,
    marginBottom: 24,
  },
  scannerInstructions: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginHorizontal: 40,
    marginBottom: 30,
    lineHeight: 20,
    fontFamily: 'Manrope_500Medium',
  },
  scannerCloseBtn: {
    minWidth: 150,
  },

  // Recent Activity Modal Styles
  activityBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  activitySheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '75%',
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    padding: 20,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
    paddingBottom: 12,
  },
  activityTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: Colors.indigo950,
  },
  activityCloseBtn: {
    padding: 4,
  },
});
