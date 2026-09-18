import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Linking } from 'react-native';
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
import { logRecommendationClickRemote } from '@/services/firebase/firestore';

import type { TaskFormValues } from '@/domain/taskForm';
import {
  canAddTask,
  canCompleteTask,
  canSnoozeTask,
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
  undoCompleteTaskInstance,
  undoSkipTask,
  setNextDueDate,
  duplicateTask,
  cleanupTasksOnRemoval,
  takeOverTask,
  mergeTasksLocalAndRemote,
} from '@/domain/task';
import { cancelTaskReminder, scheduleTaskReminder, setupNotificationCategories } from '@/services/notifications';
import { broadcastHouseholdTaskEvent } from '@/services/householdBroadcastService';
import { useRouter } from 'expo-router';
import { subscribeToUserTasksAndHouseholds } from '@/services/firebase/taskListener';
import { computePreviousDueDate } from '@/domain/recurrence';
import { removeHouseholdMember, normalizeHouseholdProfile, mergeHouseholds as domainMergeHouseholds } from '@/domain/household';

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
    opts: { finance: boolean; shared: SharedMember[]; householdId?: string | null }
  ) => Promise<boolean>;
  completeTask: (taskId: string, note?: string, options?: { maxEarlyDays?: number }) => Promise<void>;
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
  skipTasks: (taskIds: string[]) => Promise<void>;
  undoCompleteTasks: (taskIds: string[]) => Promise<void>;
  deleteTasks: (taskIds: string[]) => Promise<void>;
  archiveTasks: (taskIds: string[]) => Promise<void>;
  addPresetTask: (values: TaskFormValues, shared?: SharedMember[]) => Promise<boolean>;
  updateTask: (taskId: string, values: TaskFormValues, shared?: SharedMember[]) => Promise<void>;
  completeOnboarding: (opts: { selectedPresets: OnboardingPreset[]; pushOptIn: boolean }) => Promise<void>;
  resetTasks: () => void;
  deleteHistoryEntry: (taskId: string, entryIndex: number) => Promise<void>;
  undoCompleteTask: (taskId: string, historyIndex?: number) => Promise<void>;
  removeHouseholdMemberAndCleanup: (memberCode: string, removeSharedTasks: boolean) => Promise<void>;
  unshareAllLocalTasks: () => Promise<void>;
  mergeHouseholds: (sourceHhId: string, targetHhId: string) => Promise<void>;
  claimTask: (taskId: string) => Promise<void>;
  takeOverTask: (taskId: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
  focusTaskId: string | null;
  setFocusTaskId: (id: string | null) => void;
}

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { user, activeHousehold, firebaseReady, updateUser } = useAuth();
  const { showToast } = useToast();
  const { translate } = useTranslation();
  const { addNotification } = useNotifications();
  const { isOnline } = useNetworkStatus();
  const router = useRouter();
  const [tasks, setTasks] = useState<RepeatingTask[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const pendingNotificationResponseRef = useRef<Notifications.NotificationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const wasOfflineRef = useRef<boolean>(false);
  const tasksRef = useRef<RepeatingTask[]>(tasks);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

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

    if (userIdRef.current !== user.id) {
      setTasks([]);
      setHydrated(false);
      setLoading(true);
    }
    userIdRef.current = user.id;
    let cancelled = false;
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
            const currentLocal = tasksRef.current;
            const { merged, newerLocalTasks } = mergeTasksLocalAndRemote(currentLocal, remoteTasks);
            await taskRepository.saveAll(merged, user.id);
            setTasks(merged);
            tasksRef.current = merged;
            setHydrated(true);
            setLoading(false);

            if (newerLocalTasks.length > 0) {
              Promise.all(newerLocalTasks.map((t) => taskRepository.saveOne(t, user.id, 'update'))).catch(() => {});
            }
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

      if (task.archived) {
        await cancelTaskReminder(task.id);
      } else if (user.pushOptIn !== false || task.reminderTime) {
        await cancelTaskReminder(task.id);
        await scheduleTaskReminder(task);
      }
    },
    [user?.id, user?.pushOptIn]
  );

  const addTask = useCallback(
    async (
      parsed: ParsedTaskInput,
      opts: { finance: boolean; shared: SharedMember[]; householdId?: string | null }
    ): Promise<boolean> => {
      const currentTasks = tasksRef.current;
      if (!canAddTask(user, currentTasks.length)) {
        showToast(translate('freeTierLimit'));
        return false;
      }
      if (!canShareWith(user, opts.shared)) {
        showToast(translate('sharedLimit'));
        return false;
      }
      try {
        const created = createTaskFromParsed(parsed, opts, user?.name);
        const resolvedHouseholdId =
          opts.householdId !== undefined
            ? opts.householdId
            : opts.shared && opts.shared.length > 0
              ? (activeHousehold?.id ?? null)
              : null;
        const task = {
          ...created,
          householdId: resolvedHouseholdId,
        };
        const next = [task, ...currentTasks];
        setTasks(next);
        tasksRef.current = next;
        await persistAll(next);
        syncTask(task, 'create').catch(() => {});
        return true;
      } catch {
        showToast(translate('saveError'));
        return false;
      }
    },
    [user, activeHousehold?.id, persistAll, syncTask, showToast, translate]
  );

  const applyMutation = useCallback(
    async (
      taskId: string,
      updater: (t: RepeatingTask) => RepeatingTask,
      toastKey: Parameters<typeof translate>[0]
    ) => {
      const currentTasks = tasksRef.current;
      const existing = currentTasks.find((t) => t.id === taskId);
      if (!existing) return;
      try {
        const mutated = updater(existing);
        const next = updateTaskInList(currentTasks, taskId, () => mutated);
        setTasks(next);
        tasksRef.current = next;

        showToast(translate(toastKey));

        if (user?.id) {
          taskRepository.saveSingleLocal(mutated, user.id).catch((err) => {
            console.warn('[Repeato] Local save error:', err);
          });
        }

        // Asynchronously sync remote, schedule reminders & send notifications
        (async () => {
          try {
            await syncTask(mutated, 'update');

            const lastHistory = mutated.history[mutated.history.length - 1];
            if (lastHistory && lastHistory.completedAt) {
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
                title = user?.language === 'hi' ? 'कार्य पूरा हुआ' : 'Task Completed';
                body = user?.language === 'hi'
                  ? `"${mutated.title}" को पूरा किया गया।`
                  : `"${mutated.title}" was marked complete.`;
              }

              await addNotification(actionType, title, body, { taskId: mutated.id });

              // Broadcast to household members if this is a household task
              if (mutated.householdId && user) {
                const isRotation = Boolean(
                  mutated.isRotating &&
                  mutated.assignedTo &&
                  mutated.assignedTo !== user.id &&
                  mutated.assignedTo !== user.userCode
                );
                broadcastHouseholdTaskEvent({
                  eventType: isRotation ? 'task_completed_rotation' : 'task_completed',
                  task: mutated,
                  actorUser: user,
                  allMembers: activeHousehold?.members,
                  nextAssigneeId: isRotation ? mutated.assignedTo : undefined,
                }).catch((err) => console.warn('[Repeato] Household broadcast failed:', err));
              }

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
            console.warn('[Repeato] Failed to dispatch task sync or notifications:', err);
          }
        })();
      } catch {
        showToast(translate('saveError'));
      }
    },
    [syncTask, showToast, translate, addNotification, user, activeHousehold?.members]
  );

  const completeTask = useCallback(
    async (taskId: string, note?: string, options?: { maxEarlyDays?: number }) => {
      const existing = tasksRef.current.find((t) => t.id === taskId);
      if (!existing) return;
      const eligibility = canCompleteTask(existing, {
        maxEarlyDays: options?.maxEarlyDays ?? 0,
        currentUserId: user?.id,
        currentUserCode: user?.userCode,
      });
      if (!eligibility.allowed) {
        if (eligibility.reason === 'assigned_to_other') {
          showToast(
            user?.language === 'hi'
              ? 'यह कार्य किसी अन्य सदस्य को सौंपा गया है'
              : 'Assigned to another member. Take over the task first!'
          );
        } else if (eligibility.reason === 'already_completed_today') {
          showToast(
            user?.language === 'hi'
              ? 'यह कार्य आज पहले ही पूरा हो चुका है'
              : 'Task is already completed for today'
          );
        } else if (eligibility.reason === 'future_task') {
          showToast(
            user?.language === 'hi'
              ? 'भविष्य के कार्य नियत होने पर ही पूरे किए जा सकते हैं'
              : 'Future tasks cannot be marked done ahead of time'
          );
        }
        return;
      }
      await applyMutation(taskId, (t) => completeTaskInstance(t, note, user?.id), 'markedDone');
    },
    [applyMutation, user?.id, user?.userCode, user?.language, showToast]
  );

  const snoozeTask = useCallback(
    (taskId: string, days = 2) => {
      const existing = tasksRef.current.find((t) => t.id === taskId);
      if (existing && !canSnoozeTask(existing).allowed) {
        showToast(translate('snoozeRestricted'));
        return Promise.resolve();
      }
      return applyMutation(taskId, (t) => snoozeTaskInstance(t, days, user?.id), 'snoozed');
    },
    [applyMutation, user?.id, showToast, translate]
  );

  const refreshTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      if (isOnline) {
        await taskRepository.flushSyncQueue(user.id).catch(() => {});
      }
      const [loaded] = await Promise.all([
        taskRepository.load(user.id, isOnline, tasksRef.current),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
      setTasks(loaded);
      tasksRef.current = loaded;
      setHydrated(true);
    } catch (err) {
      console.warn('[Repeato] Failed to refresh tasks:', err);
    }
  }, [user?.id, isOnline]);

  const skipTask = useCallback(
    (taskId: string) => applyMutation(taskId, (t) => skipTaskInstance(t, user?.id), 'skippedToast'),
    [applyMutation, user?.id]
  );

  const addPresetTask = useCallback(
    async (values: TaskFormValues, shared?: SharedMember[]): Promise<boolean> => {
      const currentTasks = tasksRef.current;
      if (!canAddTask(user, currentTasks.length)) {
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
        const next = [task, ...currentTasks];
        setTasks(next);
        tasksRef.current = next;
        showToast(translate('taskCreated'));
        await persistAll(next);
        syncTask(task, 'create').catch(() => {});
        return true;
      } catch {
        showToast(translate('saveError'));
        return false;
      }
    },
    [user, activeHousehold?.id, persistAll, syncTask, showToast, translate]
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
      const currentTasks = tasksRef.current;
      const targetTask = currentTasks.find((t) => t.id === taskId);
      try {
        const next = currentTasks.filter((t) => t.id !== taskId);
        setTasks(next);
        tasksRef.current = next;
        showToast(translate('taskDeleted'));

        taskRepository.deleteOne(taskId, user.id).catch((err) => {
          console.warn('[Repeato] Local delete error:', err);
        });

        if (targetTask) {
          if (targetTask.householdId) {
            taskRepository.deleteOneHousehold(taskId, targetTask.householdId, user.id).catch((err) => {
              console.warn('[Repeato] Failed to delete household task copy:', err);
            });
          }
          for (const member of targetTask.sharedWith) {
            if (member.userId && member.userId !== user.id) {
              taskRepository.deleteOne(taskId, member.userId).catch((err) => {
                console.warn('[Repeato] Failed to delete shared task copy for member:', member.userId, err);
              });
            }
          }
        }

        cancelTaskReminder(taskId).catch(() => {});
      } catch {
        showToast(translate('saveError'));
      }
    },
    [user?.id, showToast, translate]
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
      const currentTasks = tasksRef.current;
      if (!canAddTask(user, currentTasks.length)) {
        showToast(translate('freeTierLimit'));
        return false;
      }
      const existing = currentTasks.find((t) => t.id === taskId);
      if (!existing) return false;
      try {
        const copy = duplicateTask(existing);
        const next = [copy, ...currentTasks];
        setTasks(next);
        tasksRef.current = next;
        showToast(translate('taskCreated'));
        await persistAll(next);
        syncTask(copy, 'create').catch(() => {});
        return true;
      } catch {
        showToast(translate('saveError'));
        return false;
      }
    },
    [user, persistAll, syncTask, showToast, translate]
  );

  const completeTasks = useCallback(
    async (taskIds: string[]) => {
      const currentTasks = tasksRef.current;
      let next = [...currentTasks];
      const completedTasksList: RepeatingTask[] = [];
      for (const id of taskIds) {
        const existing = next.find((t) => t.id === id);
        if (existing && canCompleteTask(existing, { maxEarlyDays: 0 }).allowed) {
          const mutated = completeTaskInstance(existing, undefined, user?.id);
          next = updateTaskInList(next, id, () => mutated);
          completedTasksList.push(mutated);
        }
      }
      if (completedTasksList.length === 0) {
        showToast(
          user?.language === 'hi'
            ? 'कोई भी चुना हुआ कार्य आज पूरा करने योग्य नहीं है'
            : 'None of the selected tasks can be completed today'
        );
        return;
      }
      try {
        setTasks(next);
        tasksRef.current = next;
        showToast(translate('markedDone'));
        await persistAll(next);
        for (const t of completedTasksList) {
          syncTask(t, 'update').catch(() => {});
        }
      } catch {
        showToast(translate('saveError'));
      }
    },
    [user?.id, user?.language, persistAll, syncTask, showToast, translate]
  );

  const snoozeTasks = useCallback(
    async (taskIds: string[], days = 2) => {
      const currentTasks = tasksRef.current;
      let next = [...currentTasks];
      const snoozedList: RepeatingTask[] = [];
      for (const id of taskIds) {
        const existing = next.find((t) => t.id === id);
        if (existing && canSnoozeTask(existing).allowed) {
          const mutated = snoozeTaskInstance(existing, days, user?.id);
          next = updateTaskInList(next, id, () => mutated);
          snoozedList.push(mutated);
        }
      }
      if (snoozedList.length === 0) {
        showToast(translate('snoozeRestricted'));
        return;
      }
      try {
        setTasks(next);
        tasksRef.current = next;
        showToast(translate('snoozed'));
        await persistAll(next);
        for (const t of snoozedList) {
          syncTask(t, 'update').catch(() => {});
        }
      } catch {
        showToast(translate('saveError'));
      }
    },
    [user?.id, persistAll, syncTask, showToast, translate]
  );

  const skipTasks = useCallback(
    async (taskIds: string[]) => {
      let next = [...tasksRef.current];
      const skippedList: RepeatingTask[] = [];
      for (const id of taskIds) {
        const existing = next.find((t) => t.id === id);
        if (existing) {
          const mutated = skipTaskInstance(existing, user?.id);
          next = updateTaskInList(next, id, () => mutated);
          skippedList.push(mutated);
        }
      }
      if (skippedList.length === 0) return;
      try {
        setTasks(next);
        tasksRef.current = next;
        showToast(translate('skippedToast'));
        await persistAll(next);
        for (const t of skippedList) {
          syncTask(t, 'update').catch(() => {});
        }
      } catch {
        showToast(translate('saveError'));
      }
    },
    [user?.id, persistAll, syncTask, showToast, translate]
  );

  const undoCompleteTasks = useCallback(
    async (taskIds: string[]) => {
      let next = [...tasksRef.current];
      const undoneList: RepeatingTask[] = [];
      for (const id of taskIds) {
        const existing = next.find((t) => t.id === id);
        if (existing && existing.history && existing.history.length > 0) {
          const mutated = undoCompleteTaskInstance(existing);
          next = updateTaskInList(next, id, () => mutated);
          undoneList.push(mutated);
        }
      }
      if (undoneList.length === 0) return;
      try {
        setTasks(next);
        tasksRef.current = next;
        showToast(
          user?.language === 'hi'
            ? 'कार्य पूर्ववत किए गए'
            : 'Completions undone'
        );
        await persistAll(next);
        for (const t of undoneList) {
          syncTask(t, 'update').catch(() => {});
        }
      } catch {
        showToast(translate('saveError'));
      }
    },
    [user?.language, persistAll, syncTask, showToast, translate]
  );

  const deleteTasks = useCallback(
    async (taskIds: string[]) => {
      if (!user?.id) return;
      const currentTasks = tasksRef.current;
      const tasksToDelete = currentTasks.filter((t) => taskIds.includes(t.id));
      const next = currentTasks.filter((t) => !taskIds.includes(t.id));
      try {
        setTasks(next);
        tasksRef.current = next;
        showToast(translate('taskDeleted'));
        await persistAll(next);
        for (const t of tasksToDelete) {
          taskRepository.deleteOne(t.id, user.id).catch(() => {});
          if (t.householdId) {
            taskRepository.deleteOneHousehold(t.id, t.householdId, user.id).catch(() => {});
          }
          cancelTaskReminder(t.id).catch(() => {});
        }
      } catch {
        showToast(translate('saveError'));
      }
    },
    [user?.id, persistAll, showToast, translate]
  );

  const archiveTasks = useCallback(
    async (taskIds: string[]) => {
      const currentTasks = tasksRef.current;
      let next = [...currentTasks];
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
        setTasks(next);
        tasksRef.current = next;
        showToast(translate('taskDeleted'));
        await persistAll(next);
        for (const t of archivedList) {
          syncTask(t, 'update').catch(() => {});
        }
      } catch {
        showToast(translate('saveError'));
      }
    },
    [persistAll, syncTask, showToast, translate]
  );

  const resetTasks = useCallback(() => setTasks([]), []);

  const deleteHistoryEntry = useCallback(
    async (taskId: string, entryIndex: number) => {
      const currentTasks = tasksRef.current;
      const existing = currentTasks.find((t) => t.id === taskId);
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
        const next = updateTaskInList(currentTasks, taskId, () => mutated);
        setTasks(next);
        tasksRef.current = next;
        showToast(user?.language === 'hi' ? 'इतिहास प्रविष्टि हटा दी गई' : 'History entry deleted');
        await persistAll(next);
        syncTask(mutated, 'update').catch(() => {});
      } catch {
        showToast(translate('saveError'));
      }
    },
    [persistAll, syncTask, showToast, translate, user?.language]
  );

  const undoCompleteTask = useCallback(
    async (taskId: string, historyIndex?: number) => {
      const currentTasks = tasksRef.current;
      const existing = currentTasks.find((t) => t.id === taskId);
      if (!existing || !existing.history || existing.history.length === 0) return;
      try {
        const mutated = undoCompleteTaskInstance(existing, historyIndex);
        const next = updateTaskInList(currentTasks, taskId, () => mutated);
        setTasks(next);
        tasksRef.current = next;
        showToast(
          user?.language === 'hi'
            ? 'कार्य वापस आज की सूची में जोड़ा गया'
            : 'Task restored to Today'
        );
        await persistAll(next);
        syncTask(mutated, 'update').catch(() => {});
      } catch {
        showToast(translate('saveError'));
      }
    },
    [persistAll, syncTask, showToast, translate, user?.language]
  );

  const removeHouseholdMemberAndCleanup = useCallback(
    async (memberCode: string, removeSharedTasks: boolean) => {
      if (!user) return;

      const activeMembers = activeHousehold?.members ?? user.householdMembers ?? [];
      const member = activeMembers.find((m) => m.code === memberCode || m.userId === memberCode);
      if (!member) return;

      const updatedProfile = removeHouseholdMember(user, memberCode);
      const normalized = normalizeHouseholdProfile(updatedProfile);

      let updatedHouseholds = normalized.households;
      if (activeHousehold?.id && updatedHouseholds) {
        updatedHouseholds = updatedHouseholds.map((h) => {
          if (h.id !== activeHousehold.id) return h;
          return {
            ...h,
            members: h.members.filter((m) => m.code !== memberCode && m.userId !== memberCode),
            memberUids: (h.memberUids ?? []).filter((uid) => uid !== member.userId),
          };
        });
      }

      await updateUser({
        householdMembers: normalized.householdMembers,
        householdMemberUids: normalized.householdMemberUids,
        ...(updatedHouseholds && { households: updatedHouseholds }),
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

      const currentTasks = tasksRef.current;
      const nextTasks = cleanupTasksOnRemoval(currentTasks, memberCode, member.userId, removeSharedTasks);
      setTasks(nextTasks);
      tasksRef.current = nextTasks;
      await persistAll(nextTasks);

      if (firebaseReady && member.userId) {
        const sharedTasks = currentTasks.filter((t) =>
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
    [user, activeHousehold, firebaseReady, updateUser, persistAll, showToast]
  );

  const unshareAllLocalTasks = useCallback(async () => {
    if (!user?.id) return;
    const currentTasks = tasksRef.current;
    const cleanedTasks = currentTasks.map((t) => {
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
    setTasks(cleanedTasks);
    tasksRef.current = cleanedTasks;
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
  }, [user?.id, persistAll, firebaseReady]);

  const mergeHouseholdsCb = useCallback(
    async (sourceHhId: string, targetHhId: string) => {
      if (!user) return;
      const currentTasks = tasksRef.current;
      const { updatedUser, updatedTasks } = domainMergeHouseholds(user, sourceHhId, targetHhId, currentTasks);
      setTasks(updatedTasks);
      tasksRef.current = updatedTasks;
      await persistAll(updatedTasks);
      await updateUser(updatedUser);

      if (firebaseReady && user?.id) {
        for (const t of updatedTasks) {
          if (t.householdId === targetHhId) {
            await taskRepository.saveOneHousehold(t, targetHhId, user.id, 'update');
            await taskRepository.deleteOneHousehold(t.id, sourceHhId, user.id);
          }
        }
        await userRepository.deleteHousehold(sourceHhId);
      }
    },
    [user, persistAll, updateUser, firebaseReady]
  );

  const claimTaskCb = useCallback(
    async (taskId: string) => {
      if (!user?.id) return;
      const currentTasks = tasksRef.current;
      const target = currentTasks.find((t) => t.id === taskId);
      if (!target) return;

      const previousAssignee = target.assignedTo;
      const updated = takeOverTask(target, user.id);
      const nextTasks = updateTaskInList(currentTasks, taskId, () => updated);
      setTasks(nextTasks);
      tasksRef.current = nextTasks;
      showToast(user.language === 'hi' ? 'कार्य आपके नाम पर दर्ज हो गया!' : 'Task assigned to you!');
      await persistAll(nextTasks);
      syncTask(updated, 'update').catch(() => {});

      if (updated.householdId) {
        broadcastHouseholdTaskEvent({
          eventType: 'task_taken_over',
          task: updated,
          actorUser: user,
          allMembers: activeHousehold?.members,
          previousAssigneeId: previousAssignee,
        }).catch((err) => console.warn('[Repeato] Takeover broadcast failed:', err));
      }
    },
    [user, persistAll, syncTask, showToast, activeHousehold?.members]
  );

  // Setup notification categories (with localized button titles)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      setupNotificationCategories(user?.language === 'hi');
    }
  }, [user?.language]);

  const processNotificationResponse = useCallback(
    async (response: Notifications.NotificationResponse) => {
      const { actionIdentifier, notification } = response;
      const identifier = notification?.request?.identifier;
      const data = notification?.request?.content?.data;
      const taskId = data?.taskId as string | undefined;

      // 1. Immediately clear / dismiss the notification from the tray
      if (Platform.OS !== 'web') {
        if (identifier) {
          Notifications.dismissNotificationAsync(identifier).catch(() => {});
        }
        if (taskId) {
          Notifications.dismissNotificationAsync(`task-${taskId}`).catch(() => {});
          for (let i = 0; i < 5; i++) {
            Notifications.dismissNotificationAsync(`task-${taskId}-${i}`).catch(() => {});
          }
        }
      }

      // 2. Handle campaign notification response
      if (data?.type === 'campaign') {
        const campaignId = data.campaignId as string | undefined;
        const redirectUrl = data.redirectUrl as string | undefined;
        if (campaignId) {
          logRecommendationClickRemote(campaignId).catch(() => {});
        }
        if (redirectUrl) {
          Linking.openURL(redirectUrl).catch(() => {});
        } else {
          try {
            router.navigate('/notifications');
          } catch {
            // ignore
          }
        }
        return;
      }

      if (!taskId) return;

      // 2. Perform requested action (completeTask and snoozeTask already show appropriate feedback toasts)
      if (actionIdentifier === 'MARK_DONE') {
        await completeTask(taskId, undefined, { maxEarlyDays: 1 });
      } else if (actionIdentifier === 'SNOOZE_2D') {
        await snoozeTask(taskId, 2);
      } else {
        // User tapped the notification body itself
        setFocusTaskId(taskId);
        try {
          router.navigate('/(tabs)');
        } catch {
          // ignore navigation errors during mount
        }
      }
    },
    [completeTask, snoozeTask, router]
  );

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      // Dismiss from device tray immediately
      const identifier = response.notification?.request?.identifier;
      if (identifier && Platform.OS !== 'web') {
        Notifications.dismissNotificationAsync(identifier).catch(() => {});
      }

      if (!hydrated) {
        pendingNotificationResponseRef.current = response;
      } else {
        processNotificationResponse(response);
      }
    },
    [hydrated, processNotificationResponse]
  );

  // When tasks finish hydrating from SQLite, process any pending cold-start response
  useEffect(() => {
    if (hydrated && pendingNotificationResponseRef.current) {
      const pending = pendingNotificationResponseRef.current;
      pendingNotificationResponseRef.current = null;
      processNotificationResponse(pending);
    }
  }, [hydrated, processNotificationResponse]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Check cold-start notification response
    Notifications.getLastNotificationResponseAsync()
      .then((lastResponse) => {
        if (lastResponse) {
          handleNotificationResponse(lastResponse);
          Notifications.clearLastNotificationResponseAsync().catch(() => {});
        }
      })
      .catch(() => {});

    // Listen for responses while running
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });

    return () => subscription.remove();
  }, [handleNotificationResponse]);

  const activeTasks = useMemo(() => (hydrated ? tasks.filter((t) => !t.archived) : []), [hydrated, tasks]);
  const archivedTasks = useMemo(() => (hydrated ? tasks.filter((t) => t.archived) : []), [hydrated, tasks]);

  const value = useMemo(
    () => ({
      tasks: activeTasks,
      archivedTasks,
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
      skipTasks,
      undoCompleteTasks,
      deleteTasks,
      archiveTasks,
      addPresetTask,
      updateTask,
      completeOnboarding,
      resetTasks,
      deleteHistoryEntry,
      undoCompleteTask,
      removeHouseholdMemberAndCleanup,
      unshareAllLocalTasks,
      mergeHouseholds: mergeHouseholdsCb,
      claimTask: claimTaskCb,
      takeOverTask: claimTaskCb,
      refreshTasks,
      focusTaskId,
      setFocusTaskId,
    }),
    [
      activeTasks,
      archivedTasks,
      loading,
      addTask,
      completeTask,
      snoozeTask,
      skipTask,
      undoSkipTaskCb,
      deleteTask,
      archiveTaskCb,
      restoreTaskCb,
      pinTask,
      duplicateTaskCb,
      setTaskDueDate,
      completeTasks,
      snoozeTasks,
      skipTasks,
      undoCompleteTasks,
      deleteTasks,
      archiveTasks,
      addPresetTask,
      updateTask,
      completeOnboarding,
      resetTasks,
      deleteHistoryEntry,
      undoCompleteTask,
      removeHouseholdMemberAndCleanup,
      unshareAllLocalTasks,
      mergeHouseholdsCb,
      claimTaskCb,
      refreshTasks,
      focusTaskId,
    ]
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be used within TaskProvider');
  return ctx;
}
