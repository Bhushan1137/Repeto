import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import type { RepeatingTask, HouseholdMemberProfile } from '@/types';
import type { HouseholdActivityItem } from '@/services/householdActivityService';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { buildActivityFeed, type ActivityItem } from '@/domain/activityFeed';
import { Colors, Radius, Typography } from '@/constants/theme';

interface ActivityFeedProps {
  tasks: RepeatingTask[];
  members: HouseholdMemberProfile[];
  currentUserId?: string;
  currentUserName: string;
  language: 'en' | 'hi';
  activities?: HouseholdActivityItem[];
}

function formatRelativeTime(dateString: string, lang: 'en' | 'hi'): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return lang === 'hi' ? 'अभी-अभी' : 'Just now';
  if (mins < 60) return lang === 'hi' ? `${mins} मिनट पहले` : `${mins}m ago`;
  if (hours < 24) return lang === 'hi' ? `${hours} घंटे पहले` : `${hours}h ago`;
  if (days === 1) return lang === 'hi' ? 'कल' : 'Yesterday';
  return lang === 'hi' ? `${days} दिन पहले` : `${days}d ago`;
}

interface ActionDisplayConfig {
  actionLabel: string;
  actionColor: string;
  iconName: AppIconName;
  iconColor: string;
  iconBg: string;
  showTaskTitle: boolean;
}

function getActionConfig(item: ActivityItem, lang: 'en' | 'hi'): ActionDisplayConfig {
  const isHi = lang === 'hi';

  switch (item.action) {
    case 'task_created':
      return {
        actionLabel: isHi ? 'नया कार्य बनाया' : 'created',
        actionColor: '#15803D',
        iconName: 'add',
        iconColor: '#15803D',
        iconBg: '#DCFCE7',
        showTaskTitle: true,
      };
    case 'task_taken_over':
      return {
        actionLabel: isHi ? 'कार्य अपने जिम्मे लिया' : 'claimed',
        actionColor: '#6D28D9',
        iconName: 'person-circle-outline',
        iconColor: '#6D28D9',
        iconBg: '#EDE9FE',
        showTaskTitle: true,
      };
    case 'task_assigned':
      return {
        actionLabel: isHi
          ? (item.targetUserName ? `ने कार्य ${item.targetUserName} को सौंपा` : 'ने कार्य सौंपा')
          : (item.targetUserName ? `assigned to ${item.targetUserName}` : 'assigned'),
        actionColor: '#1D4ED8',
        iconName: 'people-outline',
        iconColor: '#1D4ED8',
        iconBg: '#DBEAFE',
        showTaskTitle: true,
      };
    case 'task_rescheduled':
      return {
        actionLabel: isHi ? 'की नियत तारीख बदली' : 'rescheduled',
        actionColor: '#0284C7',
        iconName: 'calendar-outline',
        iconColor: '#0284C7',
        iconBg: '#E0F2FE',
        showTaskTitle: true,
      };
    case 'task_deleted':
      return {
        actionLabel: isHi ? 'कार्य हटाया' : 'deleted',
        actionColor: '#E11D48',
        iconName: 'trash-outline',
        iconColor: '#E11D48',
        iconBg: '#FFE4E6',
        showTaskTitle: true,
      };
    case 'task_restored':
      return {
        actionLabel: isHi ? 'कार्य पूर्ववत किया' : 'restored',
        actionColor: '#0F766E',
        iconName: 'bookmark-outline',
        iconColor: '#0F766E',
        iconBg: '#CCFBF1',
        showTaskTitle: true,
      };
    case 'member_joined':
      return {
        actionLabel: isHi ? 'परिवार में शामिल हुए' : 'joined the household',
        actionColor: '#059669',
        iconName: 'home-outline',
        iconColor: '#059669',
        iconBg: '#D1FAE5',
        showTaskTitle: false,
      };
    case 'member_left':
      return {
        actionLabel: isHi ? 'परिवार से अलग हुए' : 'left the household',
        actionColor: '#D97706',
        iconName: 'exit-outline',
        iconColor: '#D97706',
        iconBg: '#FEF3C7',
        showTaskTitle: false,
      };
    case 'member_removed':
      return {
        actionLabel: isHi
          ? (item.targetUserName ? `ने ${item.targetUserName} को परिवार से हटाया` : 'ने सदस्य को हटाया')
          : (item.targetUserName ? `removed ${item.targetUserName}` : 'removed member'),
        actionColor: '#DC2626',
        iconName: 'person-remove-outline',
        iconColor: '#DC2626',
        iconBg: '#FEE2E2',
        showTaskTitle: false,
      };
    case 'task_snoozed':
      return {
        actionLabel: isHi ? 'को सणूज़ (आगे बढ़ाया)' : 'snoozed',
        actionColor: Colors.marigoldDeep,
        iconName: 'time-outline',
        iconColor: '#EA580C',
        iconBg: '#FFEDD5',
        showTaskTitle: true,
      };
    case 'task_skipped':
      return {
        actionLabel: isHi ? 'को छोड़ दिया' : 'skipped',
        actionColor: Colors.clay,
        iconName: 'play-skip-forward-outline',
        iconColor: '#4B5563',
        iconBg: '#F3F4F6',
        showTaskTitle: true,
      };
    case 'task_completed':
    default:
      return {
        actionLabel: isHi ? 'को पूरा किया' : 'completed',
        actionColor: Colors.tealDeep,
        iconName: 'checkmark-circle-outline',
        iconColor: '#16A34A',
        iconBg: '#DCFCE7',
        showTaskTitle: true,
      };
  }
}

