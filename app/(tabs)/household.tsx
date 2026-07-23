import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Share, Linking, Platform, Image, Modal, Pressable, Alert, TouchableOpacity, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Text, Card, TouchableRipple, TextInput as PaperInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTasks } from '@/providers/TaskProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import type { AppNotification } from '@/types/notification';
import { useHousehold } from '@/hooks/useInsights';
import { TaskCard } from '@/components/TaskCard';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { TaskFormSheet } from '@/components/TaskFormSheet';
import { ProgressRing } from '@/components/ProgressRing';
import { ScreenShell, SectionHeader, EmptyState } from '@/components/ScreenShell';
import { Button } from '@/components/Button';
import { AppIcon } from '@/components/AppIcon';
import { ActivityFeed } from '@/components/ActivityFeed';
import { taskToFormValues } from '@/domain/preset';
import { userRepository } from '@/data/repositories/userRepository';
import {
  addHouseholdMember,
  householdMemberFromInvite,
  inviteMessage,
  normalizeInviteCode,
  pendingMemberFromCode,
  removeHouseholdMember,
  inviteProfileFromUser,
} from '@/domain/household';
import { Colors, Gradients, Radius, Typography } from '@/constants/theme';
import type { RepeatingTask, CategoryKey } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { daysUntilDue } from '@/domain/recurrence';

function SharedTaskCard({
  task,
  language,
  onPress,
  user,
}: {
  task: RepeatingTask;
  language: 'en' | 'hi';
  onPress: () => void;
  user: any;
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
    if (task.assignedTo === user?.id) return language === 'hi' ? 'आपको' : 'You';
    const member = user?.householdMembers?.find((m: any) => m.userId === task.assignedTo || m.code === task.assignedTo);
    return member ? member.name : (language === 'hi' ? 'अन्य' : 'Other');
  }, [task.assignedTo, user, language]);

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
          <Text style={styles.sharedTitle} numberOfLines={1}>{task.title}</Text>
          <View style={styles.sharedSubRow}>
            <Text style={styles.sharedSubText} numberOfLines={1}>
              {language === 'hi' ? 'साझाकर्ता: ' : 'Shared by '}<Text style={styles.sharedSubBold}>{creatorName}</Text>
            </Text>
            <View style={styles.sharedAssigneeWrap}>
              <AppIcon name="person-circle-outline" size={12} color={Colors.inkSoft} style={{ marginRight: 3 }} />
              <Text style={styles.sharedSubText} numberOfLines={1}>
                {language === 'hi' ? 'सौंपा: ' : 'Assigned to '}<Text style={styles.sharedSubBold}>{assigneeName}</Text>
              </Text>
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

