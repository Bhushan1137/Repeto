import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, Pressable, StyleProp, ViewStyle, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import type { Language, RepeatingTask, CategoryKey, HouseholdMemberProfile } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { Colors, Radius, Typography } from '@/constants/theme';
import { daysUntilDue, daysPercent, shortDayLabel } from '@/domain/recurrence';
import { getTodayDoseProgress } from '@/domain/task';
import { ProgressRing } from '@/components/ProgressRing';
import { AppIcon } from '@/components/AppIcon';
import { formatTime12 } from '@/utils/timeFormat';

interface TaskCardProps {
  task: RepeatingTask;
  language: Language;
  onPress: () => void;
  onCompletePress?: () => void;
  selected?: boolean;
  selectionMode?: boolean;
  onLongPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  currentUserId?: string;
  currentUserCode?: string;
  householdMembers?: HouseholdMemberProfile[];
  onTakeOver?: () => void;
  onNudge?: () => void;
  isOverdue?: boolean;
}

function TaskCardComponent({
  task,
  language,
  onPress,
  onCompletePress,
  selected,
  selectionMode,
  onLongPress,
  testID,
  style,
  currentUserId,
  currentUserCode,
  householdMembers,
  onTakeOver,
  onNudge,
  isOverdue = false,
}: TaskCardProps) {
  const cat = CATEGORY_MAP[task.category as CategoryKey] || CATEGORY_MAP['home'] || { icon: '📋', accent: 'marigold' };
  const days = daysUntilDue(task.nextDueDate);
  const overdue = days < 0;

  const { catBg, catColor } = useMemo(() => {
    switch (task.category) {
      case 'medicines':
      case 'health':
        return { catBg: '#FCE7F3', catColor: '#9D174D' }; // soft pink/magenta
      case 'gardening':
        return { catBg: '#ECFDF5', catColor: '#065F46' }; // soft green/emerald
      case 'maintenance':
        return { catBg: '#F0FDFA', catColor: '#0F766E' }; // soft teal
      case 'fitness':
      case 'bills':
      case 'finance':
      case 'work':
      case 'documents':
        return { catBg: '#EFF6FF', catColor: '#1E40AF' }; // soft blue
      case 'home':
      case 'subs':
      case 'help':
      case 'supplies':
        return { catBg: '#FFFBEB', catColor: '#B45309' }; // soft yellow/amber
      default:
        return { catBg: '#F3F4F6', catColor: '#374151' }; // soft grey
    }
  }, [task.category]);

  const reminderText = useMemo(() => {
    const time = formatTime12(task.reminderTime);
    if (days === 0) {
      return language === 'hi' ? `आज ${time}` : `Today at ${time}`;
    }
    if (days === 1) {
      return language === 'hi' ? `कल ${time}` : `Tomorrow at ${time}`;
    }
    if (days < 0) {
      if (days === -1) {
        return language === 'hi' ? 'कल याद दिलाया गया था' : 'Reminder was yesterday';
      }
      const n = Math.abs(days);
      return language === 'hi' ? `${n} दिन पहले याद दिलाया गया था` : `Reminder was ${n} days ago`;
    }
    const d = new Date(task.nextDueDate);
    const weekday = d.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    const month = d.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', { month: 'short' });
    const formattedDate = `${dayNum} ${month}`;
    return language === 'hi'
      ? `${days} दिनों में - ${weekday}, ${formattedDate}`
      : `In ${days} days - ${weekday}, ${formattedDate}`;
  }, [days, task.nextDueDate, task.reminderTime, language]);

  const isMultiDose = Boolean(task.timesPerDay && task.timesPerDay > 1);

  const doseProgress = useMemo(() => {
    if (!isMultiDose) return null;
    return getTodayDoseProgress(task);
  }, [isMultiDose, task]);

  const ringPercent = useMemo(() => {
    if (isMultiDose && doseProgress && days === 0) {
      if (doseProgress.isAllDone) return 100;
      return Math.round((doseProgress.completedCount / doseProgress.totalDoses) * 100);
    }
    return daysPercent(days);
  }, [isMultiDose, doseProgress, days]);

  const ringLabel = useMemo(() => {
    if (isMultiDose && doseProgress && days === 0) {
      if (doseProgress.isAllDone) {
        return language === 'hi' ? 'पूर्ण' : 'Done';
      }
      return `${doseProgress.completedCount}/${doseProgress.totalDoses}`;
    }
    return shortDayLabel(days, language);
  }, [isMultiDose, doseProgress, days, language]);

  const defaultId = testID ?? `task-card-${task.id}`;
  const showCheckbox = selectionMode || selected;

  const isAssignedToMe = useMemo(() => {
    if (!task.assignedTo) return false;
    return (
      (Boolean(currentUserId) && task.assignedTo === currentUserId) ||
      (Boolean(currentUserCode) && task.assignedTo === currentUserCode)
    );
  }, [task.assignedTo, currentUserId, currentUserCode]);

  const isAssignedToOther = Boolean(task.householdId && task.assignedTo && !isAssignedToMe);

  const assigneeName = useMemo(() => {
    if (!task.assignedTo) {
      return language === 'hi' ? 'असाइन नहीं' : 'Unassigned';
    }
    if (isAssignedToMe) {
      return language === 'hi' ? 'आप' : 'You';
    }
    const member = householdMembers?.find(
      (m) => m.userId === task.assignedTo || m.code === task.assignedTo
    );
    return member?.name || (language === 'hi' ? 'अन्य सदस्य' : 'Member');
  }, [task.assignedTo, isAssignedToMe, householdMembers, language]);

  const handleLockedOrAssigneePress = useCallback(() => {
    if (!task.householdId) return;

    if (!task.assignedTo) {
      if (!onTakeOver) return;
      Alert.alert(
        task.title,
        language === 'hi'
          ? 'क्या आप यह कार्य अपने नाम लेना चाहते हैं?'
          : 'Would you like to assign this task to yourself?',
        [
          { text: language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
          { text: language === 'hi' ? 'स्वीकार करें' : 'Assign to Me', onPress: onTakeOver },
        ]
      );
      return;
    }

    if (isAssignedToOther) {
      const options: { text: string; style?: 'cancel' | 'default' | 'destructive'; onPress?: () => void }[] = [
        { text: language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
      ];
      if (onNudge) {
        options.push({
          text: language === 'hi' ? 'नज़ भेजें 👉' : `Nudge ${assigneeName} 👉`,
          onPress: onNudge,
        });
      }
      if (onTakeOver) {
        options.push({
          text: language === 'hi' ? 'स्वयं को सौंपें (Take Over)' : 'Assign to Me (Take Over)',
          onPress: onTakeOver,
        });
      }

      Alert.alert(
        task.title,
        language === 'hi'
          ? `${assigneeName} को यह कार्य सौंपा गया है। आप क्या करना चाहते हैं?`
          : `Assigned to ${assigneeName}. What would you like to do?`,
        options
      );
    }
  }, [task.householdId, task.assignedTo, task.title, isAssignedToOther, assigneeName, language, onTakeOver, onNudge]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
        style,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={onLongPress ? 280 : undefined}
      android_ripple={{ color: 'rgba(0, 0, 0, 0.04)' }}
      testID={defaultId}
    >
      <View style={styles.cardContent} testID={`${defaultId}-content`}>
        <View style={[styles.accentBar, { backgroundColor: overdue ? Colors.clay : catColor }]} testID={`${defaultId}-accent-bar`} />

        {/* Sleek selection checkbox */}
        {showCheckbox && (
          <View
            style={[
              styles.checkboxCircle,
              selected && styles.checkboxCircleSelected,
            ]}
            testID={`${defaultId}-checkbox`}
          >
            {selected && (
              <AppIcon name="checkmark" size={13} color={Colors.white} />
            )}
          </View>
        )}

        {/* Category Icon Badge remains preserved */}
        <View
          style={[styles.iconBadge, { backgroundColor: catBg }]}
          testID={`${defaultId}-icon-btn`}
        >
          <Text style={styles.icon}>{task.icon || cat.icon}</Text>
        </View>

        <View style={styles.info} testID={`${defaultId}-info`}>
          <View style={styles.titleRow} testID={`${defaultId}-title-row`}>
            {task.pinned && (
              <Text style={styles.pinBadge} testID={`${defaultId}-pin-badge`}>📌</Text>
            )}
            <Text style={styles.title} numberOfLines={1} testID={`${defaultId}-title`}>
              {task.title}
            </Text>
            {task.escalationCount >= 2 && (
              <Text style={styles.flameBadge} testID={`${defaultId}-flame-badge`}>🔥</Text>
            )}
          </View>
          
          <View style={styles.metaRow} testID={`${defaultId}-meta-row`}>
            <Text style={styles.freqText} testID={`${defaultId}-freq`}>{task.frequencyLabel}</Text>
            {task.amount ? (
              <Text style={styles.amountText} testID={`${defaultId}-amount`}> • ₹{task.amount.toLocaleString('en-IN')}</Text>
            ) : null}
          </View>

          {isMultiDose && doseProgress ? (
            <View style={styles.doseIndicatorRow} testID={`${defaultId}-dose-indicator`}>
              <View style={styles.doseDotsWrap}>
                {Array.from({ length: doseProgress.totalDoses }, (_, idx) => {
                  const isDone = doseProgress.completedIndices.includes(idx);
                  const isNext = idx === doseProgress.nextDoseIndex && !doseProgress.isAllDone;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.doseDot,
                        isDone && styles.doseDotDone,
                        isNext && [styles.doseDotNext, { borderColor: catColor }],
                      ]}
                    />
                  );
                })}
              </View>
              <Text style={styles.doseIndicatorText} numberOfLines={1}>
                {doseProgress.isAllDone
                  ? (language === 'hi' ? 'आज के सभी पूर्ण ✓' : 'All done today ✓')
                  : (language === 'hi'
                      ? `अगली: ⏱ ${formatTime12(doseProgress.times[doseProgress.nextDoseIndex])}`
                      : `Upcoming: ⏱ ${formatTime12(doseProgress.times[doseProgress.nextDoseIndex])}`)}
              </Text>
            </View>
          ) : (
            <View style={styles.reminderRow} testID={`${defaultId}-reminder-row`}>
              <AppIcon name="notifications-outline" size={11} color={Colors.inkFaint} style={{ marginRight: 4 }} />
              <Text style={styles.reminderText} numberOfLines={1} testID={`${defaultId}-reminder`}>
                {reminderText}
              </Text>
            </View>
          )}

          {/* Household Assignee Pill */}
          {task.householdId ? (
            <Pressable
              style={[
                styles.assigneePill,
                isAssignedToMe && styles.assigneePillMe,
                isAssignedToOther && styles.assigneePillOther,
                !task.assignedTo && styles.assigneePillUnassigned,
              ]}
              onPress={(e) => {
                if (selectionMode) {
                  onPress();
                  return;
                }
                e.stopPropagation();
                handleLockedOrAssigneePress();
              }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              testID={`${defaultId}-assignee-pill`}
            >
              <Text
                style={[
                  styles.assigneeText,
                  isAssignedToMe && styles.assigneeTextMe,
                  isAssignedToOther && styles.assigneeTextOther,
                  !task.assignedTo && styles.assigneeTextUnassigned,
                ]}
                numberOfLines={1}
              >
                {task.isRotating ? '🔄 ' : '👤 '}
                {task.isRotating
                  ? (isAssignedToMe
                      ? (language === 'hi' ? 'आपकी बारी' : 'Your turn')
                      : (language === 'hi' ? `${assigneeName} की बारी` : `${assigneeName}'s turn`))
                  : assigneeName}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.rightColWrapper} testID={`${defaultId}-right-col`}>
          {/* Overdue pill — shown above the Today circle when the reminder time has passed */}
          {isOverdue && (
            <View style={styles.overduePill}>
              <AppIcon name="alert-circle-outline" size={10} color="#B45309" />
              <Text style={styles.overduePillText}>
                {language === 'hi' ? 'विलंबित' : 'Overdue'}
              </Text>
            </View>
          )}
          <View style={styles.rightCol}>
            <ProgressRing
              percent={ringPercent}
              color={overdue ? Colors.clay : (isMultiDose && doseProgress?.isAllDone ? '#059669' : days === 0 ? '#2563EB' : '#16A34A')}
              size={52}
              stroke={4.5}
              label={ringLabel}
              labelColor={overdue ? Colors.clayDeep : (isMultiDose && doseProgress?.isAllDone ? '#059669' : Colors.ink)}
              testID={`${defaultId}-progress-ring`}
            />
            {!selected && !selectionMode && isAssignedToOther ? (
              <Pressable
                style={styles.lockedBtn}
                testID={`${defaultId}-locked-complete-btn`}
                onPress={(e) => {
                  e.stopPropagation();
                  handleLockedOrAssigneePress();
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                android_ripple={{ color: 'rgba(0, 0, 0, 0.08)', borderless: true, radius: 20 }}
              >
                <AppIcon name="lock-closed-outline" size={18} color={Colors.inkFaint} />
              </Pressable>
            ) : !selected && !selectionMode && onCompletePress ? (
              <Pressable
                style={styles.quickCompleteBtn}
                testID={`${defaultId}-quick-complete-btn`}
                onPress={(e) => {
                  e.stopPropagation();
                  onCompletePress();
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                android_ripple={{ color: 'rgba(0, 0, 0, 0.08)', borderless: true, radius: 20 }}
              >
                <AppIcon name="checkmark-circle-outline" size={26} color={overdue ? Colors.clay : Colors.inkFaint} />
              </Pressable>
            ) : !selectionMode ? (
              <AppIcon name="chevron-forward" size={16} color={Colors.inkFaint} />
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export const TaskCard = React.memo(TaskCardComponent, (prev, next) => {
  return (
    prev.task.id === next.task.id &&
    prev.task.updatedAt === next.task.updatedAt &&
    prev.task.nextDueDate === next.task.nextDueDate &&
    prev.task.title === next.task.title &&
    prev.task.pinned === next.task.pinned &&
    prev.task.escalationCount === next.task.escalationCount &&
    prev.task.assignedTo === next.task.assignedTo &&
    prev.task.householdId === next.task.householdId &&
    prev.isOverdue === next.isOverdue &&
    (prev.task.history?.length ?? 0) === (next.task.history?.length ?? 0) &&
    prev.selected === next.selected &&
    prev.selectionMode === next.selectionMode &&
    prev.language === next.language &&
    prev.currentUserId === next.currentUserId &&
    prev.currentUserCode === next.currentUserCode &&
    Boolean(prev.onCompletePress) === Boolean(next.onCompletePress)
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  cardSelected: {
    backgroundColor: Colors.white,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.992 }],
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingLeft: 16,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxCircleSelected: {
    borderColor: Colors.tealDeep,
    backgroundColor: Colors.tealDeep,
  },
  iconBadge: { 
    width: 44, 
    height: 44, 
    borderRadius: 13, 
    alignItems: 'center', 
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: { fontSize: 20, textAlign: 'center' },
  info: { flex: 1, minWidth: 0, marginLeft: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  title: { ...Typography.title, fontSize: 15, color: Colors.ink, flex: 1 },
  pinBadge: { fontSize: 12 },
  flameBadge: { fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 },
  freqText: { ...Typography.caption, color: Colors.inkSoft, fontSize: 11 },
  amountText: { ...Typography.caption, color: Colors.tealDeep, fontFamily: 'Manrope_800ExtraBold', fontSize: 11 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  reminderText: { ...Typography.caption, fontSize: 10.5, color: Colors.inkSoft, fontFamily: 'Manrope_600SemiBold' },
  doseIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 2,
  },
  doseDotsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.2,
    borderColor: Colors.inkFaint,
    backgroundColor: 'transparent',
  },
  doseDotDone: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  doseDotNext: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderColor: '#2563EB',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  doseIndicatorText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  rightColWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  rightCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overduePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(180, 83, 9, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.30)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  overduePillText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 9.5,
    color: '#B45309',
  },
  quickCompleteBtn: {
    padding: 4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBtn: {
    padding: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  assigneePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
  },
  assigneePillMe: {
    backgroundColor: '#EFF6FF',
    borderWidth: 0.8,
    borderColor: '#BFDBFE',
  },
  assigneePillOther: {
    backgroundColor: '#F8FAFC',
    borderWidth: 0.8,
    borderColor: '#E2E8F0',
  },
  assigneePillUnassigned: {
    backgroundColor: '#FFFBEB',
    borderWidth: 0.8,
    borderColor: '#FDE68A',
  },
  assigneeText: {
    fontSize: 10,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.inkSoft,
  },
  assigneeTextMe: {
    color: '#1D4ED8',
    fontFamily: 'Manrope_700Bold',
  },
  assigneeTextOther: {
    color: '#475569',
  },
  assigneeTextUnassigned: {
    color: '#B45309',
    fontFamily: 'Manrope_700Bold',
  },
});
