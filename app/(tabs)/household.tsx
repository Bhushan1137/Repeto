import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Platform, Modal, Pressable, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Card, TextInput as PaperInput } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTasks } from '@/providers/TaskProvider';
import { useAuth, useNetworkStatus } from '@/providers/AppProviders';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/hooks/useTranslation';

import { useNotifications } from '@/providers/NotificationProvider';
import type { AppNotification } from '@/types/notification';
import { useHousehold } from '@/hooks/useInsights';
import { useNudge } from '@/hooks/useNudge';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { TaskFormSheet } from '@/components/TaskFormSheet';
import { ScreenShell, EmptyState } from '@/components/ScreenShell';
import { Button } from '@/components/Button';
import { AppIcon } from '@/components/AppIcon';
import { ActivityFeed } from '@/components/ActivityFeed';
import { taskToFormValues } from '@/domain/preset';
import { userRepository } from '@/data/repositories/userRepository';
import { HouseholdContextSwitcher } from '@/components/HouseholdContextSwitcher';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { initials } from '@/domain/insights';
import { CreateHouseholdSheet } from "@/components/CreateHouseholdSheet";
import { HouseholdSettingsSheet } from "@/components/HouseholdSettingsSheet";
import {
  householdMemberFromInvite,
  normalizeInviteCode,
  pendingMemberFromCode,
  addMemberToHousehold,
  listHouseholds,
  memberColor,
  HOUSEHOLD_COLORS,
} from '@/domain/household';
import { Colors, Radius, Typography } from '@/constants/theme';
import type { RepeatingTask, CategoryKey, HouseholdMemberProfile, HouseholdContext } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { daysUntilDue } from '@/domain/recurrence';

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

  return (
    <Card style={styles.sharedCard} mode="elevated" onPress={onPress}>
      <Card.Content style={styles.sharedCardContent}>
        <View style={[styles.sharedCatIconWrap, { backgroundColor: catBg }]}>
          <Text style={[styles.sharedCatIcon, { color: catColor }]}>{task.icon || cat.icon}</Text>
        </View>

        <View style={styles.sharedInfoCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sharedTitle} numberOfLines={1}>{task.title}</Text>
            {task.isRotating && (
              <View style={styles.rotBadge}>
                <Text style={styles.rotBadgeText}>
                  {language === 'hi' ? `🔄 बारी: ${assigneeName}` : `🔄 Turn: ${assigneeName}`}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.sharedSubRow}>
            <Text style={styles.sharedSubText} numberOfLines={1}>
              {language === 'hi' ? 'साझाकर्ता: ' : 'Shared by '}<Text style={styles.sharedSubBold}>{creatorName}</Text>
            </Text>
            <View style={styles.sharedAssigneeWrap}>
              <AppIcon name="person-circle-outline" size={12} color={task.assignedTo ? Colors.tealDeep : Colors.inkFaint} style={{ marginRight: 3 }} />
              <Text style={styles.sharedSubText} numberOfLines={1}>
                {task.assignedTo ? (language === 'hi' ? 'सौंपा: ' : 'Assigned: ') : ''}
                <Text style={[styles.sharedSubBold, !task.assignedTo && { color: Colors.marigoldDeep }]}>
                  {assigneeName}
                </Text>
              </Text>
              {!task.assignedTo && onClaim && (
                <TouchableOpacity
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    onClaim();
                  }}
                  style={styles.claimMiniBtn}
                  hitSlop={6}
                >
                  <Text style={styles.claimMiniBtnText}>{language === 'hi' ? 'मैं करूंगा' : 'Claim'}</Text>
                </TouchableOpacity>
              )}
              {task.assignedTo && task.assignedTo !== user?.id && task.assignedTo !== user?.userCode && days <= 0 && onNudge && (
                <TouchableOpacity
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    onNudge();
                  }}
                  style={styles.nudgeMiniBtn}
                  hitSlop={6}
                >
                  <Text style={styles.nudgeMiniBtnText}>👉 {language === 'hi' ? 'नज़' : 'Nudge'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.sharedRightCol}>
          <View style={[styles.sharedStatusPill, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.sharedStatusText, { color: statusStyle.color }]}>{statusStyle.text}</Text>
          </View>
          <View style={styles.sharedDateRow}>
            <AppIcon name="calendar-outline" size={11} color={Colors.inkFaint} style={{ marginRight: 3 }} />
            <Text style={styles.sharedDateText}>{formattedDate}</Text>
          </View>
        </View>
        <AppIcon name="chevron-forward" size={16} color={Colors.inkFaint} style={{ marginLeft: 4 }} />
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
  scrollRef: React.RefObject<ScrollView | null>;
  sharedTasksY: React.MutableRefObject<number>;
  membersY: React.MutableRefObject<number>;
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
  scrollRef: _scrollRef,
  sharedTasksY,
  membersY: _membersY,
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
  const [membersSheetVisible, setMembersSheetVisible] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const overdueCount = useMemo(() => {
    return householdScopedTasks.filter((t) => daysUntilDue(t.nextDueDate) < 0).length;
  }, [householdScopedTasks]);

  const dueTodayCount = useMemo(() => {
    return householdScopedTasks.filter((t) => daysUntilDue(t.nextDueDate) === 0).length;
  }, [householdScopedTasks]);

  const isAllClean = overdueCount === 0 && dueTodayCount === 0 && (householdScopedTasks.length === 0 || stats.onTime === stats.total);

  const handleCopyCode = async () => {
    if (!user?.userCode) return;
    await Clipboard.setStringAsync(user.userCode);
    setCopiedCode(true);
    showToast(language === 'hi' ? 'कोड कॉपी हो गया!' : 'Invite code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
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
    if (!code || code.length < 7) {
      showToast(translate('invalidInviteCode'));
      return;
    }
    if (user.userCode && code === user.userCode) {
      showToast(translate('cannotAddOwnCode'));
      return;
    }
    if (activeMembers.some((m: HouseholdMemberProfile) => normalizeInviteCode(m.code) === code)) {
      showToast(translate('memberAlreadyAdded'));
      return;
    }

    setAddingCode(true);

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
      await addByCode(data);
    }
  };

  const _removeMember = async (code?: string) => {
    if (!user || !code) return;
    const member = activeMembers.find((m: HouseholdMemberProfile) => m.code === code);
    const memberName = member ? member.name : code;

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
      await removeHouseholdMemberAndCleanup(code, deleteTasks);
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
                  { text: language === 'hi' ? 'कार्य रखें' : 'Keep Tasks', onPress: () => removeHouseholdMemberAndCleanup(code, false) },
                  { text: language === 'hi' ? 'कार्य हटाएं' : 'Remove Tasks', style: 'destructive', onPress: () => removeHouseholdMemberAndCleanup(code, true) },
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

      {/* ── 5. Quick-Access Hub (Members & Activity) ── */}
      <View style={styles.quickAccessHub}>
        <TouchableOpacity
          onPress={() => setMembersSheetVisible(true)}
          style={styles.quickAccessCard}
          activeOpacity={0.7}
        >
          <View style={styles.quickAccessLeft}>
            <View style={[styles.quickAccessIconWrap, { backgroundColor: 'rgba(13, 148, 136, 0.1)' }]}>
              <AppIcon name="people-outline" size={18} color={Colors.tealDeep} />
            </View>
            <View>
              <Text style={styles.quickAccessTitle}>
                {language === 'hi' ? 'घर के सदस्य' : 'Household Members'} ({members.length})
              </Text>
              <Text style={styles.quickAccessSub}>
                {sortedMembers[0]
                  ? (language === 'hi'
                    ? `शीर्ष: ${sortedMembers[0].name.split(' ')[0]} 👑 (${Math.round(sortedMembers[0].onTimePercent)}% समय पर)`
                    : `Leader: ${sortedMembers[0].name.split(' ')[0]} 👑 (${Math.round(sortedMembers[0].onTimePercent)}% on-time)`)
                  : (language === 'hi' ? 'सदस्यों को प्रबंधित करें' : 'View rankings and manage members')}
              </Text>
            </View>
          </View>
          <AppIcon name="chevron-forward" size={16} color={Colors.inkFaint} />
        </TouchableOpacity>

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
        <Pressable style={styles.activityBackdrop} onPress={() => setInviteModalVisible(false)} />
        <View style={styles.sheetModalContainer}>
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

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {user?.userCode && (
              <View style={styles.inviteShareCard}>
                <Text style={styles.inviteShareLabel}>
                  {language === 'hi' ? 'आपका यूज़र कोड (दोस्तों के साथ साझा करें):' : 'Your Invite Code (Share with Roommates):'}
                </Text>
                <View style={styles.inviteShareCodeRow}>
                  <Text style={styles.inviteShareCodeText}>{user.userCode}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={handleCopyCode}
                      style={styles.inviteCopyBtn}
                      activeOpacity={0.7}
                    >
                      <AppIcon name="copy-outline" size={13} color={Colors.tealDeep} />
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
                    <QRCode value={user.userCode} size={140} />
                    <Text style={styles.qrCodeInstruction}>
                      {language === 'hi' ? 'रूममेट इस कोड को अपने फोन से स्कैन कर सकते हैं' : 'Roommate can scan this with Repeato scanner'}
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
              <PaperInput
                mode="outlined"
                value={codeInput}
                onChangeText={setCodeInput}
                autoCapitalize="characters"
                placeholder={language === 'hi' ? 'यूज़र कोड (जैसे: RPT-XXXXXX)' : 'User Code (e.g. RPT-XXXXXX)'}
                outlineColor={Colors.ivoryLine}
                activeOutlineColor={Colors.marigoldDeep}
                style={styles.manualJoinInput}
                textColor={Colors.ink}
                testID="household-join-code-input"
                right={
                  <PaperInput.Icon
                    icon={() => <AppIcon name="camera-outline" size={18} color={Colors.indigo950} />}
                    onPress={async () => {
                      if (!permission || !permission.granted) {
                        const res = await requestPermission();
                        if (!res.granted) {
                          showToast(language === 'hi' ? 'कैमरा अनुमति आवश्यक है' : 'Camera permission is required');
                          return;
                        }
                      }
                      setScannerVisible(true);
                    }}
                    testID="household-scanner-btn"
                  />
                }
                theme={{ colors: { background: Colors.white } }}
              />
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
      </Modal>

      {/* ── 7. Members Management Bottom Sheet Modal ── */}
      <Modal
        visible={membersSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMembersSheetVisible(false)}
      >
        <Pressable style={styles.activityBackdrop} onPress={() => setMembersSheetVisible(false)} />
        <View style={styles.sheetModalContainer}>
          <View style={styles.sheetHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppIcon name="people-outline" size={20} color={Colors.tealDeep} />
              <Text style={styles.sheetTitle}>
                {language === 'hi' ? 'घर के सदस्य' : 'Household Members'} ({members.length})
              </Text>
            </View>
            <TouchableOpacity onPress={() => setMembersSheetVisible(false)} hitSlop={10} style={styles.sheetCloseBtn}>
              <AppIcon name="close" size={20} color={Colors.ink} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => {
              setMembersSheetVisible(false);
              setTimeout(() => setInviteModalVisible(true), 250);
            }}
            style={styles.sheetInviteBanner}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppIcon name="add" size={16} color={Colors.marigoldDeep} />
              <Text style={styles.sheetInviteBannerText}>
                {language === 'hi' ? '+ नए सदस्य को आमंत्रित करें' : '+ Invite New Roommate'}
              </Text>
            </View>
            <AppIcon name="chevron-forward" size={14} color={Colors.inkSoft} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {members.map((m, idx) => {
              const key = m.isYou ? 'you' : (m.code || m.userId || m.name);
              const rank = sortedMembers.findIndex((sm) => (sm.isYou && m.isYou) || (sm.code && sm.code === m.code)) + 1;
              const rankLabel = rank === 1 ? '👑 #1' : `#${rank}`;

              return (
                <View key={key} style={[styles.memberSheetRow, idx === members.length - 1 && styles.lastRow]}>
                  <View style={[styles.memberAvatar, { backgroundColor: m.color }]}>
                    <Text style={styles.memberAvatarText}>{m.short}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.memberName}>
                        {m.isYou ? `${translate('you')} (${m.name.split(' ')[0]})` : m.name}
                      </Text>
                      {m.status !== 'pending' && (
                        <View style={styles.rankBadge}>
                          <Text style={styles.rankBadgeText}>{rankLabel}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.memberMetaRow}>
                      <Text style={styles.memberStat}>
                        {m.status === 'pending' ? translate('pendingMember') : `${m.taskCount} ${translate('tasks')}`}
                      </Text>
                      {m.status !== 'pending' && (
                        <>
                          <Text style={styles.memberBullet}>·</Text>
                          <Text style={styles.memberOnTimeText}>{m.onTimePercent}% {translate('memberOnTime')}</Text>
                        </>
                      )}
                    </View>
                    {m.status !== 'pending' && (
                      <View style={styles.progressLineBg}>
                        <View style={[styles.progressLineFill, { width: `${m.onTimePercent}%` }]} />
                      </View>
                    )}
                  </View>

                  {!m.isYou && (
                    <TouchableOpacity
                      onPress={() => _removeMember(m.code)}
                      hitSlop={8}
                      style={styles.removeMemberBtn}
                    >
                      <AppIcon name="trash-outline" size={16} color={Colors.inkFaint} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
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
  const { tasks, completeTask, snoozeTask, skipTask, deleteTask, archiveTask, pinTask, duplicateTask, setTaskDueDate, updateTask, deleteHistoryEntry, removeHouseholdMemberAndCleanup, unshareAllLocalTasks, claimTask } = useTasks();
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

  const scrollRef = useRef<ScrollView>(null);
  const sharedTasksY = useRef<number>(0);
  const membersY = useRef<number>(0);
  const activityY = useRef<number>(0);

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  const editingTask = editingTaskId ? tasks.find((t) => t.id === editingTaskId) ?? null : null;

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
            scrollRef={scrollRef}
            sharedTasksY={sharedTasksY}
            membersY={membersY}
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
          onDeleteHousehold={deleteHousehold}
          onLeaveHousehold={leaveHousehold}
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
        initial={editingTask ? taskToFormValues(editingTask, language) : null}
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
  const { updateUser, createHousehold } = useAuth();

  const addByCode = async (customCode?: string) => {
    if (!user) return;
    const code = normalizeInviteCode(customCode ?? codeInput);
    if (!code || code.length < 7) {
      showToast(translate('invalidInviteCode'));
      return;
    }
    if (user.userCode && code === user.userCode) {
      showToast(translate('cannotAddOwnCode'));
      return;
    }

    setAddingCode(true);

    // First resolve who we're joining
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

    // Check if the target user already has a household we can join
    let targetHhId: string | null = null;
    if (member.userId) {
      const remoteTarget = await userRepository.loadRemote(member.userId);
      const targetHh = remoteTarget?.activeHouseholdId
        ? (remoteTarget.households ?? []).find((h: HouseholdContext) => h.id === remoteTarget.activeHouseholdId)
        : (remoteTarget?.households ?? [])[0];

      if (targetHh) {
        // Join their household directly
        const myMember: HouseholdMemberProfile = {
          code: user.userCode || '',
          name: user.name,
          color: memberColor(user.id || user.email),
          userId: user.id,
          addedAt: new Date().toISOString(),
          status: 'active',
        };
        const hhForMe: HouseholdContext = {
          ...targetHh,
          members: targetHh.members.some((m: HouseholdMemberProfile) => m.userId === user.id)
            ? targetHh.members
            : [...targetHh.members, myMember],
          memberUids: Array.from(new Set([...(targetHh.memberUids ?? []), user.id, member.userId])),
        };

        // Also update target user's household to include me
        const updatedTargetMembers = targetHh.members.some((m: HouseholdMemberProfile) => m.userId === user.id)
          ? targetHh.members
          : [...targetHh.members, myMember];
        const updatedTargetHh: HouseholdContext = {
          ...targetHh,
          members: updatedTargetMembers,
          memberUids: Array.from(new Set([...(targetHh.memberUids ?? []), user.id])),
        };

        await updateUser({
          households: [hhForMe],
          activeHouseholdId: hhForMe.id,
        });
        await userRepository.saveHousehold(updatedTargetHh);

        // Update target user's profile
        if (remoteTarget) {
          const updatedTargetHouseholds = (remoteTarget.households ?? []).map((h: HouseholdContext) =>
            h.id === targetHh.id ? updatedTargetHh : h
          );
          await userRepository.saveOther(member.userId, {
            ...remoteTarget,
            households: updatedTargetHouseholds,
          });
        }

        targetHhId = hhForMe.id;
      }
    }

    if (!targetHhId) {
      // Fallback: create a Home household and add as pending
      const createRes = await createHousehold('Home', '🏠', HOUSEHOLD_COLORS[0]);
      if (createRes.ok) {
        showToast(userCodeMatch
          ? (language === 'hi' ? 'सदस्य को घर में जोड़ा गया' : 'Member added to household!')
          : translate('memberAddedPending'));
      }
    } else {
      showToast(language === 'hi' ? 'घर में शामिल हो गए!' : 'Joined household!');
    }

    setAddingCode(false);
    setCodeInput('');
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setScannerVisible(false);
    if (data) {
      setCodeInput(data);
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
              ? 'अपने परिवार, रूममेट्स या कार्यालय के साथ मिलकर आवर्ती कार्यों को प्रबंधित करें। एक नया घर बनाएं या यूज़र कोड से जुड़ें।'
              : 'Manage recurring tasks together with family or flatmates. Create a new household or join an existing one using a user code.'}
          </Text>

          <View style={styles.noHouseholdActionRow}>
            <Button
              title={language === 'hi' ? '+ नया घर बनाएं' : '+ Create Household'}
              onPress={() => setCreateSheetVisible(true)}
              style={styles.createHhBtn}
            />
          </View>

          <View style={styles.joinHhDivider}>
            <Text style={styles.joinHhDividerText}>{language === 'hi' ? 'या यूज़र कोड से जुड़ें' : 'OR JOIN WITH USER CODE'}</Text>
          </View>

          <View style={styles.manualJoinRow} testID="household-manual-join-row">
            <PaperInput
              mode="outlined"
              value={codeInput}
              onChangeText={setCodeInput}
              autoCapitalize="characters"
              placeholder={language === 'hi' ? 'यूज़र कोड (जैसे: RPT-XXXXXX)' : 'User Code (e.g. RPT-XXXXXX)'}
              outlineColor={Colors.ivoryLine}
              activeOutlineColor={Colors.marigoldDeep}
              style={styles.manualJoinInput}
              textColor={Colors.ink}
              testID="household-join-code-input"
              right={
                <PaperInput.Icon
                  icon={() => <AppIcon name="camera-outline" size={18} color={Colors.indigo950} />}
                  onPress={async () => {
                    if (!permission || !permission.granted) {
                      const res = await requestPermission();
                      if (!res.granted) {
                        showToast(language === 'hi' ? 'कैमरा अनुमति आवश्यक है' : 'Camera permission is required');
                        return;
                      }
                    }
                    setScannerVisible(true);
                  }}
                  testID="household-scanner-btn"
                />
              }
              theme={{ colors: { background: Colors.white } }}
            />
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
    maxWidth: 65,
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
    borderColor: Colors.ivoryLine,
    elevation: 1,
  },
  sharedCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  sharedCatIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sharedCatIcon: {
    fontSize: 20,
  },
  sharedInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  sharedTitle: {
    fontSize: 14.5,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.indigo950,
    marginBottom: 2,
  },
  sharedSubRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  sharedSubText: {
    fontSize: 10.5,
    fontFamily: 'Manrope_500Medium',
    color: Colors.inkSoft,
  },
  sharedSubBold: {
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
  },
  sharedAssigneeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rotBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: Radius.full,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  rotBadgeText: {
    fontSize: 9.5,
    fontFamily: 'Manrope_700Bold',
    color: '#0369A1',
  },
  claimMiniBtn: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.tealDeep,
  },
  claimMiniBtnText: {
    fontSize: 9.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.white,
  },
  nudgeMiniBtn: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  nudgeMiniBtnText: {
    fontSize: 9.5,
    fontFamily: 'Manrope_700Bold',
    color: '#B45309',
  },
  choresCountBadge: {
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: Radius.full,
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
  sharedRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: 6,
    gap: 4,
  },
  sharedStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sharedStatusText: {
    fontSize: 9.5,
    fontFamily: 'Manrope_800ExtraBold',
  },
  sharedDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sharedDateText: {
    fontSize: 9.5,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.inkFaint,
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
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryLine,
    paddingTop: 12,
  },
  manualJoinInput: {
    flex: 1,
    fontSize: 13,
    height: 38,
    backgroundColor: Colors.white,
  },
  manualJoinBtn: {
    minWidth: 70,
    height: 38,
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
    marginBottom: 4,
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
