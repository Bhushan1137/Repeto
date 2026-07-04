import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ParsedTaskInput, RepeatingTask, SharedMember } from '@/types';
import { taskRepository } from '@/data/repositories/taskRepository';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/hooks/useTranslation';
import type { TaskFormValues } from '@/domain/taskForm';
import {
  canAddTask,
  canShareWith,
  capTasksForPlan,
  completeTaskInstance,
  createTaskFromParsed,
  createTaskFromFormValues,
  createTaskFromPreset,
  skipTaskInstance,
  snoozeTaskInstance,
  updateTaskDetails,
  updateTaskInList,
  toggleTaskPin,
  archiveTask,
  restoreTask,
  setNextDueDate,
  duplicateTask,
} from '@/domain/task';
import { cancelTaskReminder, scheduleTaskReminder } from '@/services/notifications';
import { subscribeToTasks } from '@/services/firebase/taskListener';

interface OnboardingPreset {
  title: string;
  category: RepeatingTask['category'];
  freq: string;
  amount?: number;
  finance?: boolean;
}

interface TaskContextValue {
  tasks: RepeatingTask[];
  loading: boolean;
  addTask: (
    parsed: ParsedTaskInput,
    opts: { finance: boolean; shared: SharedMember[] }
  ) => Promise<boolean>;
  completeTask: (taskId: string, note?: string) => Promise<void>;
  snoozeTask: (taskId: string, days?: number) => Promise<void>;
  skipTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  archiveTask: (taskId: string) => Promise<void>;
  restoreTask: (taskId: string) => Promise<void>;
  pinTask: (taskId: string) => Promise<void>;
  duplicateTask: (taskId: string) => Promise<boolean>;
  setTaskDueDate: (taskId: string, date: Date) => Promise<void>;
  completeTasks: (taskIds: string[]) => Promise<void>;
  snoozeTasks: (taskIds: string[], days?: number) => Promise<void>;
  deleteTasks: (taskIds: string[]) => Promise<void>;
  archiveTasks: (taskIds: string[]) => Promise<void>;
  addPresetTask: (values: TaskFormValues) => Promise<boolean>;
  updateTask: (taskId: string, values: TaskFormValues, shared?: SharedMember[]) => Promise<void>;
  completeOnboarding: (opts: { selectedPresets: OnboardingPreset[]; pushOptIn: boolean }) => Promise<void>;
  resetTasks: () => void;
}

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { user, firebaseReady, updateUser } = useAuth();
  const { showToast } = useToast();
  const { translate } = useTranslation();
  const [tasks, setTasks] = useState<RepeatingTask[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setHydrated(false);
      userIdRef.current = null;
      return;
    }

    let cancelled = false;
    userIdRef.current = user.id;
    let unsubscribeRemote: (() => void) | null = null;

    if (firebaseReady) {
      setLoading(true);
      unsubscribeRemote = subscribeToTasks(user.id, async (remoteTasks) => {
        if (!cancelled && userIdRef.current === user.id) {
          await taskRepository.saveAll(remoteTasks, user.id);
          setTasks(remoteTasks);
          setHydrated(true);
          setLoading(false);
        }
      });
      taskRepository.flushSyncQueue(user.id).catch(() => {});
    } else {
      (async () => {
        setLoading(true);
        try {
          const loaded = await taskRepository.load(user.id);
          if (!cancelled && userIdRef.current === user.id) {
            setTasks(loaded);
            setHydrated(true);
          }
        } catch {
          if (!cancelled) showToast(translate('loadError'));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }

    return () => {
      cancelled = true;
      if (unsubscribeRemote) unsubscribeRemote();
    };
  }, [user?.id, firebaseReady, showToast, translate]);

  const persistAll = useCallback(
    async (next: RepeatingTask[]) => {
      setTasks(next);
      if (user?.id) await taskRepository.saveAll(next, user.id);
    },
    [user?.id]
  );

  const syncTask = useCallback(
    async (task: RepeatingTask, op: 'create' | 'update') => {
      if (!user?.id) return;
      await taskRepository.saveOne(task, user.id, op);
      if (user.pushOptIn) {
        await cancelTaskReminder(task.id);
        await scheduleTaskReminder(task);
      }
    },
    [user?.id, user?.pushOptIn]
  );

  const addTask = useCallback(
    async (
      parsed: ParsedTaskInput,
      opts: { finance: boolean; shared: SharedMember[] }
    ): Promise<boolean> => {
      if (!canAddTask(user, tasks.length)) {
        showToast(translate('freeTierLimit'));
        return false;
      }
      if (!canShareWith(user, opts.shared)) {
        showToast(translate('sharedLimit'));
        return false;
      }
      try {
        const task = createTaskFromParsed(parsed, opts);
        const next = [task, ...tasks];
        await persistAll(next);
        await syncTask(task, 'create');
        return true;
      } catch {
        showToast(translate('saveError'));
        return false;
      }
    },
    [user, tasks, persistAll, syncTask, showToast, translate]
  );

  const applyMutation = useCallback(
    async (
      taskId: string,
      updater: (t: RepeatingTask) => RepeatingTask,
      toastKey: Parameters<typeof translate>[0]
    ) => {
      const existing = tasks.find((t) => t.id === taskId);
      if (!existing) return;
      try {
        const mutated = updater(existing);
        const next = updateTaskInList(tasks, taskId, () => mutated);
        await persistAll(next);
        await syncTask(mutated, 'update');
        showToast(translate(toastKey));
      } catch {
        showToast(translate('saveError'));
      }
    },
    [tasks, persistAll, syncTask, showToast, translate]
  );

  const completeTask = useCallback(
    (taskId: string, note?: string) =>
      applyMutation(taskId, (t) => completeTaskInstance(t, note, user?.id), 'markedDone'),
    [applyMutation, user?.id]
  );

  const snoozeTask = useCallback(
    (taskId: string, days = 2) => applyMutation(taskId, (t) => snoozeTaskInstance(t, days), 'snoozed'),
    [applyMutation]
  );

  const skipTask = useCallback(
    (taskId: string) => applyMutation(taskId, skipTaskInstance, 'skippedToast'),
    [applyMutation]
  );

  const addPresetTask = useCallback(
    async (values: TaskFormValues): Promise<boolean> => {
      if (!canAddTask(user, tasks.length)) {
        showToast(translate('freeTierLimit'));
        return false;
      }
      try {
        const task = createTaskFromFormValues(values);
        const next = [task, ...tasks];
        await persistAll(next);
        await syncTask(task, 'create');
        showToast(translate('taskCreated'));
        return true;
      } catch {
        showToast(translate('saveError'));
        return false;
      }
    },
    [user, tasks, persistAll, syncTask, showToast, translate]
  );

  const updateTask = useCallback(
    async (taskId: string, values: TaskFormValues, shared?: SharedMember[]) => {
      await applyMutation(
        taskId,
        (t) => ({ ...updateTaskDetails(t, values), sharedWith: shared ?? t.sharedWith }),
        'taskUpdated'
      );
    },
    [applyMutation]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!user?.id) return;
      try {
        const next = tasks.filter((t) => t.id !== taskId);
        await persistAll(next);
        await taskRepository.deleteOne(taskId, user.id);
        await cancelTaskReminder(taskId);
        showToast(translate('taskDeleted'));
      } catch {
        showToast(translate('saveError'));
      }
    },
    [user?.id, tasks, persistAll, showToast, translate]
  );

  const completeOnboarding = useCallback(
    async (opts: { selectedPresets: OnboardingPreset[]; pushOptIn: boolean }) => {
      if (!user) return;
      try {
        const built = opts.selectedPresets.map((p) =>
          createTaskFromPreset(p.title, p.category, p.freq, p.amount, p.finance)
        );
        const capped = capTasksForPlan(user, built);
        await updateUser({ onboardingComplete: true, pushOptIn: opts.pushOptIn });
        await taskRepository.replaceAll(capped, user.id);
        setTasks(capped);
        setHydrated(true);
        if (opts.pushOptIn) {
          for (const task of capped) await scheduleTaskReminder(task);
        }
      } catch {
        showToast(translate('saveError'));
      }
    },
    [user, updateUser, showToast, translate]
  );

  const pinTask = useCallback(
    (taskId: string) => applyMutation(taskId, toggleTaskPin, 'taskUpdated'),
    [applyMutation]
  );

  const archiveTaskCb = useCallback(
    (taskId: string) => applyMutation(taskId, archiveTask, 'taskDeleted'),
    [applyMutation]
  );

  const restoreTaskCb = useCallback(
    (taskId: string) => applyMutation(taskId, restoreTask, 'taskUpdated'),
    [applyMutation]
  );

  const setTaskDueDate = useCallback(
    (taskId: string, date: Date) => applyMutation(taskId, (t) => setNextDueDate(t, date), 'taskUpdated'),
    [applyMutation]
  );

  const duplicateTaskCb = useCallback(
    async (taskId: string): Promise<boolean> => {
      if (!canAddTask(user, tasks.length)) {
        showToast(translate('freeTierLimit'));
        return false;
      }
      const existing = tasks.find((t) => t.id === taskId);
      if (!existing) return false;
      try {
        const copy = duplicateTask(existing);
        const next = [copy, ...tasks];
        await persistAll(next);
        await syncTask(copy, 'create');
        showToast(translate('taskCreated'));
        return true;
      } catch {
        showToast(translate('saveError'));
        return false;
      }
    },
    [user, tasks, persistAll, syncTask, showToast, translate]
  );

  const completeTasks = useCallback(
    async (taskIds: string[]) => {
      let next = [...tasks];
      const completedTasksList: RepeatingTask[] = [];
      for (const id of taskIds) {
        const existing = next.find((t) => t.id === id);
        if (existing) {
          const mutated = completeTaskInstance(existing, undefined, user?.id);
          next = updateTaskInList(next, id, () => mutated);
          completedTasksList.push(mutated);
        }
      }
      try {
        await persistAll(next);
        for (const t of completedTasksList) {
          await syncTask(t, 'update');
        }
        showToast(translate('markedDone'));
      } catch {
        showToast(translate('saveError'));
      }
    },
    [tasks, user?.id, persistAll, syncTask, showToast, translate]
  );

  const snoozeTasks = useCallback(
    async (taskIds: string[], days = 2) => {
      let next = [...tasks];
      const snoozedList: RepeatingTask[] = [];
      for (const id of taskIds) {
        const existing = next.find((t) => t.id === id);
        if (existing) {
          const mutated = snoozeTaskInstance(existing, days);
          next = updateTaskInList(next, id, () => mutated);
          snoozedList.push(mutated);
        }
      }
      try {
        await persistAll(next);
        for (const t of snoozedList) {
          await syncTask(t, 'update');
        }
        showToast(translate('snoozed'));
      } catch {
        showToast(translate('saveError'));
      }
    },
    [tasks, persistAll, syncTask, showToast, translate]
  );

  const deleteTasks = useCallback(
    async (taskIds: string[]) => {
      if (!user?.id) return;
      const next = tasks.filter((t) => !taskIds.includes(t.id));
      try {
        await persistAll(next);
        for (const id of taskIds) {
          await taskRepository.deleteOne(id, user.id);
          await cancelTaskReminder(id);
        }
        showToast(translate('taskDeleted'));
      } catch {
        showToast(translate('saveError'));
      }
    },
    [user?.id, tasks, persistAll, showToast, translate]
  );

  const archiveTasks = useCallback(
    async (taskIds: string[]) => {
      let next = [...tasks];
      const archivedList: RepeatingTask[] = [];
      for (const id of taskIds) {
        const existing = next.find((t) => t.id === id);
        if (existing) {
          const mutated = archiveTask(existing);
          next = updateTaskInList(next, id, () => mutated);
          archivedList.push(mutated);
        }
      }
      try {
        await persistAll(next);
        for (const t of archivedList) {
          await syncTask(t, 'update');
        }
        showToast(translate('taskDeleted'));
      } catch {
        showToast(translate('saveError'));
      }
    },
    [tasks, persistAll, syncTask, showToast, translate]
  );

  const resetTasks = useCallback(() => setTasks([]), []);

  const value = useMemo(
    () => ({
      tasks: hydrated ? tasks.filter((t) => !t.archived) : [],
      loading,
      addTask,
      completeTask,
      snoozeTask,
      skipTask,
      deleteTask,
      archiveTask: archiveTaskCb,
      restoreTask: restoreTaskCb,
      pinTask,
      duplicateTask: duplicateTaskCb,
      setTaskDueDate,
      completeTasks,
      snoozeTasks,
      deleteTasks,
      archiveTasks,
      addPresetTask,
      updateTask,
      completeOnboarding,
      resetTasks,
    }),
    [hydrated, tasks, loading, addTask, completeTask, snoozeTask, skipTask, deleteTask, archiveTaskCb, restoreTaskCb, pinTask, duplicateTaskCb, setTaskDueDate, completeTasks, snoozeTasks, deleteTasks, archiveTasks, addPresetTask, updateTask, completeOnboarding, resetTasks]
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be used within TaskProvider');
  return ctx;
}
