import { AppIcon } from '@/components/AppIcon';
import { BulkActionBar } from '@/components/BulkActionBar';
import { Button } from '@/components/Button';
import { CalendarView } from '@/components/CalendarView';
import { EmptyState, ScreenShell, SectionHeader } from '@/components/ScreenShell';
import { DashboardSkeleton } from '@/components/SkeletonLoader';
import { TaskItemRow } from '@/components/TaskItemRow';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { TaskFormSheet } from '@/components/TaskFormSheet';
import { TodayFocusSection } from '@/components/TodayFocusSection';
import { CATEGORIES } from '@/constants/categories';
import { Colors, Radius } from '@/constants/theme';
import { taskToFormValues } from '@/domain/preset';
import { daysUntilDue } from '@/domain/recurrence';
import { canCompleteTask, canSnoozeTask } from '@/domain/task';
import { listHouseholds } from '@/domain/household';
import { useNudge } from '@/hooks/useNudge';
import type { FilterState } from '@/hooks/useFilteredTasks';
import { DEFAULT_FILTER, useFilteredTasks } from '@/hooks/useFilteredTasks';
import { useGroupedTasks } from '@/hooks/useGroupedTasks';
import { useTaskSelection } from '@/hooks/useTaskSelection';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/providers/AuthProvider';
import { useRecommendations } from '@/providers/RecommendationProvider';
import { useTasks } from '@/providers/TaskProvider';
import { useToast } from '@/providers/ToastProvider';
import { useCategories } from '@/hooks/useCategories';
import type { AnyCategoryKey, CategoryKey, TaskGroup } from '@/types';
import type { Recommendation } from '@/types/recommendation';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, StyleSheet, Text, View, TextInput, ScrollView } from 'react-native';
import { Card, ActivityIndicator } from 'react-native-paper';

const SECTION_KEYS: Record<TaskGroup, 'secOverdue' | 'secToday' | 'secWeek' | 'secMonth' | 'secLater'> = {
  overdue: 'secOverdue',
  today: 'secToday',
  week: 'secWeek',
  month: 'secMonth',
  later: 'secLater',
};



