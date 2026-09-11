import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { ParsedTaskInput, RepeatingTask, SharedMember } from '@/types';
import { taskRepository } from '@/data/repositories/taskRepository';
import { useAuth } from '@/providers/AuthProvider';
import { useNotifications } from '@/providers/NotificationProvider';
import { userRepository } from '@/data/repositories/userRepository';
import type { AppNotification } from '@/types/notification';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useNetworkStatus } from '@/providers/NetworkProvider';

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
  undoSkipTask,
  setNextDueDate,
  duplicateTask,
  cleanupTasksOnRemoval,
} from '@/domain/task';
import { cancelTaskReminder, scheduleTaskReminder } from '@/services/notifications';
import { subscribeToUserTasksAndHouseholds } from '@/services/firebase/taskListener';
import { computePreviousDueDate } from '@/domain/recurrence';
import { removeHouseholdMember, normalizeHouseholdProfile } from '@/domain/household';

interface OnboardingPreset {
  title: string;
  category: RepeatingTask['category'];
  freq: string;
  amount?: number;
  finance?: boolean;
  icon?: string;
}

interface TaskContextValue {
  tasks: RepeatingTask[];
  archivedTasks: RepeatingTask[];
  loading: boolean;
  addTask: (
    parsed: ParsedTaskInput,
    opts: { finance: boolean; shared: SharedMember[] }
  ) => Promise<boolean>;
  completeTask: (taskId: string, note?: string) => Promise<void>;
  snoozeTask: (taskId: string, days?: number) => Promise<void>;
  skipTask: (taskId: string) => Promise<void>;
  undoSkipTask: (taskId: string) => Promise<void>;
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
  addPresetTask: (values: TaskFormValues, shared?: SharedMember[]) => Promise<boolean>;
  updateTask: (taskId: string, values: TaskFormValues, shared?: SharedMember[]) => Promise<void>;
  completeOnboarding: (opts: { selectedPresets: OnboardingPreset[]; pushOptIn: boolean }) => Promise<void>;
  resetTasks: () => void;
  deleteHistoryEntry: (taskId: string, entryIndex: number) => Promise<void>;
  removeHouseholdMemberAndCleanup: (memberCode: string, removeSharedTasks: boolean) => Promise<void>;
  unshareAllLocalTasks: () => Promise<void>;
}

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { user, activeHousehold, firebaseReady, updateUser } = useAuth();
  const { showToast } = useToast();
  const { translate } = useTranslation();
  const { addNotification } = useNotifications();
  const { isOnline } = useNetworkStatus();
  const [tasks, setTasks] = useState<RepeatingTask[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const wasOfflineRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current && isOnline && user?.id) {
      wasOfflineRef.current = false;
      taskRepository
        .flushSyncQueue(user.id)
        .then(() => {
          showToast(translate('backOnlineToast'));
        })
        .catch(() => {});
    }
  }, [isOnline, user?.id, showToast, translate]);

  // Stable key: only changes when the SET of household IDs changes (not on activeHouseholdId switch)
  const householdIdsKey = useMemo(
    () => (user?.households ?? []).map((h) => h.id).sort().join(','),
    [user?.households]
  );


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

    // 1. Immediately load local tasks so Home/Insights populate instantly without blocking
    (async () => {
      try {
        const localTasks = await taskRepository.load(user.id, isOnline);
        if (!cancelled && userIdRef.current === user.id) {
          setTasks(localTasks);
          setHydrated(true);
        }
      } catch (err) {
        console.warn('[Repeato] Failed to load local tasks:', err);
      } finally {
        if (!cancelled && (!firebaseReady || !isOnline)) setLoading(false);
      }
    })();

    // 2. Subscribe to remote tasks when Firebase is ready and device is online
    if (firebaseReady && isOnline) {
      setLoading(true);
      const householdIds = (user.households ?? []).map((h) => h.id);
      unsubscribeRemote = subscribeToUserTasksAndHouseholds(
        user.id,
        householdIds,
        async (remoteTasks) => {
          if (!cancelled && userIdRef.current === user.id) {
            await taskRepository.saveAll(remoteTasks, user.id);
            setTasks(remoteTasks);
            setHydrated(true);
            setLoading(false);
          }
        },
        async (error) => {
          console.warn('[Repeato] Task listener error, falling back to local tasks:', error);
          if (!cancelled && userIdRef.current === user.id) {
            try {
              const loaded = await taskRepository.load(user.id);
              setTasks(loaded);
            } catch {
              // Ignore fallback error
            } finally {
              setHydrated(true);
              setLoading(false);
            }
          }
        }
      );
      taskRepository.flushSyncQueue(user.id).catch(() => {});
    }

    return () => {
      cancelled = true;
      if (unsubscribeRemote) unsubscribeRemote();
    };
  }, [user?.id, householdIdsKey, firebaseReady, isOnline, showToast, translate]);

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
      
      // Always save to user's master tasks collection
      await taskRepository.saveOne(task, user.id, op);

      // If task explicitly belongs to a household, also sync to household collection for shared members
      if (task.householdId) {
        await taskRepository.saveOneHousehold(task, task.householdId, user.id, op);
      }

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
        const created = createTaskFromParsed(parsed, opts, user?.name);
        const task = {
          ...created,
          householdId: opts.shared && opts.shared.length > 0 ? (activeHousehold?.id ?? null) : null,
        };
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

        // Trigger in-app notification logs
        try {
          const lastHistory = mutated.history[mutated.history.length - 1];
          if (lastHistory && lastHistory.completedAt) {
            // Determine action type
            let actionType: AppNotification['type'] = 'system';
            let title = '';
            let body = '';
            
            if (mutated.category === 'bills' || mutated.category === 'finance') {
              actionType = 'payment';
            } else if (mutated.sharedWith.length > 0) {
              actionType = 'household';
            }

            const userName = user?.name || 'A household member';

            if (lastHistory.status === 'snoozed') {
              title = user?.language === 'hi' ? 'कार्य आगे बढ़ाया गया' : 'Task Snoozed';
              body = user?.language === 'hi'
                ? `"${mutated.title}" को सणूज़ किया गया।`
                : `"${mutated.title}" has been snoozed.`;
            } else if (lastHistory.status === 'skipped') {
              title = user?.language === 'hi' ? 'कार्य छोड़ा गया' : 'Task Skipped';
              body = user?.language === 'hi'
                ? `"${mutated.title}" का यह चक्र छोड़ दिया गया।`
                : `"${mutated.title}" occurrence was skipped.`;
            } else {
              // Completion
              title = user?.language === 'hi' ? 'कार्य पूरा हुआ' : 'Task Completed';
              body = user?.language === 'hi'
                ? `"${mutated.title}" को पूरा किया गया।`
                : `"${mutated.title}" was marked complete.`;
            }

            // 1. Add notification for You locally/remotely
            await addNotification(actionType, title, body, { taskId: mutated.id });

            // 2. Add notification for other shared members in remote Firestore
            for (const member of mutated.sharedWith) {
              if (member.userId && member.userId !== user?.id) {
                const peerTitle = lastHistory.status === 'snoozed'
                  ? `${userName} snoozed task`
                  : lastHistory.status === 'skipped'
                  ? `${userName} skipped task`
                  : `${userName} completed task`;
                
                const peerBody = lastHistory.status === 'snoozed'
                  ? `"${mutated.title}" has been snoozed.`
                  : lastHistory.status === 'skipped'
                  ? `"${mutated.title}" occurrence was skipped.`
                  : `"${mutated.title}" is complete.`;

                const peerNotif: AppNotification = {
                  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  type: actionType,
                  title: peerTitle,
                  body: peerBody,
                  timestamp: new Date().toISOString(),
                  read: false,
                  metadata: { taskId: mutated.id },
                };
                await userRepository.saveNotification(member.userId, peerNotif);
              }
            }
          }
        } catch (err) {
          console.warn('[Repeato] Failed to dispatch task notifications:', err);
        }
      } catch {
        showToast(translate('saveError'));
      }
    },
    [tasks, persistAll, syncTask, showToast, translate, addNotification, user]
  );

  const completeTask = useCallback(
    (taskId: string, note?: string) =>
      applyMutation(taskId, (t) => completeTaskInstance(t, note, user?.id), 'markedDone'),
    [applyMutation, user?.id]
  );

  const snoozeTask = useCallback(
    (taskId: string, days = 2) => applyMutation(taskId, (t) => snoozeTaskInstance(t, days, user?.id), 'snoozed'),
    [applyMutation, user?.id]
  );

  const skipTask = useCallback(
    (taskId: string) => applyMutation(taskId, (t) => skipTaskInstance(t, user?.id), 'skippedToast'),
    [applyMutation, user?.id]
  );

  const addPresetTask = useCallback(
    async (values: TaskFormValues, shared?: SharedMember[]): Promise<boolean> => {
      if (!canAddTask(user, tasks.length)) {
        showToast(translate('freeTierLimit'));
        return false;
      }
      try {
        const created = createTaskFromFormValues(values, shared, user?.name);
        const householdId = values.householdId !== undefined
          ? values.householdId
          : (shared && shared.length > 0 ? (activeHousehold?.id ?? null) : null);
        const task = {
          ...created,
          householdId,
        };
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
        (t) => {
          const updated = updateTaskDetails(t, values);
          const householdId = values.householdId !== undefined
            ? values.householdId
            : (shared && shared.length > 0 ? (activeHousehold?.id ?? t.householdId) : t.householdId);
          return {
            ...updated,
            sharedWith: shared ?? t.sharedWith,
            householdId,
          };
        },
        'taskUpdated'
      );
    },
    [applyMutation, activeHousehold?.id]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!user?.id) return;
      const targetTask = tasks.find((t) => t.id === taskId);
      try {
        const next = tasks.filter((t) => t.id !== taskId);
        await persistAll(next);
        await taskRepository.deleteOne(taskId, user.id);

        if (targetTask) {
          for (const member of targetTask.sharedWith) {
            if (member.userId && member.userId !== user.id) {
              try {
                await taskRepository.deleteOne(taskId, member.userId);
              } catch (err) {
                console.warn('[Repeato] Failed to delete shared task copy for member:', member.userId, err);
              }
            }
          }
        }

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
          createTaskFromPreset(p.title, p.category, p.freq, p.amount, p.finance, p.icon, user.name)
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

  const undoSkipTaskCb = useCallback(
    (taskId: string) => applyMutation(taskId, undoSkipTask, 'taskUpdated'),
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

  const deleteHistoryEntry = useCallback(
    async (taskId: string, entryIndex: number) => {
      const existing = tasks.find((t) => t.id === taskId);
      if (!existing) return;
      try {
        const nextHistory = existing.history.filter((_, idx) => idx !== entryIndex);
        let nextDueDate = existing.nextDueDate;
        if (entryIndex === existing.history.length - 1) {
          nextDueDate = computePreviousDueDate(existing.recurrence, existing.nextDueDate);
        }
        const mutated = {
          ...existing,
          history: nextHistory,
          nextDueDate,
          updatedAt: new Date().toISOString(),
        };
        const next = updateTaskInList(tasks, taskId, () => mutated);
        await persistAll(next);
        await syncTask(mutated, 'update');
        showToast(user?.language === 'hi' ? 'इतिहास प्रविष्टि हटा दी गई' : 'History entry deleted');
      } catch {
        showToast(translate('saveError'));
      }
    },
    [tasks, persistAll, syncTask, showToast, translate, user?.language]
  );

  const removeHouseholdMemberAndCleanup = useCallback(
    async (memberCode: string, removeSharedTasks: boolean) => {
      if (!user) return;

      const member = (user.householdMembers ?? []).find((m) => m.code === memberCode);
      if (!member) return;

      const updatedProfile = removeHouseholdMember(user, memberCode);
      const normalized = normalizeHouseholdProfile(updatedProfile);

      await updateUser({
        householdMembers: normalized.householdMembers,
        householdMemberUids: normalized.householdMemberUids,
      });

      if (firebaseReady && member.userId) {
        try {
          const remoteB = await userRepository.loadRemote(member.userId);
          if (remoteB) {
            const activeHhId = activeHousehold?.id;
            const updatedHouseholdsB = (remoteB.households ?? []).map((h) => {
              if (activeHhId && h.id !== activeHhId) return h;
              return {
                ...h,
                members: h.members.filter((m) => m.userId !== user.id && m.code !== user.userCode),
                memberUids: (h.memberUids ?? []).filter((uid) => uid !== user.id),
              };
            }).filter((h) => h.members.length > 1 || h.ownerUid === member.userId);

            const updatedMembersB = (remoteB.householdMembers ?? []).filter(
              (m) => m.userId !== user.id && m.code !== user.householdCode
            );
            const updatedUidsB = (remoteB.householdMemberUids ?? []).filter((uid) => uid !== user.id);
            const updatedB = {
              ...remoteB,
              households: updatedHouseholdsB,
              householdMembers: updatedMembersB,
              householdMemberUids: updatedUidsB,
              removedBy: user.name,
            };
            await userRepository.saveOther(member.userId, updatedB);
          }
        } catch (err) {
          console.warn('[Repeato] Failed to remove myself from B\'s remote profile:', err);
        }
      }

      const nextTasks = cleanupTasksOnRemoval(tasks, memberCode, member.userId, removeSharedTasks);
      await persistAll(nextTasks);

      if (firebaseReady && member.userId) {
        const sharedTasks = tasks.filter((t) =>
          t.sharedWith.some((m) => m.code === memberCode || m.userId === member.userId)
        );

        for (const task of sharedTasks) {
          try {
            if (removeSharedTasks) {
              await taskRepository.deleteOne(task.id, member.userId);
            } else {
              const unsharedTask = {
                ...task,
                sharedWith: task.sharedWith.filter((m) => m.code !== memberCode && m.userId !== member.userId),
                assignedTo: task.assignedTo === memberCode || task.assignedTo === member.userId ? undefined : task.assignedTo,
                updatedAt: new Date().toISOString(),
              };
              await taskRepository.saveOne(unsharedTask, member.userId, 'update');
            }
          } catch (err) {
            console.warn('[Repeato] Failed to clean up remote task on peer device:', task.id, err);
          }
        }
      }

      showToast(user?.language === 'hi' ? 'सदस्य को हटा दिया गया' : 'Member removed');
    },
    [user, tasks, firebaseReady, updateUser, persistAll, showToast, translate]
  );

  const unshareAllLocalTasks = useCallback(async () => {
    if (!user?.id) return;
    const cleanedTasks = tasks.map((t) => {
      if (t.sharedWith && t.sharedWith.length > 0) {
        return {
          ...t,
          sharedWith: [],
          assignedTo: undefined,
          updatedAt: new Date().toISOString(),
        };
      }
      return t;
    });
    await persistAll(cleanedTasks);
    if (firebaseReady) {
      for (const t of cleanedTasks) {
        try {
          await taskRepository.saveOne(t, user.id, 'update');
        } catch (err) {
          console.warn('[Repeato] Failed to sync unshared task in cleanup:', t.id, err);
        }
      }
    }
  }, [user?.id, tasks, persistAll, firebaseReady]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const { actionIdentifier, notification } = response;
      const taskId = notification.request.content.data?.taskId as string;
      if (!taskId) return;

      if (actionIdentifier === 'MARK_DONE') {
        completeTask(taskId);
      } else if (actionIdentifier === 'SNOOZE_2D') {
        snoozeTask(taskId, 2);
      }
    });

    return () => subscription.remove();
  }, [completeTask, snoozeTask]);

  const value = useMemo(
    () => ({
      tasks: hydrated ? tasks.filter((t) => !t.archived) : [],
      archivedTasks: hydrated ? tasks.filter((t) => t.archived) : [],
      loading,
      addTask,
      completeTask,
      snoozeTask,
      skipTask,
      undoSkipTask: undoSkipTaskCb,
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
      deleteHistoryEntry,
      removeHouseholdMemberAndCleanup,
      unshareAllLocalTasks,
    }),
    [hydrated, tasks, loading, addTask, completeTask, snoozeTask, skipTask, undoSkipTaskCb, deleteTask, archiveTaskCb, restoreTaskCb, pinTask, duplicateTaskCb, setTaskDueDate, completeTasks, snoozeTasks, deleteTasks, archiveTasks, addPresetTask, updateTask, completeOnboarding, resetTasks, deleteHistoryEntry, removeHouseholdMemberAndCleanup, unshareAllLocalTasks]
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be used within TaskProvider');
  return ctx;
}
