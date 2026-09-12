import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import type { Language, RepeatingTask, CategoryKey } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { Colors, Radius } from '@/constants/theme';
import { daysUntilDue } from '@/domain/recurrence';
import { hasCompletedToday } from '@/domain/task';
import { TaskCard } from '@/components/TaskCard';
import { SwipeableTaskItem } from '@/components/SwipeableTaskItem';
import { AppIcon } from '@/components/AppIcon';

interface TodayFocusSectionProps {
  tasks: RepeatingTask[];
  language: Language;
  onSelectTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onSnoozeTask?: (taskId: string, days?: number) => void;
  onToggleSelect?: (taskId: string) => void;
  selectedIds?: Set<string>;
  isSelecting?: boolean;
}

export function TodayFocusSection({
  tasks,
  language,
  onSelectTask,
  onCompleteTask,
  onSnoozeTask,
  onToggleSelect,
  selectedIds,
  isSelecting,
}: TodayFocusSectionProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [collapsed, setCollapsed] = useState(false);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  // Pending tasks needing focus today (strictly due today and not yet completed today)
  const pendingTodayTasks = useMemo(() => {
    return tasks.filter((t) => daysUntilDue(t.nextDueDate) === 0 && !hasCompletedToday(t));
  }, [tasks]);

  // Tasks completed today from task.history
  const completedTodayEntries = useMemo(() => {
    const today = new Date();
    const list: {
      task: RepeatingTask;
      completedAt: string;
      note?: string;
      historyIndex: number;
    }[] = [];

    for (const t of tasks) {
      t.history.forEach((h, idx) => {
        if (
          h.completedAt &&
          (h.status === 'on_time' || h.status === 'late') &&
          isSameDay(new Date(h.completedAt), today)
        ) {
          list.push({
            task: t,
            completedAt: h.completedAt,
            note: h.note,
            historyIndex: idx,
          });
        }
      });
    }
    return list;
  }, [tasks]);

  const pendingCount = pendingTodayTasks.length;
  const completedCount = completedTodayEntries.length;
  const totalTodayCount = pendingCount + completedCount;

  const completionPercent = totalTodayCount > 0 
    ? Math.round((completedCount / totalTodayCount) * 100) 
    : 0;

  // Items to display based on selected tab
  const itemsToDisplay = useMemo(() => {
    if (activeTab === 'pending') {
      return pendingTodayTasks.map((t) => ({ type: 'pending' as const, task: t, historyIndex: undefined }));
    }
    if (activeTab === 'completed') {
      return completedTodayEntries.map((e) => ({
        type: 'completed' as const,
        task: e.task,
        completedAt: e.completedAt,
        note: e.note,
        historyIndex: e.historyIndex,
      }));
    }
    // 'all' tab shows pending first, then completed today
    return [
      ...pendingTodayTasks.map((t) => ({ type: 'pending' as const, task: t, historyIndex: undefined })),
      ...completedTodayEntries.map((e) => ({
        type: 'completed' as const,
        task: e.task,
        completedAt: e.completedAt,
        note: e.note,
        historyIndex: e.historyIndex,
      })),
    ];
  }, [activeTab, pendingTodayTasks, completedTodayEntries]);

  if (totalTodayCount === 0) {
    return null; // No today tasks pending or completed
  }

  // When all today tasks are finished and collapsed, render compact celebration pill
  if (pendingCount === 0 && completedCount > 0 && collapsed) {
    return (
      <View style={styles.celebrationCard}>
        <TouchableRipple style={styles.celebrationRipple} onPress={() => setCollapsed(false)} borderless>
          <View style={styles.celebrationRow}>
            <View style={styles.celebrationLeft}>
              <Text style={styles.celebrationEmoji}>🎉</Text>
              <View style={styles.celebrationTextCol}>
                <Text style={styles.celebrationTitle}>
                  {language === 'hi' ? 'आज के सभी कार्य पूरे हुए!' : "All today's tasks completed!"}
                </Text>
                <Text style={styles.celebrationSub}>
                  {language === 'hi'
                    ? `${completedCount} कार्य संपन्न • विवरण देखें`
                    : `${completedCount} ${completedCount === 1 ? 'task' : 'tasks'} done today • Tap to view activity`}
                </Text>
              </View>
            </View>
            <View style={styles.expandPill}>
              <AppIcon name="chevron-down-outline" size={14} color={Colors.tealDeep} />
            </View>
          </View>
        </TouchableRipple>
      </View>
    );
  }

  return (
    <View style={styles.todayCard}>
      {/* 1. Header Banner & Daily Progress Bar */}
      <View style={styles.headerBlock}>
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={styles.headerEmoji}>☀️</Text>
            <Text style={styles.headerTitle}>
              {language === 'hi' ? 'आज के कार्य एवं प्रगति' : "Today's Focus & Activity"}
            </Text>
          </View>
          <View style={styles.headerRightRow}>
            <View style={styles.percentBadge}>
              <Text style={styles.percentText}>{completionPercent}%</Text>
            </View>
            {pendingCount === 0 && completedCount > 0 && (
              <Pressable style={styles.collapseBtn} onPress={() => setCollapsed(true)}>
                <AppIcon name="chevron-up-outline" size={16} color={Colors.inkSoft} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completionPercent}%` }]} />
        </View>

        <Text style={styles.progressSubText}>
          {language === 'hi'
            ? `${totalTodayCount} में से ${completedCount} कार्य पूरे हुए (${pendingCount} शेष)`
            : `${completedCount} of ${totalTodayCount} tasks completed (${pendingCount} pending)`}
        </Text>

        {/* 2. Filter Segment Tabs */}
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              {language === 'hi' ? `सभी (${totalTodayCount})` : `All (${totalTodayCount})`}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
              {language === 'hi' ? `लंबित (${pendingCount})` : `Pending (${pendingCount})`}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabBtn, activeTab === 'completed' && styles.tabBtnActive]}
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
              {language === 'hi' ? `पूर्ण (${completedCount})` : `Completed (${completedCount})`}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 3. Task Items List */}
      <View style={styles.listBlock}>
        {itemsToDisplay.map((item, idx) => {
          if (item.type === 'pending') {
            const isSelected = selectedIds?.has(item.task.id);
            return (
              <SwipeableTaskItem
                key={`pending-swipe-${item.task.id}-${idx}`}
                language={language}
                enabled={!isSelecting}
                onComplete={() => onCompleteTask(item.task.id)}
                onSnooze={(days) => onSnoozeTask?.(item.task.id, days)}
              >
                <TaskCard
                  task={item.task}
                  language={language}
                  selected={isSelected}
                  style={{ marginBottom: 0 }}
                  onPress={() => {
                    if (isSelecting && onToggleSelect) {
                      onToggleSelect(item.task.id);
                    } else {
                      onSelectTask(item.task.id);
                    }
                  }}
                  onLongPress={() => onToggleSelect?.(item.task.id)}
                  onCompletePress={isSelecting ? undefined : () => onCompleteTask(item.task.id)}
                />
              </SwipeableTaskItem>
            );
          }

          // Completed Task Card
          const cat = CATEGORY_MAP[item.task.category as CategoryKey] || CATEGORY_MAP['home'] || { icon: '📋' };
          const completedTimeStr = new Date(item.completedAt).toLocaleTimeString(
            language === 'hi' ? 'hi-IN' : 'en-US',
            { hour: '2-digit', minute: '2-digit' }
          );

          return (
            <View
              key={`completed-${item.task.id}-${idx}`}
              style={styles.completedCard}
            >
              <TouchableRipple style={styles.completedRipple} onPress={() => onSelectTask(item.task.id)} borderless>
                <View style={styles.completedContent}>
                  {/* Left Faded Icon Badge: neutral/subtle circle instead of loud green */}
                  <View style={styles.fadedIconBadge}>
                    <AppIcon name="checkmark" size={13} color={Colors.inkFaint} />
                  </View>

                  {/* Body Text */}
                  <View style={styles.completedTextCol}>
                    <View style={styles.completedTitleRow}>
                      <Text style={styles.completedEmoji}>{cat.icon}</Text>
                      <Text style={styles.completedTitle} numberOfLines={1}>
                        {item.task.title}
                      </Text>
                    </View>

                    <Text style={styles.completedTimeText}>
                      {language === 'hi'
                        ? `आज ${completedTimeStr} बजे पूर्ण हुआ`
                        : `Completed today at ${completedTimeStr}`}
                    </Text>

                    {item.note ? (
                      <Text style={styles.completedNoteText} numberOfLines={1}>
                        📝 {item.note}
                      </Text>
                    ) : null}
                  </View>

                  {/* Status Badge */}
                  <View style={styles.doneBadge}>
                    <Text style={styles.doneBadgeText}>
                      {language === 'hi' ? 'संपन्न' : 'Done'}
                    </Text>
                  </View>
                </View>
              </TouchableRipple>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  todayCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 1,
    overflow: 'hidden',
  },
  headerBlock: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
    backgroundColor: 'rgba(62, 124, 106, 0.03)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerEmoji: { fontSize: 20 },
  headerTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 16,
    color: Colors.ink,
  },
  percentBadge: {
    backgroundColor: Colors.tealDeep,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
  },
  percentText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 12,
    color: Colors.white,
  },

  // Progress Bar Track & Fill
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.ivoryLine,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.tealDeep,
    borderRadius: 4,
  },
  progressSubText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11.5,
    color: Colors.inkSoft,
    marginBottom: 12,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    padding: 3,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: Radius.xs,
  },
  tabBtnActive: {
    backgroundColor: Colors.white,
    elevation: 0.5,
  },
  tabText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  tabTextActive: {
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.tealDeep,
  },

  // List Block
  listBlock: {
    padding: 12,
    gap: 10,
  },

  // Completed Task Card Styles
  completedCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    overflow: 'hidden',
  },
  completedRipple: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  completedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fadedIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9', // Soft subtle slate 100
    borderWidth: 1.5,
    borderColor: '#E2E8F0', // Slate 200 border
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedTextCol: {
    flex: 1,
    gap: 2,
  },
  completedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedEmoji: { fontSize: 14 },
  completedTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13.5,
    color: Colors.inkSoft,
    textDecorationLine: 'line-through',
    flex: 1,
  },
  completedTimeText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkSoft,
  },
  completedNoteText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkSoft,
    fontStyle: 'italic',
  },
  doneBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  doneBadgeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10.5,
    color: '#059669',
  },

  // Celebration Collapsed Styles
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapseBtn: {
    padding: 4,
  },
  celebrationCard: {
    backgroundColor: 'rgba(62, 124, 106, 0.08)',
    borderRadius: Radius.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(62, 124, 106, 0.22)',
    elevation: 0.5,
    overflow: 'hidden',
  },
  celebrationRipple: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  celebrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  celebrationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  celebrationEmoji: { fontSize: 20 },
  celebrationTextCol: { flex: 1, gap: 1 },
  celebrationTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 14,
    color: Colors.tealDeep,
  },
  celebrationSub: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  expandPill: {
    backgroundColor: 'rgba(62, 124, 106, 0.12)',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
