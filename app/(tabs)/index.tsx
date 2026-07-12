import { AppIcon } from '@/components/AppIcon';
import { BulkActionBar } from '@/components/BulkActionBar';
import { Button } from '@/components/Button';
import { CalendarView } from '@/components/CalendarView';
import { EmptyState, ScreenShell, SectionHeader, StatPill } from '@/components/ScreenShell';
import { DashboardSkeleton } from '@/components/SkeletonLoader';
import { TaskCard } from '@/components/TaskCard';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import { TaskFormSheet } from '@/components/TaskFormSheet';
import { Colors, Radius } from '@/constants/theme';
import { taskToFormValues } from '@/domain/preset';
import { daysUntilDue } from '@/domain/recurrence';
import type { FilterState } from '@/hooks/useFilteredTasks';
import { DEFAULT_FILTER, useFilteredTasks } from '@/hooks/useFilteredTasks';
import { useGroupedTasks } from '@/hooks/useGroupedTasks';
import { useTaskSelection } from '@/hooks/useTaskSelection';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/providers/AuthProvider';
import { useRecommendations } from '@/providers/RecommendationProvider';
import { useTasks } from '@/providers/TaskProvider';
import type { TaskGroup } from '@/types';
import type { Recommendation } from '@/types/recommendation';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from 'react-native-paper';

