import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text, Pressable, Modal, ScrollView } from 'react-native';
import { Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useTasks } from '@/providers/TaskProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useGroupedTasks } from '@/hooks/useGroupedTasks';
import { useFilteredTasks, DEFAULT_FILTER } from '@/hooks/useFilteredTasks';
import type { FilterState } from '@/hooks/useFilteredTasks';
import { useTaskSelection } from '@/hooks/useTaskSelection';
import { TaskCard } from '@/components/TaskCard';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { TaskFormSheet } from '@/components/TaskFormSheet';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import { BulkActionBar } from '@/components/BulkActionBar';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Button } from '@/components/Button';
import { ScreenShell, SectionHeader, StatPill, EmptyState } from '@/components/ScreenShell';
import { AppIcon } from '@/components/AppIcon';
import { taskToFormValues } from '@/domain/preset';
import { daysUntilDue, getTaskGroup } from '@/domain/recurrence';
import type { RepeatingTask, TaskGroup } from '@/types';
import { Colors } from '@/constants/theme';
import { DashboardSkeleton } from '@/components/SkeletonLoader';

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
    completeTask,
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
  } = useTasks();
  const { language, translate } = useTranslation();
  const { selectedIds, toggleSelect, clearSelection, isSelecting } = useTaskSelection();
  const [selectedTask, setSelectedTask] = useState<RepeatingTask | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);

  const editingTask = editingTaskId ? tasks.find((t) => t.id === editingTaskId) ?? null : null;
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  // Apply search + filter before grouping
  const filteredTasks = useFilteredTasks(tasks, filter);

  // Pinned tasks shown at top (before groups), only when no active filter query
  const pinnedTasks = filter.query.trim() === '' && filter.group === 'all' && filter.category === 'all'
    ? tasks.filter((t) => t.pinned)
    : [];

  // Tasks that go through the group layout (excluding pinned when not filtering)
  const unpinnedFiltered = pinnedTasks.length > 0
    ? filteredTasks.filter((t) => !t.pinned)
    : filteredTasks;

  const groups = useGroupedTasks(unpinnedFiltered);

  const isFiltering = filter.query.trim() !== '' || filter.group !== 'all' || filter.category !== 'all';
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
    setSelectedTask(null);
  };

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
                          setSelectedTask(task);
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
                            setSelectedTask(task);
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
        onClose={() => setSelectedTask(null)}
        onComplete={(id, note) => handleAction(() => completeTask(id, note))}
        onSnooze={(id) => handleAction(() => snoozeTask(id))}
        onSkip={(id) => handleAction(() => skipTask(id))}
        onDelete={(id) => handleAction(() => deleteTask(id))}
        onArchive={(id) => handleAction(() => archiveTask(id))}
        onPin={(id) => handleAction(() => pinTask(id))}
        onDuplicate={(id) => { duplicateTask(id); setSelectedTask(null); }}
        onEdit={(id) => {
          setSelectedTask(null);
          setEditingTaskId(id);
        }}
        onSetDueDate={(id, date) => handleAction(() => setTaskDueDate(id, date))}
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
});
