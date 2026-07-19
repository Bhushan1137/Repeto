import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import type { RepeatingTask, HouseholdMemberProfile } from '@/types';
import { AppIcon } from '@/components/AppIcon';
import { buildActivityFeed } from '@/domain/activityFeed';
import { initials } from '@/domain/insights';
import { Colors, Radius, Typography } from '@/constants/theme';

interface ActivityFeedProps {
  tasks: RepeatingTask[];
  members: HouseholdMemberProfile[];
  currentUserId?: string;
  currentUserName: string;
  language: 'en' | 'hi';
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

export function ActivityFeed({
  tasks,
  members,
  currentUserId,
  currentUserName,
  language,
}: ActivityFeedProps) {
  const items = useMemo(
    () => buildActivityFeed(tasks, members, currentUserId, currentUserName),
    [tasks, members, currentUserId, currentUserName]
  );

  const displayItems = useMemo(() => items.slice(0, 10), [items]);

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

          let actionLabel = '';
          if (language === 'hi') {
            if (item.status === 'snoozed') {
              actionLabel = 'को सणूज़ (आगे बढ़ाया)';
            } else if (item.status === 'skipped') {
              actionLabel = 'को छोड़ दिया';
            } else {
              actionLabel = 'को पूरा किया';
            }
          } else {
            if (item.status === 'snoozed') {
              actionLabel = 'snoozed';
            } else if (item.status === 'skipped') {
              actionLabel = 'skipped';
            } else {
              actionLabel = 'completed';
            }
          }

          const actionColor =
            item.status === 'snoozed'
              ? Colors.marigoldDeep
              : item.status === 'skipped'
              ? Colors.clay
              : Colors.tealDeep;

          const iconName = item.status === 'snoozed' ? 'time-outline' : (item.status === 'skipped' ? 'play-skip-forward-outline' : 'checkmark-circle-outline');
          const iconColor = item.status === 'snoozed' ? '#EA580C' : (item.status === 'skipped' ? '#4B5563' : '#16A34A');
          const iconBg = item.status === 'snoozed' ? '#FFEDD5' : (item.status === 'skipped' ? '#F3F4F6' : '#DCFCE7');

          return (
            <View
              key={item.id}
              style={[styles.row, idx === displayItems.length - 1 && styles.lastRow]}
            >
              <View style={[styles.avatar, { backgroundColor: iconBg }]}>
                <AppIcon name={iconName} size={16} color={iconColor} />
              </View>
              <View style={styles.textCol}>
                <Text style={styles.activityText}>
                  <Text style={styles.nameText}>{namePart}</Text>{' '}
                  <Text style={{ color: actionColor, fontFamily: 'Manrope_700Bold' }}>{actionLabel}</Text>{' '}
                  <Text style={styles.taskText}>{item.taskTitle}</Text>
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
