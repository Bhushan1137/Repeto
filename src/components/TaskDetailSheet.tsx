import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Keyboard,
  Platform,
  Alert,
  Image,
  Linking,
  KeyboardAvoidingView,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { useRecommendations } from '@/providers/RecommendationProvider';
import type { CompletionStatus, Language, RepeatingTask } from '@/types';
import { getCategoryDef, getCategoryLabel } from '@/constants/categoryHelpers';
import { CATEGORY_MAP } from '@/constants/categories';
import { AccentHex, Colors, Gradients, Radius, Typography } from '@/constants/theme';
import { daysUntilDue, dayLabel, daysPercent } from '@/domain/recurrence';
import { canSnoozeTask, getTodayDoseProgress } from '@/domain/task';
import { formatTime12 } from '@/utils/timeFormat';
import { initials } from '@/domain/insights';
import { ProgressRing } from '@/components/ProgressRing';
import { Button } from '@/components/Button';
import type { TranslationKey } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { listHouseholds } from '@/domain/household';

function formatDateTime(isoString: string, lang: Language): string {
  try {
    const d = new Date(isoString);
    const datePart = d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = formatTime12(isoString);
    return `${datePart}, ${timePart}`;
  } catch {
    return isoString;
  }
}

let DateTimePicker: any;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

interface TaskDetailSheetProps {
  task: RepeatingTask | null;
  visible: boolean;
  language: Language;
  translate: (key: TranslationKey, params?: Record<string, string | number>) => string;
  onClose: () => void;
  onComplete: (taskId: string, note?: string, options?: { maxEarlyDays?: number }) => void;
  onSnooze: (taskId: string, days?: number) => void;
  onSkip: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onArchive?: (taskId: string) => void;
  onPin?: (taskId: string) => void;
  onDuplicate?: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
  onSetDueDate?: (taskId: string, date: Date) => void;
  onDeleteHistoryEntry?: (taskId: string, entryIndex: number) => void;
  onUndoSkip?: (taskId: string) => void;
  onUndoComplete?: (taskId: string) => void;
  onClaim?: (taskId: string) => void;
  onNudge?: (taskId: string) => void;
}