export default function HouseholdScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const { tasks, completeTask, snoozeTask, skipTask, deleteTask, archiveTask, pinTask, duplicateTask, setTaskDueDate, updateTask, deleteHistoryEntry, removeHouseholdMemberAndCleanup, unshareAllLocalTasks } = useTasks();
  const { showToast } = useToast();
  const { translate, language } = useTranslation();
  const { addNotification } = useNotifications();
  const { stats, members } = useHousehold(tasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [filterMemberCode, setFilterMemberCode] = useState<string | null>(null);
  const [activityVisible, setActivityVisible] = useState(false);

  // Scroll ref + section layout tracking for "View all" navigation
  const scrollRef = useRef<ScrollView>(null);
  const sharedTasksY = useRef<number>(0);
  const membersY = useRef<number>(0);
  const activityY = useRef<number>(0);

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

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
          [
            {
              text: 'OK',
              onPress: async () => {
                await updateUser({ removedBy: undefined });
                await unshareAllLocalTasks();
              },
            },
          ]
        );
      }
    }
  }, [user?.removedBy, language, unshareAllLocalTasks, updateUser]);

  const [codeInput, setCodeInput] = useState('');
  const [addingCode, setAddingCode] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const editingTask = editingTaskId ? tasks.find((t) => t.id === editingTaskId) ?? null : null;
  const ringPercent = stats.total > 0 ? (stats.onTime / stats.total) * 100 : 0;
  const myCode = user?.householdCode ?? '';

  const message = user ? inviteMessage(user) : '';

  const handleAction = async (action: () => Promise<void>) => {
    await action();
    setSelectedTaskId(null);
  };

  const shareAny = async () => {
    if (!message) return;
    await Share.share({ message });
  };

  const shareWhatsApp = async () => {
    if (!message) return;
    const encoded = encodeURIComponent(message);
    const url = Platform.OS === 'web' ? `https://wa.me/?text=${encoded}` : `whatsapp://send?text=${encoded}`;
    try {
      await Linking.openURL(url);
    } catch {
      await shareAny();
    }
  };

  const shareSms = async () => {
    if (!message) return;
    const encoded = encodeURIComponent(message);
    const url = `sms:${Platform.OS === 'ios' ? '&' : '?'}body=${encoded}`;
    try {
      await Linking.openURL(url);
    } catch {
      await shareAny();
    }
  };

  const addByCode = async (customCode?: string) => {
    if (!user) return;
    const code = normalizeInviteCode(customCode ?? codeInput);
    if (!code || code.length < 7) {
      showToast(translate('invalidInviteCode'));
      return;
    }
    if (code === user.householdCode) {
      showToast(translate('cannotAddOwnCode'));
      return;
    }
    if ((user.householdMembers ?? []).some((m) => normalizeInviteCode(m.code) === code)) {
      showToast(translate('memberAlreadyAdded'));
      return;
    }

    setAddingCode(true);
    const invite = await userRepository.resolveHouseholdInvite(code);
    const member = invite ? householdMemberFromInvite(invite) : pendingMemberFromCode(code);
    
    // 1. Add other user to my profile
    await updateUser(addHouseholdMember(user, member));

    // Add local notification
    await addNotification(
      'household',
      language === 'hi' ? 'परिवार का सदस्य जुड़ गया' : 'Household Member Linked',
      language === 'hi' ? `${member.name || code} को परिवार में जोड़ा गया।` : `Linked ${member.name || code} to your household.`
    );

    // 2. Add myself to other user's profile if registered
    if (invite && invite.userId) {
      try {
        const remoteB = await userRepository.loadRemote(invite.userId);
        if (remoteB) {
          const myInvite = inviteProfileFromUser(user);
          const meAsMember = householdMemberFromInvite(myInvite);
          const updatedB = addHouseholdMember(remoteB, meAsMember);
          await userRepository.saveOther(invite.userId, updatedB);

          // Add remote notification for User B
          const peerNotif: AppNotification = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'household',
            title: language === 'hi' ? 'नया परिवार सदस्य जुड़ा' : 'Household Member Joined',
            body: language === 'hi' ? `${user.name} आपके परिवार में शामिल हो गए हैं।` : `${user.name} joined your household.`,
            timestamp: new Date().toISOString(),
            read: false,
          };
          await userRepository.saveNotification(invite.userId, peerNotif);
        }
      } catch (err) {
        console.warn('[Repeato] Bidirectional household linking failed:', err);
      }
    }

    setAddingCode(false);
    setCodeInput('');
    showToast(invite ? translate('memberAdded') : translate('memberAddedPending'));
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setScannerVisible(false);
    if (data) {
      setCodeInput(data);
      await addByCode(data);
    }
  };

  const removeMember = async (code?: string) => {
    if (!user || !code) return;
    const member = (user.householdMembers ?? []).find((m) => m.code === code);
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
                  {
                    text: language === 'hi' ? 'कार्य रखें' : 'Keep Tasks',
                    onPress: () => removeHouseholdMemberAndCleanup(code, false),
                  },
                  {
                    text: language === 'hi' ? 'कार्य हटाएं' : 'Remove Tasks',
                    style: 'destructive',
                    onPress: () => removeHouseholdMemberAndCleanup(code, true),
                  },
                ]
              );
            },
          },
        ]
      );
    }
  };

  // Sort members for the leaderboard
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => b.onTimePercent - a.onTimePercent);
  }, [members]);

  const filteredSharedTasks = useMemo(() => {
    let list = stats.shared;
    if (filterMemberCode) {
      list = list.filter((t) => {
        if (filterMemberCode === 'you') {
          return !t.assignedTo || t.assignedTo === user?.id;
        }
        return (
          t.sharedWith.some((m) => m.code === filterMemberCode || m.userId === filterMemberCode) ||
          t.assignedTo === filterMemberCode
        );
      });
    }
    return list;
  }, [stats.shared, filterMemberCode, user?.id]);

  return (
    <View style={styles.root}>
      <ScreenShell
        title={translate('hhTitle') + ' 🏠'}
        subtitle={translate('hhSub')}
        scrollRef={scrollRef}
        headerExtra={
          <View style={styles.hhSummaryContainer}>
            {/* Column 1: Members */}
            <View style={styles.hhSummaryCard}>
              <View style={[styles.hhSummaryIconWrap, styles.hhIconWrapMembers]}>
                <AppIcon name="people" size={16} color="#0D9488" />
              </View>
              <Text style={styles.hhSummaryCount}>{members.length}</Text>
              <Text style={styles.hhSummaryLabel}>{language === 'hi' ? 'सदस्य' : 'Members'}</Text>
              <Pressable onPress={() => {
                setFilterMemberCode(null);
                setTimeout(() => scrollRef.current?.scrollTo({ y: membersY.current, animated: true }), 50);
              }}>
                <Text style={[styles.hhSummaryLink, styles.hhLinkMembers]}>{language === 'hi' ? 'सभी देखें' : 'View all'}</Text>
              </Pressable>
            </View>

            {/* Column 2: Shared tasks */}
            <View style={styles.hhSummaryCard}>
              <View style={[styles.hhSummaryIconWrap, styles.hhIconWrapTasks]}>
                <AppIcon name="documents-outline" size={16} color="#2563EB" />
              </View>
              <Text style={styles.hhSummaryCount}>{stats.shared.length}</Text>
              <Text style={styles.hhSummaryLabel}>{language === 'hi' ? 'साझा कार्य' : 'Shared tasks'}</Text>
              <Pressable onPress={() => {
                setFilterMemberCode(null);
                setTimeout(() => scrollRef.current?.scrollTo({ y: sharedTasksY.current, animated: true }), 50);
              }}>
                <Text style={[styles.hhSummaryLink, styles.hhLinkTasks]}>{language === 'hi' ? 'सभी देखें' : 'View all'}</Text>
              </Pressable>
            </View>

            {/* Column 3: Completion rate */}
            <View style={styles.hhSummaryCard}>
              <View style={[styles.hhSummaryIconWrap, styles.hhIconWrapCompletion]}>
                <AppIcon name="time-outline" size={16} color="#EA580C" />
              </View>
              <Text style={styles.hhSummaryCount}>{Math.round(ringPercent)}%</Text>
              <Text style={styles.hhSummaryLabel}>{language === 'hi' ? 'पूर्णता दर' : 'Completion'}</Text>
              <Text style={styles.hhSummarySub}>{language === 'hi' ? 'इस महीने' : 'This month'}</Text>
            </View>
          </View>
        }
      >
        <View
          style={styles.sharedHeaderRow}
          onLayout={(e) => { sharedTasksY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.hhSectionHeading}>{translate('sharedTasks')}</Text>
          <TouchableOpacity onPress={() => {
            setFilterMemberCode(null);
            scrollRef.current?.scrollTo({ y: sharedTasksY.current, animated: true });
          }}>
            <Text style={styles.hhViewAllLink}>{language === 'hi' ? 'सभी देखें' : 'View all'}</Text>
          </TouchableOpacity>
        </View>

        {stats.shared.length === 0 ? (
          <EmptyState
            icon="🏠"
            title={translate('householdEmptyTitle')}
            subtitle={translate('householdEmptySub')}
          />
        ) : (
          <>
            {filteredSharedTasks.length === 0 ? (
              <Text style={styles.emptySub}>{translate('noSharedTasks')}</Text>
            ) : (
              filteredSharedTasks.map((task) => (
                <SharedTaskCard
                  key={task.id}
                  task={task}
                  language={language}
                  onPress={() => setSelectedTaskId(task.id)}
                  user={user}
                />
              ))
            )}
          </>
        )}

        {/* Mockup Invitation Section */}
        {user && (
          <Card style={styles.inviteContainerCard} mode="elevated">
            <Card.Content style={styles.inviteCardContent}>
              <View style={styles.inviteTopRow}>
                <View style={styles.inviteAvatarRow}>
                  <Text style={styles.inviteAvatarEmoji}>🧑‍👩‍👧‍👦</Text>
                </View>
                <View style={styles.inviteTextCol}>
                  <Text style={styles.inviteCardTitle}>
                    {language === 'hi' ? 'परिवार के सदस्यों को जोड़ें' : 'Invite members to household'}
                  </Text>
                  <Text style={styles.inviteCardSub}>
                    {language === 'hi'
                      ? 'कोड या व्हाट्सएप का उपयोग करके परिवार को शामिल करें।'
                      : 'Share the invite code or link to join with your family.'}
                  </Text>
                </View>
                <View style={styles.inviteActionButtons}>
                  <TouchableRipple style={styles.inviteActionBtn} onPress={() => setQrVisible(true)} borderless>
                    <AppIcon name="qr-code-outline" size={16} color={Colors.indigo950} />
                  </TouchableRipple>
                  <TouchableRipple style={styles.inviteActionBtn} onPress={shareAny} borderless>
                    <AppIcon name="share-outline" size={16} color={Colors.indigo950} />
                  </TouchableRipple>
                </View>
              </View>

              <View style={styles.inviteBottomRow} testID="household-invite-row">
                <Pressable
                  style={styles.inviteCodeBox}
                  testID="household-invite-copy-btn"
                  onPress={async () => {
                    await Clipboard.setStringAsync(myCode);
                    showToast(language === 'hi' ? 'कोड कॉपी किया गया!' : 'Code copied!');
                  }}
                >
                  <Text style={styles.inviteCodeText} testID="household-invite-code-text">{myCode}</Text>
                  <AppIcon name="documents-outline" size={14} color={Colors.inkSoft} />
                </Pressable>

                <TouchableOpacity style={styles.inviteWhatsAppBtn} onPress={shareWhatsApp} testID="household-invite-whatsapp-btn">
                  <AppIcon name="chatbox-ellipses-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.inviteWhatsAppText}>
                    {language === 'hi' ? 'व्हाट्सएप आमंत्रित' : 'Invite via WhatsApp'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Code manual join field */}
              <View style={styles.manualJoinRow} testID="household-manual-join-row">
                <PaperInput
                  mode="outlined"
                  value={codeInput}
                  onChangeText={setCodeInput}
                  autoCapitalize="characters"
                  placeholder={language === 'hi' ? 'कोड दर्ज करें...' : 'Enter invite code...'}
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
                  theme={{
                    colors: {
                      background: Colors.white,
                    },
                  }}
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
        )}

        <View onLayout={(e) => { membersY.current = e.nativeEvent.layout.y; }}>
          <SectionHeader label={translate('members')} count={members.length} />
        </View>
        <Card style={styles.memberCard} mode="elevated">
          <Card.Content style={styles.memberCardContent}>
            {members.map((m, idx) => {
              const key = m.isYou ? 'you' : (m.code || m.userId || m.name);
              const isSelected = filterMemberCode === key;
              const rank = sortedMembers.findIndex((sm) => (sm.isYou && m.isYou) || (sm.code && sm.code === m.code)) + 1;
              const rankLabel = rank === 1 ? '👑 #1' : `#${rank}`;

              return (
                <TouchableRipple
                  key={key}
                  onPress={() => setFilterMemberCode((prev) => (prev === key ? null : key))}
                  style={[styles.memberRowRipple, isSelected && styles.memberRowRippleActive]}
                  borderless
                >
                  <View style={[styles.memberRow, idx === members.length - 1 && styles.lastRow]}>
                    <View style={[styles.memberAvatar, { backgroundColor: m.color }, isSelected && styles.memberAvatarSelected]}>
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
                    {!m.isYou && m.code ? (
                      <View onStartShouldSetResponder={() => true}>
                        <TouchableRipple
                          onPress={() => removeMember(m.code)}
                          style={styles.removeBtn}
                          borderless
                        >
                          <AppIcon name="close" size={16} color={Colors.indigo950} />
                        </TouchableRipple>
                      </View>
                    ) : null}
                  </View>
                </TouchableRipple>
              );
            })}
          </Card.Content>
        </Card>

        <View
          style={styles.sharedHeaderRow}
          onLayout={(e) => { activityY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.hhSectionHeading}>{language === 'hi' ? 'हालिया गतिविधि' : 'Recent Activity'}</Text>
          <TouchableOpacity onPress={() => setActivityVisible(true)}>
            <Text style={styles.hhViewAllLink}>{language === 'hi' ? 'सभी देखें' : 'View all'}</Text>
          </TouchableOpacity>
        </View>

        <ActivityFeed
          tasks={tasks}
          members={user?.householdMembers ?? []}
          currentUserId={user?.id}
          currentUserName={user?.name ?? 'You'}
          language={language}
        />
      </ScreenShell>

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
              tasks={tasks}
              members={user?.householdMembers ?? []}
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
        onComplete={(id, note) => handleAction(() => completeTask(id, note))}
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

      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <View style={styles.qrCenteredView}>
          <Pressable style={styles.qrBackdrop} onPress={() => setQrVisible(false)} />
          <Card style={styles.qrSheet} mode="elevated">
            <Card.Content style={styles.qrContent}>
              <Text style={styles.qrTitle}>{language === 'hi' ? 'स्कैन कर आमंत्रण भेजें' : 'Scan to join household'}</Text>
              {myCode ? (
                <QRCode
                  value={myCode}
                  size={180}
                />
              ) : null}
              <Text style={styles.qrCodeText}>{myCode}</Text>
              <Button title={language === 'hi' ? 'बंद करें' : 'Close'} onPress={() => setQrVisible(false)} style={styles.qrCloseBtn} />
            </Card.Content>
          </Card>
        </View>
      </Modal>

      {/* QR Scanner Camera Modal */}
      <Modal visible={scannerVisible} transparent={false} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
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
    </View>
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
  // 1. Stats Grid Styles
  hhSummaryContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 16,
    gap: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  hhSummaryCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hhSummaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  hhIconWrapMembers: { backgroundColor: 'rgba(13, 148, 136, 0.12)' },
  hhIconWrapTasks: { backgroundColor: 'rgba(37, 99, 235, 0.12)' },
  hhIconWrapCompletion: { backgroundColor: 'rgba(234, 88, 12, 0.12)' },
  hhSummaryCount: {
    fontSize: 20,
    fontFamily: 'Fraunces_700Bold',
    color: Colors.indigo950,
    marginBottom: 2,
  },
  hhSummaryLabel: {
    fontSize: 10.5,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.inkSoft,
    textAlign: 'center',
    marginBottom: 4,
  },
  hhSummarySub: {
    fontSize: 9.5,
    fontFamily: 'Manrope_500Medium',
    color: '#EA580C',
  },
  hhSummaryLink: {
    fontSize: 9.5,
    fontFamily: 'Manrope_800ExtraBold',
    textDecorationLine: 'underline',
  },
  hhLinkMembers: { color: '#0D9488' },
  hhLinkTasks: { color: '#2563EB' },

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

  // 4. Invite Card Styles
  inviteContainerCard: {
    backgroundColor: '#FFFDF5',
    borderColor: '#E8A33D20',
    borderWidth: 1.2,
    borderRadius: Radius.md,
    marginVertical: 14,
    elevation: 1,
  },
  inviteCardContent: {
    padding: 14,
  },
  inviteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inviteAvatarRow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  inviteAvatarEmoji: {
    fontSize: 22,
  },
  inviteTextCol: {
    flex: 1,
    marginRight: 8,
  },
  inviteCardTitle: {
    fontSize: 14.5,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.indigo950,
    marginBottom: 2,
  },
  inviteCardSub: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    color: Colors.inkSoft,
    lineHeight: 15,
  },
  inviteActionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  inviteActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBottomRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  inviteCodeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: Colors.ivoryLine,
    borderRadius: Radius.xs,
    paddingHorizontal: 12,
    height: 40,
  },
  inviteCodeText: {
    fontSize: 14.5,
    fontFamily: 'Fraunces_700Bold',
    color: Colors.indigo950,
    letterSpacing: 0.5,
  },
  inviteWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.marigoldDeep,
    borderRadius: Radius.xs,
    paddingHorizontal: 16,
    height: 40,
    elevation: 1,
  },
  inviteWhatsAppText: {
    fontSize: 12.5,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.white,
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
