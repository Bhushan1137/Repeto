import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import type { Language, RepeatingTask, CategoryKey } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { AccentHex, Colors, Radius, Typography } from '@/constants/theme';
import { daysUntilDue, dayLabel, shortDayLabel, daysPercent } from '@/domain/recurrence';
import { initials } from '@/domain/insights';
import { ProgressRing } from '@/components/ProgressRing';
import { useAuth } from '@/providers/AuthProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { AppIcon } from '@/components/AppIcon';

interface TaskCardProps {
  task: RepeatingTask;
  language: Language;
  onPress: () => void;
  onCompletePress?: () => void;
  selected?: boolean;
  onLongPress?: () => void;
}

export function TaskCard({
  task,
  language,
  onPress,
  onCompletePress,
  selected,
  onLongPress,
}: TaskCardProps) {
  const cat = CATEGORY_MAP[task.category as CategoryKey] || CATEGORY_MAP['home'] || { icon: '📋', accent: 'marigold' };
  const days = daysUntilDue(task.nextDueDate);
  const overdue = days < 0;
  const { user } = useAuth();
  const { translate } = useTranslation();

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
    const time = task.reminderTime || '9:00 AM';
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

  return (
    <Card
      style={[styles.card, selected && styles.cardSelected]}
      mode="elevated"
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Card.Content style={styles.cardContent}>
        <View style={[styles.accentBar, { backgroundColor: overdue ? Colors.clay : catColor }]} />
        
        {selected ? (
          <View style={[styles.iconBadge, { backgroundColor: Colors.marigold }]}>
            <Text style={[styles.icon, { color: Colors.white }]}>✓</Text>
          </View>
        ) : onCompletePress ? (
          <TouchableRipple
            style={[styles.iconBadge, { backgroundColor: catBg }]}
            onPress={(e) => {
              e.stopPropagation();
              onCompletePress();
            }}
            borderless
          >
            <Text style={styles.icon}>
              {task.icon || cat.icon}
            </Text>
          </TouchableRipple>
        ) : (
          <View style={[styles.iconBadge, { backgroundColor: catBg }]}>
            <Text style={styles.icon}>{task.icon || cat.icon}</Text>
          </View>
        )}

        <View style={styles.info}>
          <View style={styles.titleRow}>
            {task.pinned && (
              <Text style={styles.pinBadge}>📌</Text>
            )}
            <Text style={styles.title} numberOfLines={1}>
              {task.title}
            </Text>
            {task.escalationCount >= 2 && (
              <Text style={styles.flameBadge}>🔥</Text>
            )}
          </View>
          
          <View style={styles.metaRow}>
            <Text style={styles.freqText}>{task.frequencyLabel}</Text>
            {task.amount ? (
              <Text style={styles.amountText}> • ₹{task.amount.toLocaleString('en-IN')}</Text>
            ) : null}
          </View>

          <View style={styles.reminderRow}>
            <AppIcon name="notifications-outline" size={11} color={Colors.inkFaint} style={{ marginRight: 4 }} />
            <Text style={styles.reminderText} numberOfLines={1}>
              {reminderText}
            </Text>
          </View>
        </View>

        <View style={styles.rightCol}>
          <ProgressRing
            percent={daysPercent(days)}
            color={overdue ? Colors.clay : days === 0 ? '#2563EB' : '#16A34A'}
            size={54}
            stroke={4.5}
            label={shortDayLabel(days, language)}
            labelColor={overdue ? Colors.clayDeep : Colors.ink}
          />
          <AppIcon name="chevron-forward" size={16} color={Colors.inkFaint} />
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 1.5,
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: Colors.marigold,
    backgroundColor: Colors.ivory,
    elevation: 0,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  iconBadge: { 
    width: 46, 
    height: 46, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center',
    overflow: 'hidden'
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
  reminderText: { ...Typography.caption, fontSize: 10.5, color: Colors.inkFaint, fontFamily: 'Manrope_600SemiBold' },
  rightCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