export function ActivityFeed({
  tasks,
  members,
  currentUserId,
  currentUserName,
  language,
  activities,
}: ActivityFeedProps) {
  const items = useMemo(
    () => buildActivityFeed(tasks, members, currentUserId, currentUserName, activities),
    [tasks, members, currentUserId, currentUserName, activities]
  );

  const displayItems = useMemo(() => items.slice(0, 25), [items]);

  if (displayItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {language === 'hi' ? 'कोई हालिया गतिविधि नहीं' : 'No recent activity yet'}
        </Text>
      </View>
    );
  }

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content style={styles.cardContent}>
        {displayItems.map((item, idx) => {
          const isYou = item.completedByName === currentUserName;
          const namePart = isYou ? (language === 'hi' ? 'आपने' : 'You') : item.completedByName;
          const config = getActionConfig(item, language);

          return (
            <View
              key={item.id}
              style={[styles.row, idx === displayItems.length - 1 && styles.lastRow]}
            >
              <View style={[styles.avatar, { backgroundColor: config.iconBg }]}>
                <AppIcon name={config.iconName} size={16} color={config.iconColor} />
              </View>
              <View style={styles.textCol}>
                <Text style={styles.activityText}>
                  <Text style={styles.nameText}>{namePart}</Text>{' '}
                  <Text style={{ color: config.actionColor, fontFamily: 'Manrope_700Bold' }}>
                    {config.actionLabel}
                  </Text>{' '}
                  {config.showTaskTitle && item.taskTitle ? (
                    <Text style={styles.taskText}>{item.taskTitle}</Text>
                  ) : null}
                </Text>
                {item.note ? (
                  <Text style={styles.noteText}>📝 {item.note}</Text>
                ) : null}
                <Text style={styles.timeText}>{formatRelativeTime(item.completedAt, language)}</Text>
              </View>
            </View>
          );
        })}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 16,
    elevation: 1.5,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarText: {
    color: Colors.white,
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 11,
  },
  textCol: {
    flex: 1,
  },
  activityText: {
    ...Typography.bodySm,
    fontSize: 13,
    color: Colors.ink,
    lineHeight: 18,
  },
  nameText: {
    fontFamily: 'Manrope_700Bold',
  },
  taskText: {
    fontFamily: 'Manrope_700Bold',
    color: Colors.marigoldDeep,
  },
  noteText: {
    ...Typography.caption,
    color: Colors.inkFaint,
    fontSize: 11.5,
    marginTop: 3,
    fontStyle: 'italic',
  },
  timeText: {
    ...Typography.caption,
    color: Colors.inkSoft,
    fontSize: 11,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
  },
});
