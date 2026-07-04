import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import type { Language, RepeatingTask } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { AccentHex, Colors, Radius, Typography } from '@/constants/theme';
import { daysUntilDue, dayLabel, shortDayLabel, daysPercent } from '@/domain/recurrence';
import { initials } from '@/domain/insights';
import { ProgressRing } from '@/components/ProgressRing';
import { useAuth } from '@/providers/AuthProvider';

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
  const cat = CATEGORY_MAP[task.category];
  const hex = AccentHex[cat.accent];
  const days = daysUntilDue(task.nextDueDate);
  const overdue = days < 0;
  const [hovered, setHovered] = useState(false);
  const { user } = useAuth();

  const assignee = useMemo(() => {
    if (!task.assignedTo || !user) return null;
    if (task.assignedTo === user.id) {
      return { name: user.name, color: '#E8A33D', isYou: true };
    }
    const member = user.householdMembers?.find(
      (m) => m.userId === task.assignedTo || m.code === task.assignedTo
    );
    if (member) {
      return { name: member.name, color: member.color, isYou: false };
    }
    return null;
  }, [task.assignedTo, user]);

  return (
    <Card
      style={[styles.card, selected && styles.cardSelected]}
      mode="elevated"
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Card.Content style={styles.cardContent}>
        <View style={[styles.accentBar, { backgroundColor: overdue ? Colors.clay : hex }]} />
        
        {selected ? (
          <View style={[styles.iconBadge, { backgroundColor: Colors.marigold }]}>
            <Text style={[styles.icon, { color: Colors.white }]}>✓</Text>
          </View>
        ) : onCompletePress ? (

          <TouchableRipple
            style={[styles.iconBadge, { backgroundColor: hovered ? (overdue ? Colors.clay : hex) : `${hex}12` }]}
            onPress={(e) => {
              e.stopPropagation();
              onCompletePress();
            }}
            borderless
            {...(Platform.OS === 'web'
              ? {
                  onMouseEnter: () => setHovered(true),
                  onMouseLeave: () => setHovered(false),
                }
              : {})}
          >
            <Text style={[styles.icon, hovered && styles.iconCompleted, { color: hovered ? Colors.white : Colors.ink }]}>
              {hovered ? '✓' : cat.icon}
            </Text>
          </TouchableRipple>
        ) : (
          <View style={[styles.iconBadge, { backgroundColor: `${hex}12` }]}>
            <Text style={styles.icon}>{cat.icon}</Text>
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
          <View style={styles.meta}>
            <Text style={styles.freq}>{task.frequencyLabel}</Text>
            {task.amount ? (
              <Text style={styles.amount}>· ₹{task.amount.toLocaleString('en-IN')}</Text>
            ) : null}
            <Text
              style={[
                styles.dueText,
                overdue ? styles.dueOverdue : days === 0 ? styles.dueToday : styles.dueUpcoming,
              ]}
            >
              · {dayLabel(days, language)}
            </Text>
          </View>
          {assignee && (
            <View style={styles.assigneeRow}>
              <View style={[styles.assigneeAvatar, { backgroundColor: assignee.color }]}>
                <Text style={styles.assigneeAvatarText}>{initials(assignee.name)}</Text>
              </View>
              <Text style={styles.assigneeText} numberOfLines={1}>
                {assignee.isYou ? (language === 'hi' ? 'आपको सौंपा' : 'Assigned to you') : assignee.name}
              </Text>
            </View>
          )}

          {task.sharedWith.length > 0 && !assignee && (
            <View style={styles.avatars}>
              {task.sharedWith.map((s) => (
                <View key={s.phone} style={[styles.avatar, { backgroundColor: s.color }]}>
                  <Text style={styles.avatarText}>{initials(s.name)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <ProgressRing
          percent={daysPercent(days)}
          color={overdue ? AccentHex.clay : hex}
          size={44}
          stroke={4}
          label={shortDayLabel(days, language)}
          labelColor={overdue ? Colors.clayDeep : Colors.ink}
        />
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
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: Colors.marigold,
    backgroundColor: Colors.ivory,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingLeft: 18,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3.5,
    borderRadius: 3,
  },
  iconBadge: { 
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center',
    overflow: 'hidden'
  },
  icon: { fontSize: 20, textAlign: 'center' },
  iconCompleted: { fontFamily: 'Manrope_800ExtraBold', fontSize: 18 },
  info: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  title: { ...Typography.title, fontSize: 14.5, color: Colors.ink, flex: 1 },
  pinBadge: { fontSize: 12 },
  flameBadge: { fontSize: 13 },
  meta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  freq: { ...Typography.caption, color: Colors.inkSoft },
  amount: { ...Typography.caption, color: Colors.tealDeep, fontFamily: 'Manrope_800ExtraBold' },
  dueText: { ...Typography.caption, fontFamily: 'Manrope_700Bold' },
  dueOverdue: { color: Colors.clay },
  dueToday: { color: Colors.marigoldDeep },
  dueUpcoming: { color: Colors.teal },
  avatars: { flexDirection: 'row', marginTop: 8 },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  avatarText: { fontSize: 9, fontFamily: 'Manrope_800ExtraBold', color: Colors.white },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  assigneeAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeAvatarText: {
    fontSize: 8,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.white,
  },
  assigneeText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.inkSoft,
    fontFamily: 'Manrope_600SemiBold',
  },
});