const SECTION_KEYS: Record<TaskGroup, 'secOverdue' | 'secToday' | 'secWeek' | 'secMonth'> = {
  overdue: 'secOverdue',
  today: 'secToday',
  week: 'secWeek',
  month: 'secMonth',
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    tasks,
    loading,
    completeTask: rawCompleteTask,
    snoozeTask,
    skipTask,
    deleteTask,
    archiveTask,
    pinTask,
    duplicateTask,
    completeTasks,
    snoozeTasks,
    deleteTasks,
    archiveTasks,
    setTaskDueDate,
    updateTask,
    deleteHistoryEntry,
  } = useTasks();
  const { language, translate } = useTranslation();

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

  const completeTask = useCallback(
    async (taskId: string, note?: string) => {
      const taskObj = tasks.find((t) => t.id === taskId);
      if (taskObj) {
        setCompletedTaskName(taskObj.title);
        const match = findMatch(taskObj);
        if (match) {
          setCompletedRecommendation(match);
        }
      }
      await rawCompleteTask(taskId, note);
    },
    [tasks, rawCompleteTask, findMatch]
  );
  const { selectedIds, toggleSelect, clearSelection, isSelecting } = useTaskSelection();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const editingTask = editingTaskId ? tasks.find((t) => t.id === editingTaskId) ?? null : null;
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

  // Pinned tasks shown at top (before groups), only when no active filter query
  const pinnedTasks = filter.query.trim() === '' && filter.group === 'all' && filter.category === 'all' && !selectedCalendarDate
    ? tasks.filter((t) => t.pinned)
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
    for (const t of tasks) {
      const d = daysUntilDue(t.nextDueDate);
      if (d < 0) overdue += 1;
      else if (d === 0) today += 1;
    }
    return { today, overdue };
  }, [tasks]);

  const handleAction = async (action: () => Promise<void>) => {
    await action();
    setSelectedTaskId(null);
  };

  const { currentDayLabel, currentDateValue, currentWeekdayLabel } = useMemo(() => {
    const dateToFormat = selectedCalendarDate ?? new Date();
    const day = dateToFormat.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', {
      weekday: 'short',
    });
    const dateNum = dateToFormat.getDate();
    const month = dateToFormat.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', {
      month: 'short',
    });
    return {
      currentDayLabel: month.toUpperCase(),
      currentDateValue: String(dateNum),
      currentWeekdayLabel: day.toUpperCase(),
    };
  }, [selectedCalendarDate, language]);

  const greetingTitle = `Good morning, ${firstName} 👋`;

  const searchButton = (
    <Pressable
      style={[styles.searchIconBtn, filterVisible && styles.searchIconBtnActive]}
      onPress={() => {
        setFilterVisible((v) => !v);
        if (filterVisible) setFilter(DEFAULT_FILTER);
      }}
      hitSlop={8}
    >
      <AppIcon
        name={filterVisible ? 'close' : 'search-outline'}
        size={20}
        color={filterVisible ? Colors.marigold : Colors.onDarkMuted}
      />
      {isFiltering && !filterVisible && (
        <View style={styles.filterActiveDot} />
      )}
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <ScreenShell
        title={greetingTitle}
        subtitle={translate('subGreeting')}
        headerExtra={
          hasTasks ? (
            <View style={styles.headerExtraRow}>
              <View style={styles.statsRow}>
                <StatPill label={translate('secToday')} value={String(stats.today)} />
                <StatPill
                  label={translate('secOverdue')}
                  value={String(stats.overdue)}
                  tone={stats.overdue > 0 ? 'warn' : 'default'}
                />
              </View>
              <Pressable
                style={[styles.dayDateCard, calendarExpanded && styles.dayDateCardActive]}
                onPress={() => setCalendarExpanded((v) => !v)}
              >
                <View style={styles.miniCalHeader}>
                  <Text style={styles.miniCalHeaderLabel}>{currentDayLabel}</Text>
                </View>
                <View style={styles.miniCalBody}>
                  <Text style={styles.miniCalValue}>{currentDateValue}</Text>
                  <Text style={styles.miniCalSub}>{currentWeekdayLabel}</Text>
                </View>
              </Pressable>
              {searchButton}
            </View>
          ) : null
        }
      >
        {/* Filter bar */}
        {filterVisible && (
          <TaskFilterBar
            filter={filter}
            onChange={setFilter}
            language={language}
          />
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

        {loading && !hasTasks ? (
          <DashboardSkeleton />
        ) : !hasTasks ? (
          <EmptyState
            icon="📋"
            title={translate('homeEmptyTitle')}
            subtitle={translate('homeEmptySub')}
            action={<Button title={translate('addFirstTask')} onPress={() => router.push('/(tabs)/add')} />}
          />
        ) : isFiltering && filteredTasks.length === 0 ? (
          <EmptyState
            icon="🔍"
            title={language === 'hi' ? 'कोई परिणाम नहीं' : 'No results'}
            subtitle={language === 'hi' ? 'फ़िल्टर बदलें' : 'Try adjusting your filters'}
          />
        ) : (
          <>
            {/* Pinned section */}
            {pinnedTasks.length > 0 && (
              <View>
                <SectionHeader label={language === 'hi' ? 'पिन किए गए' : 'Pinned'} count={pinnedTasks.length} />
                {pinnedTasks.map((task) => {
                  const isItemSelected = selectedIds.has(task.id);
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      language={language}
                      selected={isItemSelected}
                      onPress={() => {
                        if (isSelecting) {
                          toggleSelect(task.id);
                        } else {
                          setSelectedTaskId(task.id);
                        }
                      }}
                      onLongPress={() => toggleSelect(task.id)}
                      onCompletePress={isSelecting ? undefined : () => completeTask(task.id)}
                    />
                  );
                })}
              </View>
            )}

            {/* Grouped tasks */}
            {groups.map(({ group, items }) =>
              items.length === 0 ? null : (
                <View key={group}>
                  <SectionHeader
                    label={translate(SECTION_KEYS[group])}
                    count={items.length}
                    accent={group === 'overdue' ? 'danger' : 'default'}
                  />
                  {items.map((task) => {
                    const isItemSelected = selectedIds.has(task.id);
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        language={language}
                        selected={isItemSelected}
                        onPress={() => {
                          if (isSelecting) {
                            toggleSelect(task.id);
                          } else {
                            setSelectedTaskId(task.id);
                          }
                        }}
                        onLongPress={() => toggleSelect(task.id)}
                        onCompletePress={isSelecting ? undefined : () => completeTask(task.id)}
                      />
                    );
                  })}
                </View>
              )
            )}
          </>
        )}
      </ScreenShell>

      {/* Bulk actions bar */}
      {isSelecting && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onClear={clearSelection}
          onComplete={async () => {
            await completeTasks(Array.from(selectedIds));
            clearSelection();
          }}
          onSnooze={async () => {
            await snoozeTasks(Array.from(selectedIds));
            clearSelection();
          }}
          onDelete={async () => {
            await deleteTasks(Array.from(selectedIds));
            clearSelection();
          }}
          language={language}
        />
      )}

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
});
