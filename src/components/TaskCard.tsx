import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import type { Language, RepeatingTask, CategoryKey } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { Colors, Radius, Typography } from '@/constants/theme';
import { daysUntilDue, daysPercent, shortDayLabel } from '@/domain/recurrence';
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
}: TaskCardProps) {
  const cat = CATEGORY_MAP[task.category as CategoryKey] || CATEGORY_MAP['home'] || { icon: '📋', accent: 'marigold' };
  const days = daysUntilDue(task.nextDueDate);
  const overdue = days < 0;

  const { catBg, catColor } = useMemo(() => {
    switch (task.category) {
      case 'medicines':
      case 'health':
        return { catBg: '#FCE7F3', catColor: '#9D174D' }; // soft pink/magenta
      case 'fitness':
        return { catBg: '#EFF6FF', catColor: '#1E40AF' }; // soft blue
      case 'bills':
      case 'finance':
      case 'work':
        return { catBg: '#EFF6FF', catColor: '#1E40AF' }; // soft blue
      case 'home':
      case 'subs':
      case 'help':
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

  const defaultId = testID ?? `task-card-${task.id}`;
  const showCheckbox = selectionMode || selected;

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
      delayLongPress={onLongPress ? 220 : undefined}
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

          <View style={styles.reminderRow} testID={`${defaultId}-reminder-row`}>
            <AppIcon name="notifications-outline" size={11} color={Colors.inkFaint} style={{ marginRight: 4 }} />
            <Text style={styles.reminderText} numberOfLines={1} testID={`${defaultId}-reminder`}>
              {reminderText}
            </Text>
          </View>
        </View>

        <View style={styles.rightCol} testID={`${defaultId}-right-col`}>
          <ProgressRing
            percent={daysPercent(days)}
            color={overdue ? Colors.clay : days === 0 ? '#2563EB' : '#16A34A'}
            size={52}
            stroke={4.5}
            label={shortDayLabel(days, language)}
            labelColor={overdue ? Colors.clayDeep : Colors.ink}
            testID={`${defaultId}-progress-ring`}
          />
          {!selected && !selectionMode && onCompletePress ? (
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
    prev.selected === next.selected &&
    prev.selectionMode === next.selectionMode &&
    prev.language === next.language &&
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
  rightCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickCompleteBtn: {
    padding: 4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