export default function HomeScreen() {
  const router = useRouter();
  const { user, activeHousehold } = useAuth();
  const { showToast } = useToast();
  const { handleNudge } = useNudge();
  const {
    tasks,
    loading,
    isOnboardingTasksAdding,
    completeTask: rawCompleteTask,
    snoozeTask,
    skipTask,
    undoSkipTask,
    deleteTask,
    archiveTask,
    pinTask,
    duplicateTask,
    completeTasks,
    snoozeTasks,
    skipTasks,
    undoCompleteTasks: _undoCompleteTasks,
    deleteTasks,
    archiveTasks: _archiveTasks,
    setTaskDueDate,
    updateTask,
    deleteHistoryEntry,
    undoCompleteTask,
    claimTask,
    refreshTasks,
    focusTaskId,
    setFocusTaskId,
  } = useTasks();
  const { language, translate } = useTranslation();
  const { allCategories } = useCategories();

  const { findMatch, logImpression, logClick } = useRecommendations();
  const [completedRecommendation, setCompletedRecommendation] = useState<Recommendation | null>(null);
  const [completedTaskName, setCompletedTaskName] = useState('');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
    if (completedRecommendation) {
      logImpression(completedRecommendation.id);
    }
  }, [completedRecommendation?.id, logImpression]);

  const { selectedIds, toggleSelect, selectAll, clearSelection, isSelecting } = useTaskSelection();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const isSelectingRef = useRef(isSelecting);
  isSelectingRef.current = isSelecting;

  const completeTask = useCallback(
    async (taskId: string, note?: string, options?: { maxEarlyDays?: number }) => {
      const taskObj = tasksRef.current.find((t) => t.id === taskId);
      if (taskObj) {
        setCompletedTaskName(taskObj.title);
        setTimeout(() => {
          const match = findMatch(taskObj);
          if (match) {
            setCompletedRecommendation(match);
          }
        }, 50);
      }
      await rawCompleteTask(taskId, note, options);
    },
    [rawCompleteTask, findMatch]
  );

  const handleTaskRowPress = useCallback(
    (taskId: string) => {
      if (isSelectingRef.current) {
        toggleSelect(taskId);
      } else {
        setSelectedTaskId(taskId);
      }
    },
    [toggleSelect]
  );

  const handleTaskRowLongPress = useCallback(
    (taskId: string) => {
      toggleSelect(taskId);
    },
    [toggleSelect]
  );

  const handleTaskRowComplete = useCallback(
    (taskId: string) => {
      completeTask(taskId);
    },
    [completeTask]
  );

  const handleTaskRowSnooze = useCallback(
    (taskId: string, days?: number) => {
      snoozeTask(taskId, days || 2);
    },
    [snoozeTask]
  );

  const householdMembers = useMemo(() => {
    return activeHousehold?.members ?? user?.householdMembers ?? [];
  }, [activeHousehold?.members, user?.householdMembers]);

  const handleTaskNudge = useCallback(
    (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (target) {
        handleNudge(target);
      }
    },
    [tasks, handleNudge]
  );

  const handleTaskTakeOver = useCallback(
    (taskId: string) => {
      claimTask(taskId);
    },
    [claimTask]
  );

  // Automatically open task when tapped from notification or external focus
  useEffect(() => {
    if (focusTaskId) {
      setSelectedTaskId(focusTaskId);
      setFocusTaskId(null);
    }
  }, [focusTaskId, setFocusTaskId]);

  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [laterExpanded, setLaterExpanded] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const userHouseholds = useMemo(() => listHouseholds(user ?? ({} as any)), [user]);

  const isFiltered =
    filter.group !== 'all' ||
    filter.category !== 'all' ||
    (Boolean(filter.householdId) && filter.householdId !== 'all');

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const editingTask = editingTaskId ? tasks.find((t) => t.id === editingTaskId) ?? null : null;
  const editingInitialValues = useMemo(
    () => (editingTask ? taskToFormValues(editingTask, language) : null),
    [editingTask?.id, editingTask?.updatedAt, language]
  );
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  // Apply search + filter before grouping
  const filteredTasks = useFilteredTasks(tasks, filter);

  const calendarFilteredTasks = useMemo(() => {
    if (!selectedCalendarDate) return filteredTasks;
    return filteredTasks.filter((task) => {
      const isDue = isSameDay(new Date(task.nextDueDate), selectedCalendarDate);
      const isCompleted = task.history.some(
        (h) => h.completedAt && isSameDay(new Date(h.completedAt), selectedCalendarDate)
      );
      return isDue || isCompleted;
    });
  }, [filteredTasks, selectedCalendarDate]);

  const visibleTaskIds = useMemo(
    () => calendarFilteredTasks.map((t) => t.id),
    [calendarFilteredTasks]
  );
  const isAllSelected =
    visibleTaskIds.length > 0 && visibleTaskIds.every((id) => selectedIds.has(id));

  const handleSelectAllToggle = useCallback(() => {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAll(visibleTaskIds);
    }
  }, [isAllSelected, clearSelection, selectAll, visibleTaskIds]);

  const selectedTasks = useMemo(() => {
    return tasks.filter((t) => selectedIds.has(t.id));
  }, [tasks, selectedIds]);

  const completableCount = useMemo(() => {
    return selectedTasks.filter(
      (t) =>
        canCompleteTask(t, {
          maxEarlyDays: 2,
          currentUserId: user?.id,
          currentUserCode: user?.userCode,
        }).allowed
    ).length;
  }, [selectedTasks, user?.id, user?.userCode]);

  const snoozableCount = useMemo(() => {
    return selectedTasks.filter((t) => canSnoozeTask(t).allowed).length;
  }, [selectedTasks]);

  // Pinned tasks shown at top (before groups), only when no active filter query
  // Tasks due today are rendered in Today's Focus, so we avoid rendering them twice
  const pinnedTasks = filter.query.trim() === '' && filter.group === 'all' && filter.category === 'all' && !selectedCalendarDate
    ? tasks.filter((t) => t.pinned && daysUntilDue(t.nextDueDate) !== 0)
    : [];

  // Tasks that go through the group layout (excluding pinned when not filtering)
  const unpinnedFiltered = pinnedTasks.length > 0
    ? calendarFilteredTasks.filter((t) => !t.pinned)
    : calendarFilteredTasks;

  const groups = useGroupedTasks(unpinnedFiltered);

  const isFiltering = filter.query.trim() !== '' || filter.group !== 'all' || filter.category !== 'all' || !!selectedCalendarDate;
  const hasTasks = tasks.length > 0;

  const stats = useMemo(() => {
    let today = 0;
    let overdue = 0;
    let upcoming = 0;
    for (const t of tasks) {
      const d = daysUntilDue(t.nextDueDate);
      if (d < 0) overdue += 1;
      else if (d === 0) today += 1;
      else if (d <= 7) upcoming += 1;
    }
    return { today, overdue, upcoming };
  }, [tasks]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<string, number>> = {};
    for (const t of tasks) {
      if (t.category) {
        counts[t.category] = (counts[t.category] || 0) + 1;
      }
    }
    return counts;
  }, [tasks]);

  const handleAction = async (action: () => Promise<void>) => {
    await action();
    setSelectedTaskId(null);
  };



  const calendarButtonLabel = useMemo(() => {
    const dateToFormat = selectedCalendarDate ?? new Date();
    const monthStr = dateToFormat.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', {
      month: 'short',
    });
    const dateNum = dateToFormat.getDate();
    return language === 'hi' ? `${dateNum} ${monthStr}` : `${monthStr} ${dateNum}`;
  }, [selectedCalendarDate, language]);

  const greetingTitle = useMemo(() => {
    const hour = new Date().getHours();
    if (language === 'hi') {
      const timeHi = hour < 12 ? 'सुप्रभात' : hour < 17 ? 'नमस्ते' : 'शुभ संध्या';
      return `${timeHi}, ${firstName} 👋`;
    }
    const timeEn = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return `${timeEn}, ${firstName} 👋`;
  }, [language, firstName]);

  return (
    <View style={styles.root}>
      <ScreenShell
        title={greetingTitle}
        subtitle={translate('subGreeting')}
        onRefresh={refreshTasks}
        headerExtra={
          hasTasks ? (
            <View style={styles.dailyPulseRow}>
              <Pressable
                style={[
                  styles.pulsePill,
                  stats.overdue > 0 ? styles.pulsePillDanger : styles.pulsePillSuccess,
                  filter.group === 'overdue' && styles.pulsePillActive,
                ]}
                onPress={() => setFilter(prev => ({
                  ...prev,
                  group: prev.group === 'overdue' ? 'all' : 'overdue',
                  category: 'all'
                }))}
              >
                <AppIcon
                  name="warning-outline"
                  size={13}
                  color={stats.overdue > 0 ? '#FF8A75' : '#4ADE80'}
                />
                <Text style={[styles.pulsePillText, { color: filter.group === 'overdue' ? Colors.ink : (stats.overdue > 0 ? '#FF8A75' : '#F3F4F6') }]}>
                  {stats.overdue > 0
                    ? `${stats.overdue} ${language === 'hi' ? 'विलंबित' : 'Overdue'}`
                    : (language === 'hi' ? '0 विलंबित' : '0 Overdue')}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.pulsePill,
                  styles.pulsePillPrimary,
                  filter.group === 'today' && styles.pulsePillActive,
                ]}
                onPress={() => setFilter(prev => ({
                  ...prev,
                  group: prev.group === 'today' ? 'all' : 'today',
                  category: 'all'
                }))}
              >
                <AppIcon name="calendar-outline" size={13} color={filter.group === 'today' ? Colors.tealDeep : '#2DD4BF'} />
                <Text style={[styles.pulsePillText, { color: filter.group === 'today' ? Colors.ink : '#F3F4F6' }]}>
                  {`${stats.today} ${language === 'hi' ? 'आज' : 'Today'}`}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.pulsePill,
                  styles.pulsePillInfo,
                  filter.group === 'upcoming' && styles.pulsePillActive,
                ]}
                onPress={() => setFilter(prev => ({
                  ...prev,
                  group: prev.group === 'upcoming' ? 'all' : 'upcoming',
                  category: 'all'
                }))}
              >
                <AppIcon name="time-outline" size={13} color={filter.group === 'upcoming' ? '#1D4ED8' : '#60A5FA'} />
                <Text style={[styles.pulsePillText, { color: filter.group === 'upcoming' ? Colors.ink : '#F3F4F6' }]}>
                  {`${stats.upcoming} ${language === 'hi' ? 'आगामी' : 'Upcoming'}`}
                </Text>
              </Pressable>
            </View>
          ) : null
        }
      >
        {/* Search & Actions Bar */}
        {hasTasks && (
          <View style={styles.searchActionRow}>
            <View style={styles.searchInputContainer}>
              <AppIcon name="search-outline" size={18} color={Colors.inkFaint} />
              <TextInput
                placeholder={language === 'hi' ? 'खोजें...' : 'Search tasks...'}
                value={filter.query}
                onChangeText={(text) => setFilter(prev => ({ ...prev, query: text }))}
                style={styles.searchInput}
                placeholderTextColor={Colors.inkFaint}
              />
            </View>

            <Pressable
              style={[styles.actionBtnSquare, calendarExpanded && styles.actionBtnActive]}
              onPress={() => setCalendarExpanded((v) => !v)}
            >
              <AppIcon name="calendar-outline" size={18} color={calendarExpanded ? Colors.marigoldDeep : Colors.indigo950} />
              <Text style={[styles.actionBtnSquareText, calendarExpanded && styles.actionBtnActiveText]}>
                {calendarButtonLabel}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.actionBtnRow,
                (isFiltered || filterVisible) && styles.actionBtnActive,
              ]}
              onPress={() => {
                if (isFiltered && !filterVisible) {
                  setFilterVisible(true);
                } else if (isFiltered && filterVisible) {
                  setFilter({ query: '', group: 'all', category: 'all', householdId: 'all' });
                } else {
                  setFilterVisible((v) => !v);
                }
              }}
            >
              <AppIcon
                name="filter-outline"
                size={16}
                color={(isFiltered || filterVisible) ? Colors.marigoldDeep : Colors.indigo950}
              />
              <Text
                style={[
                  styles.actionBtnRowText,
                  (isFiltered || filterVisible) && styles.actionBtnActiveText,
                ]}
              >
                {language === 'hi' ? 'फ़िल्टर' : 'Filters'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Single Permanent Unified Filter Row */}
        {hasTasks && filterVisible && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsScrollContent}
          >
            {/* 1. All Tasks */}
            <Pressable
              style={[
                styles.chipBtn,
                filter.group === 'all' && filter.category === 'all' && (!filter.householdId || filter.householdId === 'all') && styles.chipBtnActive,
              ]}
              onPress={() => setFilter({ query: '', group: 'all', category: 'all', householdId: 'all' })}
            >
              <Text
                style={[
                  styles.chipText,
                  filter.group === 'all' && filter.category === 'all' && (!filter.householdId || filter.householdId === 'all') && styles.chipTextActive,
                ]}
              >
                {language === 'hi' ? `सभी (${tasks.length})` : `All (${tasks.length})`}
              </Text>
            </Pressable>

            {/* 6. Bills */}
            {Boolean(categoryCounts.bills) && (
              <Pressable
                style={[
                  styles.chipBtn,
                  filter.category === 'bills' && styles.chipBtnActive,
                ]}
                onPress={() => setFilter(prev => ({
                  ...prev,
                  category: prev.category === 'bills' ? 'all' : 'bills',
                  group: 'all',
                }))}
              >
                <View style={styles.chipInner}>
                  <Text style={{ fontSize: 12, marginRight: 3 }}>💵</Text>
                  <Text
                    style={[
                      styles.chipText,
                      filter.category === 'bills' && styles.chipTextActive,
                    ]}
                  >
                    {language === 'hi' ? `बिल (${categoryCounts.bills})` : `Bills (${categoryCounts.bills})`}
                  </Text>
                </View>
              </Pressable>
            )}

            {/* 7. Health */}
            {Boolean(categoryCounts.health) && (
              <Pressable
                style={[
                  styles.chipBtn,
                  filter.category === 'health' && styles.chipBtnActive,
                ]}
                onPress={() => setFilter(prev => ({
                  ...prev,
                  category: prev.category === 'health' ? 'all' : 'health',
                  group: 'all',
                }))}
              >
                <View style={styles.chipInner}>
                  <Text style={{ fontSize: 12, marginRight: 3 }}>💖</Text>
                  <Text
                    style={[
                      styles.chipText,
                      filter.category === 'health' && styles.chipTextActive,
                    ]}
                  >
                    {language === 'hi' ? `स्वास्थ्य (${categoryCounts.health})` : `Health (${categoryCounts.health})`}
                  </Text>
                </View>
              </Pressable>
            )}

            {/* 8. Finance */}
            {Boolean(categoryCounts.finance) && (
              <Pressable
                style={[
                  styles.chipBtn,
                  filter.category === 'finance' && styles.chipBtnActive,
                ]}
                onPress={() => setFilter(prev => ({
                  ...prev,
                  category: prev.category === 'finance' ? 'all' : 'finance',
                  group: 'all',
                }))}
              >
                <View style={styles.chipInner}>
                  <Text style={{ fontSize: 12, marginRight: 3 }}>💳</Text>
                  <Text
                    style={[
                      styles.chipText,
                      filter.category === 'finance' && styles.chipTextActive,
                    ]}
                  >
                    {language === 'hi' ? `वित्त (${categoryCounts.finance})` : `Finance (${categoryCounts.finance})`}
                  </Text>
                </View>
              </Pressable>
            )}

            {/* 9. Home */}
            {Boolean(categoryCounts.home) && (
              <Pressable
                style={[
                  styles.chipBtn,
                  filter.category === 'home' && styles.chipBtnActive,
                ]}
                onPress={() => setFilter(prev => ({
                  ...prev,
                  category: prev.category === 'home' ? 'all' : 'home',
                  group: 'all',
                }))}
              >
                <View style={styles.chipInner}>
                  <Text style={{ fontSize: 12, marginRight: 3 }}>🏠</Text>
                  <Text
                    style={[
                      styles.chipText,
                      filter.category === 'home' && styles.chipTextActive,
                    ]}
                  >
                    {language === 'hi' ? `गृहकार्य (${categoryCounts.home})` : `Home (${categoryCounts.home})`}
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Other categories with tasks */}
            {allCategories.filter(c => !['bills', 'health', 'finance', 'home'].includes(c.key) && (categoryCounts[c.key] || 0) > 0).map(cat => (
              <Pressable
                key={cat.key}
                style={[
                  styles.chipBtn,
                  filter.category === cat.key && styles.chipBtnActive,
                ]}
                onPress={() => setFilter(prev => ({
                  ...prev,
                  category: prev.category === cat.key ? 'all' : (cat.key as AnyCategoryKey),
                  group: 'all',
                }))}
              >
                <View style={styles.chipInner}>
                  <Text style={{ fontSize: 12, marginRight: 3 }}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.chipText,
                      filter.category === cat.key && styles.chipTextActive,
                    ]}
                  >
                    {(language === 'hi' ? cat.labelHi : cat.labelEn) + ` (${categoryCounts[cat.key]})`}
                  </Text>
                </View>
              </Pressable>
            ))}

            {/* 10. Household Context Filter */}
            {userHouseholds.length > 0 && (
              <Pressable
                style={[
                  styles.chipBtn,
                  filter.householdId && filter.householdId !== 'all' && styles.chipBtnActive,
                ]}
                onPress={() =>
                  setFilter((prev) => ({
                    ...prev,
                    householdId:
                      prev.householdId === 'all'
                        ? (activeHousehold?.id ?? userHouseholds[0]?.id)
                        : prev.householdId === 'personal'
                        ? 'all'
                        : 'personal',
                  }))
                }
              >
                <View style={styles.chipInner}>
                  <Text style={{ fontSize: 12, marginRight: 3 }}>
                    {filter.householdId === 'personal' ? '👤' : '🏠'}
                  </Text>
                  <Text
                    style={[
                      styles.chipText,
                      filter.householdId && filter.householdId !== 'all' && styles.chipTextActive,
                    ]}
                  >
                    {filter.householdId === 'personal'
                      ? (language === 'hi' ? 'केवल व्यक्तिगत' : 'Personal Only')
                      : filter.householdId && filter.householdId !== 'all'
                      ? (userHouseholds.find((h) => h.id === filter.householdId)?.name ?? (language === 'hi' ? 'घर' : 'Household'))
                      : (language === 'hi' ? 'घर/व्यक्तिगत' : 'Home / All')}
                  </Text>
                </View>
              </Pressable>
            )}

            {/* 11. Clear Filter Chip */}
            {isFiltered && (
              <Pressable
                style={[styles.chipBtn, styles.chipBtnClear]}
                onPress={() => setFilter({ query: '', group: 'all', category: 'all', householdId: 'all' })}
              >
                <View style={styles.chipInner}>
                  <AppIcon name="close" size={13} color={Colors.marigoldDeep} />
                  <Text style={[styles.chipText, { color: Colors.marigoldDeep, marginLeft: 2 }]}>
                    {language === 'hi' ? 'फ़िल्टर हटाएं' : 'Clear'}
                  </Text>
                </View>
              </Pressable>
            )}
          </ScrollView>
        )}

        {/* Calendar View */}
        {hasTasks && calendarExpanded && (
          <CalendarView
            tasks={tasks}
            selectedDate={selectedCalendarDate}
            onSelectDate={setSelectedCalendarDate}
            language={language}
          />
        )}

        {selectedCalendarDate && (
          <View style={styles.filterChipRow}>
            <Text style={styles.filterChipText}>
              {language === 'hi'
                ? `फ़िल्टर की गई तारीख: ${selectedCalendarDate.toLocaleDateString()}`
                : `Filtered Date: ${selectedCalendarDate.toLocaleDateString()}`}
            </Text>
            <Pressable onPress={() => setSelectedCalendarDate(null)} style={styles.clearFilterBtn}>
              <Text style={styles.clearFilterBtnText}>✕</Text>
            </Pressable>
          </View>
        )}

        {isOnboardingTasksAdding ? (
          <Card style={styles.onboardingAddingCard} mode="elevated" testID="homescreen-adding-presets-card">
            <View style={styles.onboardingAddingInner}>
              <View style={styles.onboardingAddingIconCircle}>
                <AppIcon name="sparkles" size={30} color={Colors.marigoldDeep} />
              </View>
              <Text style={styles.onboardingAddingTitle}>
                {translate('addingOnboardingTasks')}
              </Text>
              <Text style={styles.onboardingAddingSub}>
                {translate('addingOnboardingTasksSub')}
              </Text>
              <ActivityIndicator size="small" color={Colors.marigoldDeep} style={{ marginTop: 16 }} />
            </View>
          </Card>
        ) : loading && !hasTasks ? (
          <DashboardSkeleton />
        ) : !hasTasks ? (
          <EmptyState
            icon="📋"
            title={translate('homeEmptyTitle')}
            subtitle={translate('homeEmptySub')}
            action={<Button title={translate('addFirstTask')} onPress={() => router.push('/(tabs)/add')} />}
          />
        ) : isFiltering && calendarFilteredTasks.length === 0 ? (
          <EmptyState
            icon="🔍"
            title={language === 'hi' ? 'कोई परिणाम नहीं' : 'No results'}
            subtitle={language === 'hi' ? 'फ़िल्टर बदलें' : 'Try adjusting your filters'}
          />
        ) : (
          <>
            {/* Today's Focus & Activity Section (Pending + Completed Today) */}
            {!isFiltering && (
              <TodayFocusSection
                tasks={tasks}
                language={language}
                onSelectTask={handleTaskRowPress}
                onCompleteTask={handleTaskRowComplete}
                onSnoozeTask={handleTaskRowSnooze}
                onToggleSelect={handleTaskRowLongPress}
                selectedIds={selectedIds}
                isSelecting={isSelecting}
                currentUserId={user?.id}
                currentUserCode={user?.userCode}
                householdMembers={householdMembers}
                onTakeOver={handleTaskTakeOver}
                onNudge={handleTaskNudge}
              />
            )}

            {/* Pinned section */}
            {pinnedTasks.length > 0 && (
              <View>
                <SectionHeader label={language === 'hi' ? 'पिन किए गए' : 'Pinned'} count={pinnedTasks.length} />
                {pinnedTasks.map((task) => {
                  const isItemSelected = selectedIds.has(task.id);
                  const canComplete = canCompleteTask(task, {
                    maxEarlyDays: 0,
                    currentUserId: user?.id,
                    currentUserCode: user?.userCode,
                  }).allowed;
                  const canSnooze = canSnoozeTask(task).allowed;
                  return (
                    <TaskItemRow
                      key={`pinned-task-${task.id}`}
                      task={task}
                      language={language}
                      selected={isItemSelected}
                      selectionMode={isSelecting}
                      canComplete={canComplete}
                      canSnooze={canSnooze}
                      currentUserId={user?.id}
                      currentUserCode={user?.userCode}
                      householdMembers={householdMembers}
                      onPress={handleTaskRowPress}
                      onLongPress={handleTaskRowLongPress}
                      onComplete={handleTaskRowComplete}
                      onSnooze={handleTaskRowSnooze}
                      onTakeOver={handleTaskTakeOver}
                      onNudge={handleTaskNudge}
                    />
                  );
                })}
              </View>
            )}

            {/* Grouped tasks (skips 'today' when TodayFocusSection is active) */}
            {groups.map(({ group, items }) => {
              if (items.length === 0 || (!isFiltering && group === 'today')) return null;

              const isLaterGroup = group === 'later';
              const showItems = !isLaterGroup || isFiltering || laterExpanded;

              return (
                <View key={group}>
                  {isLaterGroup && !isFiltering ? (
                    <Pressable
                      onPress={() => setLaterExpanded((v) => !v)}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 }}
                    >
                      <SectionHeader
                        label={translate(SECTION_KEYS[group])}
                        count={items.length}
                        accent="default"
                      />
                      <AppIcon
                        name={laterExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                        size={18}
                        color={Colors.inkFaint}
                      />
                    </Pressable>
                  ) : (
                    <SectionHeader
                      label={translate(SECTION_KEYS[group])}
                      count={items.length}
                      accent={group === 'overdue' ? 'danger' : 'default'}
                    />
                  )}
                  {showItems && items.map((task) => {
                    const isItemSelected = selectedIds.has(task.id);
                    const canComplete = canCompleteTask(task, {
                      maxEarlyDays: 0,
                      currentUserId: user?.id,
                      currentUserCode: user?.userCode,
                    }).allowed;
                    const canSnooze = canSnoozeTask(task).allowed;
                    return (
                      <TaskItemRow
                        key={`group-task-${task.id}`}
                        task={task}
                        language={language}
                        selected={isItemSelected}
                        selectionMode={isSelecting}
                        canComplete={canComplete}
                        canSnooze={canSnooze}
                        currentUserId={user?.id}
                        currentUserCode={user?.userCode}
                        householdMembers={householdMembers}
                        onPress={handleTaskRowPress}
                        onLongPress={handleTaskRowLongPress}
                        onComplete={handleTaskRowComplete}
                        onSnooze={handleTaskRowSnooze}
                        onTakeOver={handleTaskTakeOver}
                        onNudge={handleTaskNudge}
                      />
                    );
                  })}
                </View>
              );
            })}
          </>
        )}
      </ScreenShell>

      {/* Bulk actions bar */}
      {isSelecting && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={visibleTaskIds.length}
          completableCount={completableCount}
          snoozableCount={snoozableCount}
          isAllSelected={isAllSelected}
          onSelectAll={handleSelectAllToggle}
          onClear={clearSelection}
          onComplete={async () => {
            const eligible = selectedTasks
              .filter(
                (t) =>
                  canCompleteTask(t, {
                    maxEarlyDays: 2,
                    currentUserId: user?.id,
                    currentUserCode: user?.userCode,
                  }).allowed
              )
              .map((t) => t.id);
            if (eligible.length > 0) {
              await completeTasks(eligible, { maxEarlyDays: 2 });
            }
            clearSelection();
          }}
          onSnooze={async () => {
            const eligible = selectedTasks
              .filter((t) => canSnoozeTask(t).allowed)
              .map((t) => t.id);
            if (eligible.length > 0) {
              await snoozeTasks(eligible);
            }
            clearSelection();
          }}
          onDisabledComplete={() => {
            showToast(
              language === 'hi'
                ? 'केवल आज, बकाया या अगले 2 दिनों के कार्य ही पूरे किए जा सकते हैं'
                : 'Only tasks due today, overdue, or due within 2 days can be marked Done'
            );
          }}
          onDisabledSnooze={() => {
            showToast(
              language === 'hi'
                ? 'केवल इस सप्ताह के कार्य ही सणूज़ किए जा सकते हैं'
                : 'Only tasks due this week can be snoozed'
            );
          }}
          onSkip={async () => {
            await skipTasks(Array.from(selectedIds));
            clearSelection();
          }}
          onDelete={() => {
            const count = selectedIds.size;
            Alert.alert(
              language === 'hi' ? 'कार्य हटाएं' : 'Delete Tasks',
              language === 'hi'
                ? `क्या आप वाकई ${count} चुने गए कार्यों को हटाना चाहते हैं?`
                : `Are you sure you want to delete ${count} selected ${count === 1 ? 'task' : 'tasks'}?`,
              [
                { text: language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
                {
                  text: language === 'hi' ? 'हटाएं' : 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteTasks(Array.from(selectedIds));
                    clearSelection();
                  },
                },
              ]
            );
          }}
          language={language}
        />
      )}

      {Boolean(selectedTask) && (
        <TaskDetailSheet
          task={selectedTask}
          visible={!!selectedTask}
          language={language}
          translate={translate}
          onClose={() => setSelectedTaskId(null)}
          onComplete={(id, note, options) => handleAction(() => completeTask(id, note, options))}
          onSnooze={(id, days) => handleAction(() => snoozeTask(id, days))}
          onSkip={(id) => handleAction(() => skipTask(id))}
          onUndoSkip={(id) => handleAction(() => undoSkipTask(id))}
          onUndoComplete={(id) => handleAction(() => undoCompleteTask(id))}
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
              handleNudge(t);
            }
          }}
        />
      )}

      {Boolean(editingTask) && (
        <TaskFormSheet
          visible={!!editingTask}
          language={language}
          translate={translate}
          heading={translate('editTask')}
          initial={editingInitialValues}
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
      )}

      {/* Celebration & Recommendation Modal */}
      <Modal
        visible={completedRecommendation !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCompletedRecommendation(null)}
      >
        <View style={styles.celebrationBackdrop}>
          <Card style={styles.celebrationCard} mode="elevated">
            <Card.Content style={styles.celebrationContent}>
              <View style={styles.checkCircle}>
                <Text style={{ fontSize: 28, color: Colors.white }}>✓</Text>
              </View>
              <Text style={styles.celebrationTitle}>
                {language === 'hi' ? 'शानदार काम!' : 'Task Completed!'}
              </Text>
              <Text style={styles.celebrationSub}>
                {language === 'hi'
                  ? `आपने "${completedTaskName}" को पूरा कर लिया है।`
                  : `You've checked off "${completedTaskName}".`}
              </Text>

              {completedRecommendation && (
                <View style={styles.celebrationPromoBox}>
                  <Text style={styles.promoLabel}>
                    {language === 'hi' ? 'विशेष सुझाव आपके लिए:' : 'Special Suggestion for You:'}
                  </Text>
                  <Card style={styles.innerPromoCard} mode="outlined">
                    <Card.Content style={styles.innerPromoContent}>
                      <Image
                        source={{ uri: imageError || !completedRecommendation.imageUrl ? 'https://picsum.photos/200' : completedRecommendation.imageUrl }}
                        style={styles.innerPromoImage}
                        resizeMode="cover"
                        onError={() => setImageError(true)}
                      />
                      <View style={styles.innerPromoText}>
                        <Text style={styles.innerPromoTitle}>{completedRecommendation.title}</Text>
                        <Text style={styles.innerPromoDesc} numberOfLines={2}>
                          {completedRecommendation.description}
                        </Text>
                        {completedRecommendation.promoCode ? (
                          <View style={styles.promoCodeBadge}>
                            <Text style={styles.promoCodeText}>
                              {language === 'hi'
                                ? `कोड: ${completedRecommendation.promoCode}`
                                : `CODE: ${completedRecommendation.promoCode}`}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </Card.Content>
                  </Card>
                  <Button
                    title={completedRecommendation.buttonText || (language === 'hi' ? 'लाभ उठाएं' : 'Claim Offer')}
                    onPress={async () => {
                      const rec = completedRecommendation;
                      setCompletedRecommendation(null);
                      await logClick(rec.id);
                      Linking.openURL(rec.redirectUrl).catch(() => { });
                    }}
                    style={styles.claimBtn}
                  />
                </View>
              )}

              <Button
                title={language === 'hi' ? 'बंद करें' : 'Done'}
                onPress={() => setCompletedRecommendation(null)}
                variant="ghost"
                style={styles.closeCelebrationBtn}
              />
            </Card.Content>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerExtraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 8,
  },
  statsRow: { flexDirection: 'row', gap: 10, flex: 1 },
  searchIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(251,247,239,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251,247,239,0.15)',
  },
  searchIconBtnActive: {
    backgroundColor: 'rgba(232,163,61,0.18)',
    borderColor: Colors.marigold,
  },
  dayDateCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(251,247,239,0.22)',
    width: 50,
    height: 50,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayDateCardActive: {
    borderColor: Colors.marigold,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.5,
  },
  miniCalHeader: {
    backgroundColor: 'rgba(193, 80, 46, 0.28)',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(251,247,239,0.15)',
  },
  miniCalHeaderLabel: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 8,
    color: '#FFB89A',
    letterSpacing: 0.5,
    lineHeight: 10,
  },
  miniCalBody: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  miniCalValue: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 16.5,
    color: Colors.white,
    lineHeight: 18,
  },
  miniCalSub: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 7.5,
    color: Colors.onDarkMuted,
    letterSpacing: 0.2,
    marginTop: -1,
    lineHeight: 9,
  },
  filterActiveDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.marigold,
    borderWidth: 1.5,
    borderColor: Colors.indigo950,
  },
  greetingContainer: {
    marginTop: 8,
    marginBottom: 6,
  },
  dailyPulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  pulsePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  pulsePillDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderColor: 'rgba(248, 113, 113, 0.45)',
  },
  pulsePillSuccess: {
    backgroundColor: 'rgba(20, 184, 166, 0.22)',
    borderColor: 'rgba(45, 212, 191, 0.4)',
  },
  pulsePillPrimary: {
    backgroundColor: 'rgba(20, 184, 166, 0.22)',
    borderColor: 'rgba(45, 212, 191, 0.4)',
  },
  pulsePillInfo: {
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    borderColor: 'rgba(96, 165, 250, 0.4)',
  },
  pulsePillActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.marigold,
  },
  pulsePillText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
  },
  greetingText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 32,
    color: Colors.white,
    lineHeight: 38,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 32,
    color: Colors.marigold,
    lineHeight: 38,
  },
  emojiText: {
    fontSize: 28,
  },
  filterChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.ivoryDim,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    marginBottom: 12,
  },
  filterChipText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.indigo950,
  },
  clearFilterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearFilterBtnText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 14,
    color: Colors.clayDeep,
  },
  calendarToggleContainer: {
    marginBottom: 12,
  },
  calendarToggleCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    elevation: 1.5,
  },
  calendarToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  calendarToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarToggleText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13.5,
    color: Colors.indigo950,
  },
  celebrationBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    backgroundColor: Colors.white,
    elevation: 6,
  },
  celebrationContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  celebrationTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: Colors.indigo950,
    textAlign: 'center',
  },
  celebrationSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  celebrationPromoBox: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryLine,
    paddingTop: 16,
    marginBottom: 12,
  },
  promoLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  innerPromoCard: {
    backgroundColor: '#FFFBF3',
    borderColor: '#E8A33D30',
    borderRadius: Radius.sm,
    marginBottom: 12,
  },
  innerPromoContent: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  innerPromoImage: {
    width: 64,
    height: 64,
    borderRadius: Radius.xs,
    flexShrink: 0,
  },
  innerPromoText: {
    flex: 1,
    justifyContent: 'center',
  },
  innerPromoTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 13.5,
    color: Colors.indigo950,
  },
  innerPromoDesc: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 10.5,
    color: Colors.inkSoft,
    marginTop: 3,
    lineHeight: 14,
  },
  promoCodeBadge: {
    backgroundColor: '#E8A33D15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  promoCodeText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 8.5,
    color: Colors.marigoldDeep,
  },
  claimBtn: {
    width: '100%',
  },
  closeCelebrationBtn: {
    marginTop: 6,
    width: '100%',
  },

  // Mockup Horizontal Stats Cards Row
  homeStatCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    elevation: 1,
    overflow: 'hidden',
  },
  homeStatContent: {
    padding: 8,
  },
  homeStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  homeStatIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeStatLabel: {
    fontSize: 10.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkSoft,
    flex: 1,
  },
  homeStatBody: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginVertical: 1,
  },
  homeStatCount: {
    fontSize: 20,
    fontFamily: 'Fraunces_700Bold',
    color: Colors.ink,
    lineHeight: 24,
  },
  homeStatCountLabel: {
    fontSize: 9.5,
    fontFamily: 'Manrope_500Medium',
    color: Colors.inkSoft,
  },
  homeStatFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  homeStatLink: {
    fontSize: 10.5,
    fontFamily: 'Manrope_800ExtraBold',
  },

  // Mockup Search & Actions row
  searchActionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 14,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    borderWidth: 1.2,
    borderColor: Colors.ivoryLine,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 42,
    marginLeft: 6,
    fontSize: 13.5,
    fontFamily: 'Manrope_500Medium',
    color: Colors.ink,
    padding: 0,
  },
  actionBtnSquare: {
    width: 52,
    height: 42,
    borderRadius: Radius.sm,
    borderWidth: 1.2,
    borderColor: Colors.ivoryLine,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  actionBtnSquareText: {
    fontSize: 8.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkFaint,
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: Radius.sm,
    borderWidth: 1.2,
    borderColor: Colors.ivoryLine,
    backgroundColor: Colors.white,
    gap: 4,
  },
  actionBtnRowText: {
    fontSize: 12.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
  },
  actionBtnActive: {
    borderColor: Colors.marigoldDeep,
    backgroundColor: 'rgba(232,163,61,0.06)',
  },
  actionBtnActiveText: {
    color: Colors.marigoldDeep,
  },

  // Mockup scrollable chips
  chipsScroll: {
    marginBottom: 12,
  },
  chipsScrollContent: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  chipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: Colors.ivoryLine,
  },
  chipBtnActive: {
    backgroundColor: Colors.indigo950,
    borderColor: Colors.indigo950,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
  },
  chipTextActive: {
    color: Colors.white,
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipDivider: {
    width: 1,
    height: 18,
    backgroundColor: Colors.ivoryLine,
    marginHorizontal: 3,
    alignSelf: 'center',
  },
  chipBtnDanger: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  chipBtnDangerActive: {
    borderColor: '#DC2626',
    backgroundColor: '#DC2626',
  },
  chipBtnClear: {
    borderColor: Colors.marigold,
    backgroundColor: 'rgba(232,163,61,0.1)',
  },
  onboardingAddingCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    marginVertical: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(232,163,61,0.25)',
    elevation: 3,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  onboardingAddingInner: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  onboardingAddingIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF8EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  onboardingAddingTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 19,
    color: Colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  onboardingAddingSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13.5,
    color: Colors.inkSoft,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
});