function TaskDetailSheetComponent({
  task,
  visible,
  language,
  translate,
  onClose,
  onComplete,
  onSnooze,
  onSkip,
  onUndoSkip,
  onUndoComplete,
  onClaim,
  onNudge,
  onDelete,
  onArchive,
  onPin,
  onDuplicate,
  onEdit,
  onSetDueDate,
  onDeleteHistoryEntry,
}: TaskDetailSheetProps) {
  const { user } = useAuth();
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [snoozeOptionsVisible, setSnoozeOptionsVisible] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [completing, setCompleting] = useState(false);

  React.useEffect(() => {
    setCompleting(false);
  }, [task?.id, visible]);

  const { findMatch, logImpression, logClick } = useRecommendations();
  const match = task ? findMatch(task) : null;

  const households = useMemo(() => listHouseholds(user ?? ({} as any)), [user]);
  const hhContext = useMemo(() => {
    if (!task || !task.householdId) return null;
    return households.find(h => h.id === task.householdId) ?? null;
  }, [task, households]);

  const snoozeAllowed = useMemo(() => {
    if (!task) return false;
    return canSnoozeTask(task).allowed;
  }, [task]);

  React.useEffect(() => {
    setImageError(false);
  }, [match?.id]);

  React.useEffect(() => {
    if (visible && match) {
      logImpression(match.id);
    }
  }, [visible, match?.id]);

  const handleNativeDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate && onSetDueDate && task) {
      onSetDueDate(task.id, selectedDate);
    }
  };

  const handleWebDateChange = (dateString: string) => {
    setShowDatePicker(false);
    if (dateString && onSetDueDate && task) {
      onSetDueDate(task.id, new Date(dateString));
    }
  };

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const isMultiDose = Boolean(task?.timesPerDay && task.timesPerDay > 1);

  const doseProgress = useMemo(() => {
    if (!task || !isMultiDose) return null;
    return getTodayDoseProgress(task);
  }, [task, isMultiDose]);

  const todayCompletion = useMemo(() => {
    if (!task?.history || task.history.length === 0) return null;
    const today = new Date();
    for (let i = task.history.length - 1; i >= 0; i--) {
      const h = task.history[i];
      if (
        h.completedAt &&
        (h.status === 'on_time' || h.status === 'late') &&
        isSameDay(new Date(h.completedAt), today)
      ) {
        return h;
      }
    }
    return null;
  }, [task]);

  const assigneeDisplayName = useMemo(() => {
    if (!task?.assignedTo) return language === 'hi' ? 'कोई नहीं (साझा)' : 'Unassigned (Open)';
    if (task.assignedTo === user?.id || task.assignedTo === user?.userCode) {
      return language === 'hi' ? 'आप (You)' : 'You';
    }
    const allMembers = hhContext?.members ?? user?.householdMembers ?? [];
    const member = allMembers.find((m) => m.userId === task.assignedTo || m.code === task.assignedTo);
    return member ? member.name : (language === 'hi' ? 'अन्य सदस्य' : 'Other Member');
  }, [task?.assignedTo, user, hhContext, language]);

  if (!task || !visible) return null;

  const cat = getCategoryDef(task.category);
  const hex = AccentHex[cat.accent];
  const days = daysUntilDue(task.nextDueDate);
  const overdue = days < 0;
  const isDueTodayOrOverdue = days <= 0;
  const isCompletedToday = isDueTodayOrOverdue && (isMultiDose ? Boolean(doseProgress?.isAllDone) : !!todayCompletion);

  const statusText: Record<CompletionStatus, string> = {
    on_time: translate('completedOnTime'),
    late: translate('completedLate'),
    missed: translate('missed'),
    skipped: translate('skipped'),
    snoozed: language === 'hi' ? 'सणूज़ किया गया' : 'Snoozed',
  };

  const handleDateChange = handleNativeDateChange;
  const historyToShow = showAllHistory ? task.history : task.history.slice(-5);
  const isFutureTask = days > 2;
  const isEarlyAllowed = days > 0 && days <= 2;

  const markDoneButtonTitle = isMultiDose && doseProgress && !doseProgress.isAllDone
    ? (language === 'hi'
        ? `${doseProgress.nextDoseIndex + 1}/${doseProgress.totalDoses} पूरा करें (${formatTime12(doseProgress.times[doseProgress.nextDoseIndex])})`
        : `Mark ${doseProgress.nextDoseIndex + 1} of ${doseProgress.totalDoses} Done (${formatTime12(doseProgress.times[doseProgress.nextDoseIndex])})`)
    : isEarlyAllowed
    ? (language === 'hi' ? `समय पूर्व पूरा करें (${days}d)` : `Mark Done Early (${days}d early)`)
    : translate('markDone');

  const handleMarkDone = () => {
    if (completing) return;
    if (!noteExpanded) {
      setNoteExpanded(true);
      return;
    }
    setCompleting(true);
    Keyboard.dismiss();
    try {
      onComplete(task.id, noteText.trim() || undefined, { maxEarlyDays: 2 });
    } finally {
      setNoteText('');
      setNoteExpanded(false);
      setTimeout(() => setCompleting(false), 500);
    }
  };

  const handleMarkDoneDirectly = () => {
    if (completing) return;
    setCompleting(true);
    Keyboard.dismiss();
    try {
      onComplete(task.id, noteText.trim() || undefined, { maxEarlyDays: 2 });
    } finally {
      setNoteText('');
      setNoteExpanded(false);
      setTimeout(() => setCompleting(false), 500);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Card style={styles.sheet} mode="elevated">
        <View style={styles.handle} />

        <LinearGradient colors={[...Gradients.hero]} style={styles.heroBand}>
          <ProgressRing
            percent={
              isCompletedToday
                ? 100
                : isMultiDose && doseProgress && days === 0
                ? Math.round((doseProgress.completedCount / doseProgress.totalDoses) * 100)
                : daysPercent(days)
            }
            color={isCompletedToday ? '#059669' : (overdue ? AccentHex.clay : hex)}
            size={72}
            stroke={6}
            label={
              isCompletedToday
                ? (language === 'hi' ? 'पूर्ण' : 'Done')
                : isMultiDose && doseProgress && days === 0
                ? `${doseProgress.completedCount}/${doseProgress.totalDoses}`
                : dayLabel(days, language)
            }
            labelColor={Colors.onDark}
            trackColor="rgba(255, 255, 255, 0.16)"
          />
          <View style={styles.heroText}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <View style={styles.catPill}>
                <Text style={styles.catBadge}>
                  {cat.icon} {getCategoryLabel(task.category, language)}
                </Text>
              </View>
              <View style={[styles.catPill, { backgroundColor: 'rgba(255, 255, 255, 0.25)' }]}>
                <Text style={styles.catBadge}>
                  {hhContext ? `${hhContext.icon || '🏠'} ${hhContext.name}` : '👤 Personal'}
                </Text>
              </View>
              {task.alarmEnabled && (
                <View style={[styles.catPill, { backgroundColor: 'rgba(245, 158, 11, 0.35)' }]}>
                  <Text style={styles.catBadge}>
                    🔔 {language === 'hi' ? 'अलार्म' : 'Alarm'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {task.title}
            </Text>
            <Text style={styles.freq}>{task.frequencyLabel}</Text>
            {task.amount ? (
              <Text style={styles.amount}>₹{task.amount.toLocaleString('en-IN')}</Text>
            ) : null}
          </View>
          <TouchableRipple style={styles.closeBtn} onPress={onClose} borderless>
            <AppIcon name="close" size={20} color={Colors.onDarkMuted} />
          </TouchableRipple>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Escalation warning */}
          {task.escalationCount >= 2 && (
            <View style={styles.escalationChip}>
              <Text style={styles.escalationEmoji}>🔥</Text>
              <Text style={styles.escalationText}>
                {language === 'hi'
                  ? `${task.escalationCount} बार लगातार मिस किया`
                  : `Missed ${task.escalationCount} times in a row`}
              </Text>
            </View>
          )}

          {/* Pinned badge */}
          {task.pinned && (
            <View style={styles.pinnedChip}>
              <AppIcon
                name={task.pinned ? 'bookmark' : 'bookmark-outline'}
                size={12}
                color={Colors.marigoldDeep}
              />
              <Text style={styles.pinnedText}>
                {language === 'hi' ? 'पिन किया गया' : 'Pinned'}
              </Text>
            </View>
          )}

          {/* Shared members */}
          {task.sharedWith.length > 0 && (
            <Card style={styles.sharedCard} mode="elevated">
              <Card.Content>
                <Text style={styles.sharedLabel}>{translate('shareHousehold')}</Text>
                <View style={styles.sharedRow}>
                  {task.sharedWith.map((s) => (
                    <View key={s.phone} style={[styles.avatar, { backgroundColor: s.color }]}>
                      <Text style={styles.avatarText}>{initials(s.name)}</Text>
                    </View>
                  ))}
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Assignee Information */}
          {(task.assignedTo || (task.householdId && hhContext)) && (
            <Card style={[styles.sharedCard, { marginTop: 10 }]} mode="elevated">
              <Card.Content style={{ paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <AppIcon name="person-circle-outline" size={22} color={Colors.tealDeep} />
                    <View>
                      <Text style={{ fontSize: 11, color: Colors.inkSoft }}>
                        {language === 'hi' ? 'किसे सौंपा गया' : 'Assigned To'}
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.ink }}>
                        {assigneeDisplayName}
                      </Text>
                    </View>
                  </View>
                  {!task.assignedTo && onClaim && (
                    <Button
                      title={language === 'hi' ? 'कार्य लें' : 'Claim Task'}
                      variant="outline"
                      compact
                      onPress={() => onClaim(task.id)}
                      style={{ minWidth: 90, marginVertical: 0 }}
                    />
                  )}
                  {task.assignedTo && task.assignedTo !== user?.id && task.assignedTo !== user?.userCode && (
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {onNudge && (
                        <Button
                          title={language === 'hi' ? '👉 नज़' : '👉 Nudge'}
                          variant="outline"
                          compact
                          onPress={() => onNudge(task.id)}
                          style={{ minWidth: 70, marginVertical: 0, borderColor: '#F59E0B' }}
                        />
                      )}
                      {onClaim && (
                        <Button
                          title={language === 'hi' ? 'स्वयं को सौंपें' : 'Take Over'}
                          variant="outline"
                          compact
                          onPress={() => onClaim(task.id)}
                          style={{ minWidth: 80, marginVertical: 0, borderColor: Colors.tealDeep }}
                        />
                      )}
                    </View>
                  )}
                </View>
                {task.isRotating && (
                  <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.ivoryLine, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 12, color: Colors.tealDeep, fontFamily: 'Manrope_700Bold' }}>
                      🔄 {language === 'hi' ? 'बारी-बारी से घुमाएं सक्रिय (Round-Robin)' : 'Round-Robin Turn Rotation Active'}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}

          {/* Contextual Affiliate Promo */}
          {match && (
            <Card style={styles.promoCard} mode="elevated">
              <View style={styles.promoContent}>
                <Image
                  source={{ uri: imageError || !match.imageUrl ? 'https://picsum.photos/200' : match.imageUrl }}
                  style={styles.promoImage}
                  resizeMode="cover"
                  onError={() => setImageError(true)}
                />
                <View style={styles.promoTextCol}>
                  <Text style={styles.promoTag}>
                    {language === 'hi' ? 'प्रायोजित लाभ' : 'SPONSORED BENEFIT'}
                  </Text>
                  <Text style={styles.promoTitle}>{match.title}</Text>
                  <Text style={styles.promoDesc}>{match.description}</Text>
                  {match.promoCode ? (
                    <View style={styles.promoCodeBadge}>
                      <Text style={styles.promoCodeText}>
                        {language === 'hi' ? `कोड: ${match.promoCode}` : `CODE: ${match.promoCode}`}
                      </Text>
                    </View>
                  ) : null}
                  <Button
                    title={match.buttonText || (language === 'hi' ? 'अभी खरीदें' : 'Shop Now')}
                    onPress={async () => {
                      await logClick(match.id);
                      Linking.openURL(match.redirectUrl).catch(() => {});
                    }}
                    style={styles.promoCta}
                  />
                </View>
              </View>
            </Card>
          )}

          {/* Earlier today completion alert banner when viewing an upcoming occurrence */}
          {todayCompletion && days > 0 && (
            <View style={styles.earlierDoneBanner}>
              <View style={styles.earlierDoneLeft}>
                <AppIcon name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.earlierDoneText}>
                  {language === 'hi'
                    ? `आज का कार्य संपन्न (${formatTime12(todayCompletion.completedAt ?? '')}) • अगली देय: ${dayLabel(days, language)}`
                    : `Completed earlier today at ${formatTime12(todayCompletion.completedAt ?? '')} • Next due: ${dayLabel(days, language)}`}
                </Text>
              </View>
              {onUndoComplete && (
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onUndoComplete(task.id);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.earlierDoneUndoText}>
                    {language === 'hi' ? 'पूर्ववत करें' : 'Undo'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* If occurrence is marked done today, show completed status & undo option */}
          {isCompletedToday ? (
            <Card style={styles.completedOccurrenceCard} mode="elevated">
              <Card.Content style={styles.completedOccurrenceContent}>
                <View style={styles.completedOccurrenceHeader}>
                  <View style={styles.completedOccurrenceIconCircle}>
                    <AppIcon name="checkmark-done-outline" size={20} color="#059669" />
                  </View>
                  <View style={styles.completedOccurrenceTextCol}>
                    <Text style={styles.completedOccurrenceTitle}>
                      {language === 'hi' ? 'आज का कार्य संपन्न है' : 'Completed for Today'}
                    </Text>
                    <Text style={styles.completedOccurrenceSub}>
                      {todayCompletion?.completedAt
                        ? `${language === 'hi' ? 'आज' : 'Completed at'} ${formatTime12(todayCompletion.completedAt)}`
                        : (language === 'hi' ? 'यह कार्य पूरा कर लिया गया है' : 'This occurrence is marked done')}
                    </Text>
                  </View>
                </View>

                {todayCompletion?.note ? (
                  <View style={styles.completedOccurrenceNoteBox}>
                    <Text style={styles.completedOccurrenceNoteText}>
                      📝 {todayCompletion.note}
                    </Text>
                  </View>
                ) : null}

                {onUndoComplete && (
                  <TouchableRipple
                    style={styles.undoOccurrenceBtn}
                    onPress={() => {
                      onClose();
                      onUndoComplete(task.id);
                    }}
                    borderless
                  >
                    <View style={styles.undoOccurrenceBtnInner}>
                      <AppIcon name="arrow-undo-outline" size={16} color="#B45309" />
                      <Text style={styles.undoOccurrenceBtnText}>
                        {language === 'hi' ? 'कार्य पूर्ववत करें (आज की सूची में लाएं)' : "Undo Today's Completion"}
                      </Text>
                    </View>
                  </TouchableRipple>
                )}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <ActionChip
                    icon="create-outline"
                    label={language === 'hi' ? 'संपादित करें' : 'Edit Task'}
                    onPress={() => {
                      setSnoozeOptionsVisible(false);
                      onEdit?.(task.id);
                    }}
                  />
                  <ActionChip
                    icon="calendar-outline"
                    label={language === 'hi' ? 'तारीख बदलें' : 'Reschedule'}
                    onPress={() => {
                      setSnoozeOptionsVisible(false);
                      setShowDatePicker(true);
                    }}
                  />
                </View>
              </Card.Content>
            </Card>
          ) : isFutureTask ? (
            <Card style={styles.futureTaskCard} mode="elevated">
              <Card.Content style={styles.futureTaskContent}>
                <View style={styles.futureTaskHeader}>
                  <View style={styles.futureTaskIconCircle}>
                    <AppIcon name="calendar-outline" size={20} color="#2563EB" />
                  </View>
                  <View style={styles.futureTaskTextCol}>
                    <Text style={styles.futureTaskTitle}>
                      {language === 'hi' ? 'भविष्य का कार्य' : 'Scheduled Future Task'}
                    </Text>
                    <Text style={styles.futureTaskSub}>
                      {language === 'hi'
                        ? `यह कार्य ${days} दिन बाद नियत है। समय पूर्व पूरा करने का विकल्प नियत तिथि से 2 दिन पहले खुलेगा।`
                        : `Due in ${days} days. Completion unlocks 2 days before due date.`}
                    </Text>
                  </View>
                </View>

                <View style={styles.futureActionsRow}>
                  <ActionChip
                    icon="calendar-outline"
                    label={language === 'hi' ? 'तारीख बदलें' : 'Reschedule'}
                    onPress={() => {
                      setSnoozeOptionsVisible(false);
                      setShowDatePicker(true);
                    }}
                  />
                  <ActionChip
                    icon="create-outline"
                    label={language === 'hi' ? 'संपादित करें' : 'Edit Task'}
                    onPress={() => {
                      setSnoozeOptionsVisible(false);
                      onEdit?.(task.id);
                    }}
                  />
                  <ActionChip
                    icon="time-outline"
                    label={translate('snooze2d')}
                    onPress={() => setSnoozeOptionsVisible((v) => !v)}
                  />
                </View>

                {snoozeOptionsVisible && (
                  <View style={styles.snoozeOptionsRow}>
                    <TouchableRipple
                      style={styles.snoozeOptBtn}
                      onPress={() => {
                        onSnooze(task.id, 1);
                        setSnoozeOptionsVisible(false);
                      }}
                      borderless
                    >
                      <Text style={styles.snoozeOptText}>+1 {language === 'hi' ? 'दिन' : 'Day'}</Text>
                    </TouchableRipple>
                    <TouchableRipple
                      style={styles.snoozeOptBtn}
                      onPress={() => {
                        onSnooze(task.id, 2);
                        setSnoozeOptionsVisible(false);
                      }}
                      borderless
                    >
                      <Text style={styles.snoozeOptText}>+2 {language === 'hi' ? 'दिन' : 'Days'}</Text>
                    </TouchableRipple>
                    <TouchableRipple
                      style={styles.snoozeOptBtn}
                      onPress={() => {
                        onSnooze(task.id, 7);
                        setSnoozeOptionsVisible(false);
                      }}
                      borderless
                    >
                      <Text style={styles.snoozeOptText}>+1 {language === 'hi' ? 'हफ्ता' : 'Week'}</Text>
                    </TouchableRipple>
                    <TouchableRipple
                      style={[styles.snoozeOptBtn, styles.snoozeCancelBtn]}
                      onPress={() => setSnoozeOptionsVisible(false)}
                      borderless
                    >
                      <Text style={[styles.snoozeOptText, { color: Colors.clay }]}>{language === 'hi' ? 'रद्द करें' : 'Cancel'}</Text>
                    </TouchableRipple>
                  </View>
                )}
              </Card.Content>
            </Card>
          ) : (
            <>
              {/* Multi-dose breakdown card */}
              {isMultiDose && doseProgress && (
                <Card style={styles.multiDoseCard} mode="elevated">
                  <Card.Content style={styles.multiDoseCardContent}>
                    <View style={styles.multiDoseCardHeader}>
                      <Text style={styles.multiDoseCardTitle}>
                        {language === 'hi' ? 'आज का समय-क्रम' : "Today's Schedule"}
                      </Text>
                      <View style={styles.multiDoseCardBadge}>
                        <Text style={styles.multiDoseCardBadgeText}>
                          {doseProgress.completedCount} / {doseProgress.totalDoses} {language === 'hi' ? 'पूर्ण' : 'Done'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.multiDoseRowsWrap}>
                      {doseProgress.times.map((timeStr, idx) => {
                        const isDone = doseProgress.completedIndices.includes(idx);
                        const isNext = idx === doseProgress.nextDoseIndex && !doseProgress.isAllDone;
                        return (
                          <View key={idx} style={[styles.multiDoseItemRow, isNext && styles.multiDoseItemRowNext]}>
                            <View style={[styles.multiDoseDotCircle, isDone && styles.multiDoseDotCircleDone, isNext && styles.multiDoseDotCircleNext]}>
                              {isDone ? (
                                <AppIcon name="checkmark" size={12} color={Colors.white} />
                              ) : (
                                <Text style={[styles.multiDoseDotNumber, isNext && { color: '#2563EB' }]}>{idx + 1}</Text>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.multiDoseTimeLabel, isDone && styles.multiDoseTimeLabelDone]}>
                                {formatTime12(timeStr)}
                              </Text>
                              <Text style={styles.multiDoseStatusLabel}>
                                {isDone
                                  ? (language === 'hi' ? 'पूर्ण हो गया ✓' : 'Completed ✓')
                                  : isNext
                                  ? (language === 'hi' ? 'अगला देय' : 'Due Next')
                                  : (language === 'hi' ? 'आगामी' : 'Upcoming')}
                              </Text>
                            </View>
                            {isNext && (
                              <Button
                                title={language === 'hi' ? 'पूर्ण करें' : 'Mark Done'}
                                onPress={handleMarkDoneDirectly}
                                loading={completing}
                                disabled={completing}
                                style={styles.multiDoseQuickDoneBtn}
                              />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </Card.Content>
                </Card>
              )}

              {/* Action card */}
              <Card style={styles.actionCard} mode="elevated">
                <Card.Content style={styles.actionContent}>
                  {noteExpanded ? (
                    <>
                      <TextInput
                        style={styles.noteInput}
                        placeholder={
                          language === 'hi'
                            ? 'एक नोट जोड़ें (वैकल्पिक)...'
                            : 'Add a note (optional)...'
                        }
                        placeholderTextColor={Colors.inkFaint}
                        value={noteText}
                        onChangeText={setNoteText}
                        multiline
                        maxLength={200}
                        autoFocus
                      />
                      <View style={styles.noteActions}>
                        <Button
                          title={language === 'hi' ? 'छोड़ें' : 'Skip note'}
                          onPress={handleMarkDoneDirectly}
                          variant="ghost"
                          style={styles.noteSkipBtn}
                        />
                        <Button
                          title={markDoneButtonTitle}
                          onPress={handleMarkDoneDirectly}
                          loading={completing}
                          disabled={completing}
                          style={styles.noteConfirmBtn}
                        />
                      </View>
                    </>
                  ) : (
                    <View style={styles.doneButtonsRow}>
                      <Button
                        title={markDoneButtonTitle}
                        onPress={handleMarkDoneDirectly}
                        loading={completing}
                        disabled={completing}
                        style={styles.donePrimaryBtn}
                      />
                      <Button
                        title={language === 'hi' ? 'नोट जोड़ें' : 'Add Note'}
                        variant="outline"
                        onPress={handleMarkDone}
                        disabled={completing}
                        style={styles.doneSecondaryBtn}
                      />
                    </View>
                  )}

                  <View style={styles.secondaryRow}>
                    {snoozeAllowed && (
                      <ActionChip
                        icon="time-outline"
                        label={translate('snooze2d')}
                        onPress={() => setSnoozeOptionsVisible((v) => !v)}
                      />
                    )}
                    <ActionChip
                      icon="play-skip-forward-outline"
                      label={translate('skipOccurrence')}
                      onPress={() => {
                        setSnoozeOptionsVisible(false);
                        onSkip(task.id);
                      }}
                    />
                    <ActionChip
                      icon="calendar-outline"
                      label={language === 'hi' ? 'तारीख बदलें' : 'Change Date'}
                      onPress={() => {
                        setSnoozeOptionsVisible(false);
                        setShowDatePicker(true);
                      }}
                    />
                  </View>

                  {snoozeOptionsVisible && (
                    <View style={styles.snoozeOptionsRow}>
                      <TouchableRipple
                        style={styles.snoozeOptBtn}
                        onPress={() => {
                          onSnooze(task.id, 1);
                          setSnoozeOptionsVisible(false);
                        }}
                        borderless
                      >
                        <Text style={styles.snoozeOptText}>+1 {language === 'hi' ? 'दिन' : 'Day'}</Text>
                      </TouchableRipple>
                      <TouchableRipple
                        style={styles.snoozeOptBtn}
                        onPress={() => {
                          onSnooze(task.id, 2);
                          setSnoozeOptionsVisible(false);
                        }}
                        borderless
                      >
                        <Text style={styles.snoozeOptText}>+2 {language === 'hi' ? 'दिन' : 'Days'}</Text>
                      </TouchableRipple>
                      <TouchableRipple
                        style={styles.snoozeOptBtn}
                        onPress={() => {
                          onSnooze(task.id, 7);
                          setSnoozeOptionsVisible(false);
                        }}
                        borderless
                      >
                        <Text style={styles.snoozeOptText}>+1 {language === 'hi' ? 'हफ्ता' : 'Week'}</Text>
                      </TouchableRipple>
                      <TouchableRipple
                        style={[styles.snoozeOptBtn, styles.snoozeCancelBtn]}
                        onPress={() => setSnoozeOptionsVisible(false)}
                        borderless
                      >
                        <Text style={[styles.snoozeOptText, { color: Colors.clay }]}>{language === 'hi' ? 'रद्द करें' : 'Cancel'}</Text>
                      </TouchableRipple>
                    </View>
                  )}
                </Card.Content>
              </Card>

              {/* Extra actions row */}
              <View style={styles.extraActionsRow}>
                <TouchableRipple
                  style={styles.extraActionBtn}
                  onPress={() => onPin?.(task.id)}
                  borderless
                >
                  <View style={styles.extraActionInner}>
                    <AppIcon
                      name={task.pinned ? 'bookmark' : 'bookmark-outline'}
                      size={16}
                      color={task.pinned ? Colors.marigoldDeep : Colors.inkSoft}
                    />
                    <Text style={[styles.extraActionText, task.pinned && styles.extraActionActive]}>
                      {task.pinned
                        ? language === 'hi' ? 'अनपिन' : 'Unpin'
                        : language === 'hi' ? 'पिन करें' : 'Pin'}
                    </Text>
                  </View>
                </TouchableRipple>

                <TouchableRipple
                  style={styles.extraActionBtn}
                  onPress={() => onDuplicate?.(task.id)}
                  borderless
                >
                  <View style={styles.extraActionInner}>
                    <AppIcon name="documents-outline" size={16} color={Colors.inkSoft} />
                    <Text style={styles.extraActionText}>
                      {language === 'hi' ? 'डुप्लिकेट' : 'Duplicate'}
                    </Text>
                  </View>
                </TouchableRipple>

                <TouchableRipple
                  style={styles.extraActionBtn}
                  onPress={() => onArchive?.(task.id)}
                  borderless
                >
                  <View style={styles.extraActionInner}>
                    <AppIcon name="archive-outline" size={16} color={Colors.inkSoft} />
                    <Text style={styles.extraActionText}>
                      {language === 'hi' ? 'आर्काइव' : 'Archive'}
                    </Text>
                  </View>
                </TouchableRipple>

                <TouchableRipple
                  style={styles.extraActionBtn}
                  onPress={() => {
                    setSnoozeOptionsVisible(false);
                    onEdit?.(task.id);
                  }}
                  borderless
                >
                  <View style={styles.extraActionInner}>
                    <AppIcon name="create-outline" size={16} color={Colors.inkSoft} />
                    <Text style={styles.extraActionText}>
                      {language === 'hi' ? 'संपादित करें' : 'Edit'}
                    </Text>
                  </View>
                </TouchableRipple>
              </View>
            </>
          )}

          {Platform.OS === 'web' && showDatePicker && (
            <View style={styles.webDatePickerContainer}>
              <input
                type="date"
                defaultValue={task.nextDueDate.slice(0, 10)}
                onChange={(e) => handleWebDateChange(e.target.value)}
                style={{
                  fontSize: 14,
                  padding: 8,
                  borderColor: Colors.ivoryLine,
                  borderWidth: 1,
                  borderRadius: 4,
                  marginTop: 4,
                  marginBottom: 12,
                  width: '100%',
                  boxSizing: 'border-box',
                } as any}
              />
            </View>
          )}

          {Platform.OS !== 'web' && showDatePicker && DateTimePicker && (
            <DateTimePicker
              value={new Date(task.nextDueDate)}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}

          {/* Metadata info */}
          <View style={styles.metadataContainer}>
            <AppIcon name="information-circle-outline" size={15} color={Colors.inkFaint} />
            <Text style={styles.metadataText}>
              {language === 'hi' ? 'कार्य निर्माण तिथि:' : 'Created on:'}{' '}
              <Text style={styles.metadataTextBold}>{formatDateTime(task.createdAt, language)}</Text>
            </Text>
          </View>

          {/* History */}
          <Text style={styles.sectionLabel}>{translate('history')}</Text>
          {task.history.length === 0 ? (
            <Card style={styles.emptyHistoryCard} mode="elevated">
              <Card.Content style={styles.emptyHistoryContent}>
                <AppIcon name="calendar-outline" size={22} color={Colors.inkFaint} />
                <Text style={styles.emptyHistory}>{translate('noHistoryYet')}</Text>
              </Card.Content>
            </Card>
          ) : (
            <>
              {historyToShow.map((h, idx) => (
                <Card key={`${h.month}-${h.status}-${idx}`} style={styles.historyCard} mode="elevated">
                  <Card.Content style={styles.historyRow}>
                    <View
                      style={[
                        styles.dot,
                        h.status === 'on_time' && styles.dotOk,
                        h.status === 'late' && styles.dotLate,
                        (h.status === 'missed' || h.status === 'skipped') && styles.dotMissed,
                      ]}
                    />
                    <View style={styles.historyTextCol}>
                      <View style={styles.historyTopRow}>
                        <Text style={styles.historyMonth}>{h.month}</Text>
                        <View
                          style={[
                            styles.historyStatusPill,
                            h.status === 'on_time'
                              ? styles.statusPillOk
                              : h.status === 'late'
                              ? styles.statusPillLate
                              : styles.statusPillMissed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.historyStatusText,
                              h.status === 'on_time'
                                ? styles.statusTextOk
                                : h.status === 'late'
                                ? styles.statusTextLate
                                : styles.statusTextMissed,
                            ]}
                          >
                            {statusText[h.status]}
                          </Text>
                        </View>
                      </View>
                      {h.completedAt && (
                        <Text style={styles.historyTime}>
                          📅 {formatDateTime(h.completedAt, language)}
                          {h.doseIndex !== undefined ? ` • ⏱ ${language === 'hi' ? `समय ${h.doseIndex + 1}` : `Time ${h.doseIndex + 1}`}${h.doseTime ? ` (${formatTime12(h.doseTime)})` : ''}` : ''}
                        </Text>
                      )}
                      {h.note ? (
                        <Text style={styles.historyNote}>📝 {h.note}</Text>
                      ) : null}
                    </View>
                    {h.status === 'skipped' && onUndoSkip && (
                      <TouchableRipple
                        style={[styles.deleteHistoryBtn, { backgroundColor: Colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 6 }]}
                        onPress={() => onUndoSkip(task.id)}
                        borderless
                      >
                        <Text style={{ fontSize: 11, fontFamily: 'Manrope_700Bold', color: Colors.tealDeep }}>
                          {language === 'hi' ? 'पूर्ववत करें' : 'Undo Skip'}
                        </Text>
                      </TouchableRipple>
                    )}
                    {onDeleteHistoryEntry && (
                      <TouchableRipple
                        style={styles.deleteHistoryBtn}
                        onPress={() => {
                          const actualIdx = showAllHistory ? idx : (task.history.length > 5 ? task.history.length - 5 + idx : idx);
                          if (Platform.OS === 'web') {
                            if (window.confirm(language === 'hi' ? 'क्या आप इस इतिहास प्रविष्टि को हटाना चाहते हैं?' : 'Are you sure you want to delete this history entry?')) {
                              onDeleteHistoryEntry(task.id, actualIdx);
                            }
                          } else {
                            Alert.alert(
                              language === 'hi' ? 'इतिहास प्रविष्टि हटाएं' : 'Delete History Entry',
                              language === 'hi' ? 'क्या आप वाकई इस प्रविष्टि को हटाना चाहते हैं?' : 'Are you sure you want to delete this completion entry?',
                              [
                                { text: language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
                                { text: language === 'hi' ? 'हटाएं' : 'Delete', style: 'destructive', onPress: () => onDeleteHistoryEntry(task.id, actualIdx) }
                              ]
                            );
                          }
                        }}
                        borderless
                      >
                        <AppIcon name="trash-outline" size={14} color={Colors.clayDeep} />
                      </TouchableRipple>
                    )}
                  </Card.Content>
                </Card>
              ))}
              {task.history.length > 5 && (
                <TouchableRipple
                  onPress={() => setShowAllHistory((v) => !v)}
                  style={styles.showMoreBtn}
                  borderless
                >
                  <Text style={styles.showMoreText}>
                    {showAllHistory
                      ? language === 'hi' ? 'कम दिखाएं' : 'Show less'
                      : `${language === 'hi' ? 'सभी' : 'View all'} ${task.history.length} ${language === 'hi' ? 'एंट्री' : 'entries'}`}
                  </Text>
                </TouchableRipple>
              )}
            </>
          )}

          {/* Delete forever */}
          <TouchableRipple
            style={styles.deleteBtn}
            onPress={() => {
              if (Platform.OS === 'web') {
                if (window.confirm(language === 'hi' ? 'क्या आप वाकई इस कार्य को हटाना चाहते हैं?' : 'Are you sure you want to delete this task?')) {
                  onDelete(task.id);
                }
              } else {
                Alert.alert(
                  language === 'hi' ? 'कार्य हटाएं' : 'Delete Task',
                  language === 'hi' ? 'क्या आप वाकई इस आवर्ती कार्य को हटाना चाहते हैं? इसे पूर्ववत नहीं किया जा सकता।' : 'Are you sure you want to delete this recurring task? This cannot be undone.',
                  [
                    { text: language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
                    { text: language === 'hi' ? 'हटाएं' : 'Delete', style: 'destructive', onPress: () => onDelete(task.id) }
                  ]
                );
              }
            }}
            borderless
          >
            <View style={styles.deleteBtnInner}>
              <AppIcon name="trash-outline" size={16} color={Colors.clayDeep} />
              <Text style={styles.deleteText}>{translate('deleteTask')}</Text>
            </View>
          </TouchableRipple>
        </ScrollView>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
  disabled,
  compact,
}: {
  icon: AppIconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const isInactive = disabled || !onPress;
  return (
    <Card style={[styles.chipCard, isInactive && styles.chipCardDisabled]} mode="elevated">
      <TouchableRipple
        style={styles.chipRipple}
        onPress={onPress}
        disabled={isInactive}
        borderless
      >
        <View style={styles.chipInner}>
          <AppIcon name={icon} size={18} color={isInactive ? Colors.inkFaint : Colors.tealDeep} />
          <Text
            style={[
              styles.chipLabel,
              compact && styles.chipLabelCompact,
              isInactive && styles.chipLabelDisabled,
            ]}
            numberOfLines={2}
          >
            {label}
          </Text>
        </View>
      </TouchableRipple>
    </Card>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surfaceMuted,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: '92%',
    overflow: 'hidden',
    elevation: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(251,247,239,0.3)',
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 10,
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
  heroBand: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 22,
  },
  heroText: { flex: 1, paddingTop: 4 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(251,247,239,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251,247,239,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  catBadge: { ...Typography.caption, color: Colors.onDarkMuted, fontSize: 11 },
  title: { ...Typography.displaySm, color: Colors.onDark, marginBottom: 4, lineHeight: 26 },
  freq: { ...Typography.bodySm, color: Colors.onDarkMuted },
  amount: { ...Typography.title, color: Colors.marigoldLight, marginTop: 6, fontSize: 15 },
  body: { paddingHorizontal: 16, paddingBottom: 80, paddingTop: 16 },

  escalationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(193,80,46,0.10)',
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(193,80,46,0.18)',
  },
  escalationEmoji: { fontSize: 13 },
  escalationText: {
    ...Typography.caption,
    color: Colors.clayDeep,
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
  },

  pinnedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(232,163,61,0.12)',
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(232,163,61,0.22)',
  },
  pinnedText: {
    ...Typography.caption,
    color: Colors.marigoldDeep,
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
  },

  multiDoseCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 12,
    elevation: 1,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  multiDoseCardContent: {
    padding: 14,
    gap: 10,
  },
  multiDoseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  multiDoseCardTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.ink,
  },
  multiDoseCardBadge: {
    backgroundColor: 'rgba(62, 124, 106, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  multiDoseCardBadgeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.tealDeep,
  },
  multiDoseRowsWrap: {
    gap: 8,
  },
  multiDoseItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceMuted,
  },
  multiDoseItemRowNext: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  multiDoseDotCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  multiDoseDotCircleDone: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  multiDoseDotCircleNext: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  multiDoseDotNumber: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 10,
    color: Colors.inkSoft,
  },
  multiDoseTimeLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.ink,
  },
  multiDoseTimeLabelDone: {
    color: Colors.inkSoft,
    textDecorationLine: 'line-through',
  },
  multiDoseStatusLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 10.5,
    color: Colors.inkSoft,
  },
  multiDoseQuickDoneBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },

  sharedCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 12,
    elevation: 1,
  },
  sharedLabel: { ...Typography.label, color: Colors.inkFaint, marginBottom: 8, fontSize: 10 },
  sharedRow: { flexDirection: 'row' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  avatarText: { fontSize: 10, color: Colors.white, fontFamily: 'Manrope_800ExtraBold' },

  futureTaskCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    elevation: 1,
    overflow: 'hidden',
  },
  futureTaskContent: {
    padding: 16,
    gap: 12,
  },
  futureTaskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  futureTaskIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  futureTaskTextCol: {
    flex: 1,
  },
  futureTaskTitle: {
    ...Typography.bodySm,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
    fontSize: 14,
  },
  futureTaskSub: {
    ...Typography.caption,
    color: Colors.inkSoft,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  futureActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },

  actionCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: 12,
    elevation: 1,
    overflow: 'hidden',
  },
  actionContent: {
    padding: 16,
    gap: 12,
  },
  noteInput: {
    backgroundColor: Colors.ivory,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    padding: 12,
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: Colors.ink,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  noteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  noteSkipBtn: { flex: 1, marginVertical: 0 },
  noteConfirmBtn: { flex: 2, marginVertical: 0 },
  secondaryRow: { flexDirection: 'row', gap: 8 },
  chipCard: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    elevation: 0.5,
    overflow: 'hidden',
  },
  chipRipple: {
    paddingVertical: 12,
    paddingHorizontal: 6,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInner: {
    alignItems: 'center',
    gap: 6,
  },
  chipLabel: {
    ...Typography.caption,
    color: Colors.ink,
    textAlign: 'center',
    fontSize: 10.5,
    lineHeight: 14,
    fontFamily: 'Manrope_700Bold',
  },
  chipLabelCompact: { fontSize: 9.5 },
  chipCardDisabled: {
    opacity: 0.5,
    backgroundColor: Colors.surfaceMuted,
  },
  chipLabelDisabled: {
    color: Colors.inkFaint,
  },

  extraActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  extraActionBtn: {
    width: '48%',
    flexGrow: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  webDatePickerContainer: {
    width: '100%',
    paddingHorizontal: 8,
  },
  extraActionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  extraActionText: {
    ...Typography.caption,
    color: Colors.inkSoft,
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
  },
  extraActionActive: { color: Colors.marigoldDeep },

  sectionLabel: { ...Typography.label, color: Colors.inkFaint, marginTop: 4, marginBottom: 10 },
  emptyHistoryCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    elevation: 1,
  },
  emptyHistoryContent: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyHistory: { ...Typography.bodySm, color: Colors.inkFaint, textAlign: 'center', lineHeight: 20 },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(23, 27, 54, 0.04)',
    borderRadius: Radius.sm,
    marginBottom: 16,
  },
  metadataText: {
    ...Typography.caption,
    fontSize: 11.5,
    color: Colors.inkSoft,
    fontFamily: 'Manrope_500Medium',
  },
  metadataTextBold: {
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
  historyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    marginBottom: 8,
    elevation: 1,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  dotOk: { backgroundColor: Colors.teal },
  dotLate: { backgroundColor: Colors.marigold },
  dotMissed: { backgroundColor: Colors.clay },
  historyTextCol: { flex: 1 },
  historyTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyMonth: { flex: 1, ...Typography.bodySm, color: Colors.inkSoft, fontFamily: 'Manrope_600SemiBold' },
  historyStatus: { ...Typography.caption, color: Colors.inkSoft },
  historyStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusPillOk: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusPillLate: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  statusPillMissed: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  historyStatusText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10.5,
  },
  statusTextOk: {
    color: '#059669',
  },
  statusTextLate: {
    color: '#D97706',
  },
  statusTextMissed: {
    color: '#DC2626',
  },
  historyNote: {
    ...Typography.caption,
    color: Colors.inkFaint,
    marginTop: 3,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  showMoreBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: Radius.sm,
    marginBottom: 4,
  },
  showMoreText: {
    ...Typography.caption,
    color: Colors.teal,
    fontFamily: 'Manrope_600SemiBold',
  },
  deleteBtn: {
    marginTop: 16,
    borderRadius: Radius.sm,
  },
  deleteBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  deleteText: { ...Typography.caption, color: Colors.clayDeep, fontFamily: 'Manrope_700Bold' },
  deleteHistoryBtn: {
    padding: 6,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginLeft: 6,
  },
  snoozeOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.ivoryDim,
    borderRadius: Radius.sm,
    padding: 6,
    marginTop: 8,
    gap: 6,
  },
  snoozeOptBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  snoozeCancelBtn: {
    backgroundColor: 'rgba(193,80,46,0.06)',
    borderColor: 'rgba(193,80,46,0.15)',
  },
  snoozeOptText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
  promoCard: {
    backgroundColor: '#FFFDF9',
    borderColor: '#E8A33D60',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#E8A33D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  promoContent: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  promoImage: {
    width: 80,
    height: 80,
    borderRadius: Radius.sm,
    borderColor: '#E8A33D20',
    borderWidth: 1,
    flexShrink: 0,
  },
  promoTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  promoTag: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 9,
    color: '#D97706',
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  promoTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 14.5,
    color: Colors.indigo950,
  },
  promoDesc: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11.5,
    color: Colors.inkSoft,
    marginTop: 4,
    lineHeight: 16,
  },
  promoCodeBadge: {
    backgroundColor: '#E8A33D15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  promoCodeText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 9.5,
    color: Colors.marigoldDeep,
  },
  promoCta: {
    marginTop: 10,
  },
  doneButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  donePrimaryBtn: {
    flex: 1,
  },
  doneSecondaryBtn: {
    flex: 1,
  },

  historyTime: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.inkFaint,
    marginTop: 2,
  },
  completedOccurrenceCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    marginBottom: 16,
    overflow: 'hidden',
  },
  completedOccurrenceContent: {
    padding: 16,
    gap: 12,
  },
  completedOccurrenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  completedOccurrenceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  completedOccurrenceTextCol: {
    flex: 1,
  },
  completedOccurrenceTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#065F46',
  },
  completedOccurrenceSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
  },
  completedOccurrenceNoteBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: Radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  completedOccurrenceNoteText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12.5,
    color: '#065F46',
    fontStyle: 'italic',
  },
  undoOccurrenceBtn: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: Radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoOccurrenceBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  undoOccurrenceBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: '#92400E',
  },
  earlierDoneBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  earlierDoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  earlierDoneText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: '#065F46',
    flex: 1,
  },
  earlierDoneUndoText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#B45309',
    textDecorationLine: 'underline',
  },
});

export const TaskDetailSheet = React.memo(TaskDetailSheetComponent, (prev, next) => {
  return (
    prev.visible === next.visible &&
    prev.task?.id === next.task?.id &&
    prev.task?.updatedAt === next.task?.updatedAt &&
    prev.task?.nextDueDate === next.task?.nextDueDate &&
    prev.task?.title === next.task?.title &&
    prev.task?.alarmEnabled === next.task?.alarmEnabled &&
    prev.task?.history?.length === next.task?.history?.length &&
    prev.language === next.language
  );
});

