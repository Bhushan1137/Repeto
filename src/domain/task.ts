import type {
  CategoryKey,
  CompletionStatus,
  ParsedTaskInput,
  RepeatingTask,
  SharedMember,
  UserProfile,
} from '@/types';
import type { TaskFormValues } from '@/domain/taskForm';
import {
  computeInitialDueDate,
  computeNextDueDate,
  computePreviousDueDate,
  getMonthLabel,
  parseFrequencyLabel,
} from '@/domain/recurrence';
import { daysUntilDue } from '@/domain/recurrence';

export const FREE_TASK_LIMIT = 10;
export const FREE_SHARED_PARTICIPANT_LIMIT = 1;

export function canAddTask(_user: UserProfile | null, _taskCount: number): boolean {
  // Plan limits disabled for now (always allow)
  return true;
}

export function canShareWith(
  _user: UserProfile | null,
  _shared: SharedMember[]
): boolean {
  // Share limits disabled for now (always allow)
  return true;
}

/** Cap onboarding presets to free tier limit */
export function capTasksForPlan<T>(_user: UserProfile | null, items: T[]): T[] {
  // Onboarding presets limit disabled for now (always return all items)
  return items;
}

export function createTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createTaskFromFormValues(
  values: TaskFormValues,
  shared: SharedMember[] = [],
  creatorName?: string
): RepeatingTask {
  const now = new Date().toISOString();
  return {
    id: createTaskId(),
    householdId: values.householdId ?? null,
    title: values.title.trim(),
    category: values.category,
    recurrence: values.recurrence,
    frequencyLabel: values.freq,
    nextDueDate: computeInitialDueDate(values.recurrence, values.startDate, values.reminderTime),
    amount: values.amount,
    finance: values.finance || !!values.amount,
    reminderTime: values.reminderTime,
    startDate: values.startDate,
    sharedWith: shared,
    assignedTo: values.assignedTo,
    isRotating: values.isRotating,
    rotationMembers: values.rotationMembers,
    history: [],
    createdAt: now,
    updatedAt: now,
    escalationCount: 0,
    icon: values.icon,
    creatorName,
  };
}

export function createTaskFromPreset(
  title: string,
  category: CategoryKey,
  freq: string,
  amount?: number,
  finance?: boolean,
  icon?: string,
  creatorName?: string
): RepeatingTask {
  const recurrence = parseFrequencyLabel(freq);
  return {
    id: createTaskId(),
    householdId: null,
    title,
    icon,
    category,
    recurrence,
    frequencyLabel: freq,
    nextDueDate: computeNextDueDate(recurrence),
    amount,
    finance: finance ?? !!amount,
    sharedWith: [],
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    escalationCount: 0,
    creatorName,
  };
}

export function createTaskFromParsed(
  parsed: ParsedTaskInput,
  opts: { finance: boolean; shared: SharedMember[]; householdId?: string | null },
  creatorName?: string
): RepeatingTask {
  return {
    id: createTaskId(),
    householdId: opts.householdId !== undefined ? opts.householdId : (opts.shared && opts.shared.length > 0 ? undefined : null),
    title: parsed.title,
    category: parsed.category,
    recurrence: parsed.recurrence,
    frequencyLabel: parsed.frequencyLabel,
    nextDueDate: computeInitialDueDate(parsed.recurrence, parsed.startDate, parsed.reminderTime),
    amount: parsed.amount,
    finance: opts.finance || !!parsed.amount,
    reminderTime: parsed.reminderTime,
    startDate: parsed.startDate,
    sharedWith: opts.shared,
    assignedTo: parsed.assignedTo,
    isRotating: parsed.isRotating,
    rotationMembers: parsed.rotationMembers,
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    escalationCount: 0,
    icon: parsed.icon,
    creatorName,
  };
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function hasCompletedToday(task: RepeatingTask, today: Date = new Date()): boolean {
  if (!task.history || task.history.length === 0) return false;
  return task.history.some((h) => {
    if (h.status === 'skipped' || h.status === 'snoozed') return false;
    if (!h.completedAt) return false;
    return isSameDay(new Date(h.completedAt), today);
  });
}

export interface TaskCompletionEligibility {
  allowed: boolean;
  reason?: 'already_completed_today' | 'future_task' | 'archived' | 'assigned_to_other';
  daysUntilDue: number;
}

export function canCompleteTask(
  task: RepeatingTask,
  options?: {
    maxEarlyDays?: number;
    today?: Date;
    currentUserId?: string;
    currentUserCode?: string;
  }
): TaskCompletionEligibility {
  const today = options?.today ?? new Date();
  const days = daysUntilDue(task.nextDueDate, today);

  if (task.archived) {
    return { allowed: false, reason: 'archived', daysUntilDue: days };
  }

  // If this task belongs to a household and is assigned to someone else, block completion
  if (task.householdId && task.assignedTo && (options?.currentUserId || options?.currentUserCode)) {
    const isAssignedToMe =
      (options.currentUserId && task.assignedTo === options.currentUserId) ||
      (options.currentUserCode && task.assignedTo === options.currentUserCode);
    if (!isAssignedToMe) {
      return { allowed: false, reason: 'assigned_to_other', daysUntilDue: days };
    }
  }

  if (hasCompletedToday(task, today)) {
    return { allowed: false, reason: 'already_completed_today', daysUntilDue: days };
  }

  const maxEarlyDays = options?.maxEarlyDays ?? 0;
  if (days > maxEarlyDays) {
    return { allowed: false, reason: 'future_task', daysUntilDue: days };
  }

  return { allowed: true, daysUntilDue: days };
}

export interface TaskSnoozeEligibility {
  allowed: boolean;
  reason?: 'archived' | 'not_in_range';
  daysUntilDue: number;
}

export function canSnoozeTask(
  task: RepeatingTask,
  options?: { today?: Date }
): TaskSnoozeEligibility {
  const today = options?.today ?? new Date();
  const days = daysUntilDue(task.nextDueDate, today);

  if (task.archived) {
    return { allowed: false, reason: 'archived', daysUntilDue: days };
  }

  // Only allowed if task is due today or this week (days <= 7, including overdue)
  if (days > 7) {
    return { allowed: false, reason: 'not_in_range', daysUntilDue: days };
  }

  return { allowed: true, daysUntilDue: days };
}

export function statusForCompletion(dueDateIso: string, completedAt: Date = new Date()): CompletionStatus {
  return daysUntilDue(dueDateIso, completedAt) < 0 ? 'late' : 'on_time';
}

export function completeTaskInstance(task: RepeatingTask, note?: string, completedBy?: string): RepeatingTask {
  const status = statusForCompletion(task.nextDueDate);
  const base = new Date(task.nextDueDate);
  const today = new Date();
  const baseDate = base >= today ? base : today;

  let nextAssignee = task.assignedTo;
  let rotatedTo: string | undefined = undefined;
  if (task.isRotating && task.rotationMembers && task.rotationMembers.length > 1) {
    const currentIdx = task.rotationMembers.findIndex((m) => m === task.assignedTo);
    const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % task.rotationMembers.length;
    nextAssignee = task.rotationMembers[nextIdx];
    rotatedTo = nextAssignee;
  }

  return {
    ...task,
    assignedTo: nextAssignee,
    history: [
      ...(task.history ?? []).slice(-12),
      {
        month: getMonthLabel(),
        status,
        completedAt: new Date().toISOString(),
        note,
        completedBy,
        previousAssignee: task.assignedTo,
        rotatedTo,
        previousDueDate: task.nextDueDate,
      },
    ],
    nextDueDate: computeNextDueDate(task.recurrence, baseDate),
    escalationCount: 0,
    snoozedUntil: undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function toggleTaskPin(task: RepeatingTask): RepeatingTask {
  return { ...task, pinned: !task.pinned, updatedAt: new Date().toISOString() };
}

export function archiveTask(task: RepeatingTask): RepeatingTask {
  return { ...task, archived: true, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function restoreTask(task: RepeatingTask): RepeatingTask {
  return { ...task, archived: false, archivedAt: undefined, updatedAt: new Date().toISOString() };
}

export function undoSkipTask(task: RepeatingTask): RepeatingTask {
  const history = [...(task.history ?? [])];
  const lastIndex = history.map((h) => h.status).lastIndexOf('skipped');
  if (lastIndex === -1) return task;

  const targetEntry = history[lastIndex];
  const isLastEntry = lastIndex === history.length - 1;
  history.splice(lastIndex, 1);
  const nextDueDate = isLastEntry
    ? (targetEntry.previousDueDate || computePreviousDueDate(task.recurrence, task.nextDueDate))
    : task.nextDueDate;

  return {
    ...task,
    history,
    nextDueDate,
    updatedAt: new Date().toISOString(),
  };
}

export function undoCompleteTaskInstance(task: RepeatingTask, historyIndex?: number): RepeatingTask {
  if (!task.history || task.history.length === 0) return task;
  const history = [...task.history];
  const targetIdx =
    historyIndex !== undefined
      ? historyIndex
      : (() => {
          for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].status === 'on_time' || history[i].status === 'late') return i;
          }
          return history.length - 1;
        })();

  if (targetIdx < 0 || targetIdx >= history.length) return task;

  const targetEntry = history[targetIdx];
  const isLastEntry = targetIdx === history.length - 1;
  const nextHistory = history.filter((_, idx) => idx !== targetIdx);
  const nextDueDate = isLastEntry
    ? (targetEntry.previousDueDate || computePreviousDueDate(task.recurrence, task.nextDueDate))
    : task.nextDueDate;
  const nextAssignee =
    isLastEntry && targetEntry.previousAssignee !== undefined
      ? targetEntry.previousAssignee
      : task.assignedTo;

  return {
    ...task,
    assignedTo: nextAssignee,
    history: nextHistory,
    nextDueDate,
    updatedAt: new Date().toISOString(),
  };
}

export function claimTaskInstance(
  task: RepeatingTask,
  claimantUserId: string
): RepeatingTask {
  return {
    ...task,
    assignedTo: claimantUserId,
    updatedAt: new Date().toISOString(),
  };
}

export function takeOverTask(
  task: RepeatingTask,
  claimantUserId: string
): RepeatingTask {
  return {
    ...task,
    assignedTo: claimantUserId,
    updatedAt: new Date().toISOString(),
  };
}

export function setNextDueDate(task: RepeatingTask, date: Date): RepeatingTask {
  return { ...task, nextDueDate: date.toISOString(), updatedAt: new Date().toISOString() };
}

export function duplicateTask(task: RepeatingTask): RepeatingTask {
  const now = new Date().toISOString();
  return {
    ...task,
    id: createTaskId(),
    title: `${task.title} (copy)`,
    history: [],
    escalationCount: 0,
    pinned: false,
    archived: false,
    archivedAt: undefined,
    snoozedUntil: undefined,
    nextDueDate: computeNextDueDate(task.recurrence),
    createdAt: now,
    updatedAt: now,
  };
}

export function snoozeTaskInstance(task: RepeatingTask, days = 2, userId?: string): RepeatingTask {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const base = new Date(task.nextDueDate);
  const due = base < today ? today : base;
  due.setDate(due.getDate() + days);
  const now = new Date().toISOString();
  return {
    ...task,
    history: [
      ...(task.history ?? []).slice(-12),
      { month: getMonthLabel(), status: 'snoozed', completedAt: now, completedBy: userId, note: `Snoozed by ${days} days` },
    ],
    nextDueDate: due.toISOString(),
    snoozedUntil: due.toISOString(),
    updatedAt: now,
  };
}

export function skipTaskInstance(task: RepeatingTask, userId?: string): RepeatingTask {
  const now = new Date().toISOString();
  const base = new Date(task.nextDueDate);
  const today = new Date();
  const baseDate = base >= today ? base : today;
  return {
    ...task,
    history: [
      ...(task.history ?? []).slice(-12),
      {
        month: getMonthLabel(),
        status: 'skipped',
        completedAt: now,
        completedBy: userId,
        previousDueDate: task.nextDueDate,
      },
    ],
    nextDueDate: computeNextDueDate(task.recurrence, baseDate),
    escalationCount: 0,
    snoozedUntil: undefined,
    updatedAt: now,
  };
}

function recurrenceChanged(a: RepeatingTask['recurrence'], b: TaskFormValues['recurrence']): boolean {
  return (
    a.type !== b.type ||
    a.interval !== b.interval ||
    a.intervalUnit !== b.intervalUnit ||
    a.dayOfMonth !== b.dayOfMonth ||
    a.weekday !== b.weekday ||
    a.nthWeekday !== b.nthWeekday
  );
}

export function updateTaskDetails(task: RepeatingTask, values: TaskFormValues): RepeatingTask {
  // Recalculate nextDueDate when the recurrence rule, start date, or reminder time changes.
  const startChanged = task.startDate !== values.startDate;
  const timeChanged = task.reminderTime !== values.reminderTime;
  const recChanged = recurrenceChanged(task.recurrence, values.recurrence);
  const nextDueDate = (recChanged || startChanged || timeChanged)
    ? computeInitialDueDate(values.recurrence, values.startDate, values.reminderTime)
    : task.nextDueDate;

  return {
    ...task,
    title: values.title.trim(),
    category: values.category,
    recurrence: values.recurrence,
    frequencyLabel: values.freq,
    amount: values.amount,
    finance: values.finance || !!values.amount,
    reminderTime: values.reminderTime,
    startDate: values.startDate,
    assignedTo: values.assignedTo !== undefined ? values.assignedTo : task.assignedTo,
    isRotating: values.isRotating !== undefined ? values.isRotating : task.isRotating,
    rotationMembers: values.rotationMembers !== undefined ? values.rotationMembers : task.rotationMembers,
    householdId: values.householdId !== undefined ? values.householdId : task.householdId,
    icon: values.icon,
    nextDueDate,
    updatedAt: new Date().toISOString(),
  };
}

export function updateTaskInList(
  tasks: RepeatingTask[],
  taskId: string,
  updater: (task: RepeatingTask) => RepeatingTask
): RepeatingTask[] {
  return tasks.map((task) => (task.id === taskId ? updater(task) : task));
}

export function cleanupTasksOnRemoval(
  tasks: RepeatingTask[],
  removedCode: string,
  removedUserId?: string,
  removeSharedTasks: boolean = false
): RepeatingTask[] {
  const matchesRemoved = (idOrCode?: string) => {
    if (!idOrCode) return false;
    return idOrCode === removedCode || (!!removedUserId && idOrCode === removedUserId);
  };

  if (removeSharedTasks) {
    return tasks.filter((t) => !t.sharedWith.some((m) => matchesRemoved(m.code) || matchesRemoved(m.userId)));
  } else {
    return tasks.map((t) => {
      const isShared = t.sharedWith.some((m) => matchesRemoved(m.code) || matchesRemoved(m.userId));
      if (isShared) {
        return {
          ...t,
          sharedWith: t.sharedWith.filter((m) => !matchesRemoved(m.code) && !matchesRemoved(m.userId)),
          assignedTo: matchesRemoved(t.assignedTo) ? undefined : t.assignedTo,
          updatedAt: new Date().toISOString(),
        };
      }
      return t;
    });
  }
}

export interface TaskMergeResult {
  merged: RepeatingTask[];
  newerLocalTasks: RepeatingTask[];
}

/**
 * Merges local and remote tasks with conflict resolution:
 * - Compares updatedAt timestamps (last-write-wins).
 * - If timestamps are equal, prioritizes longer history or completion today so completions are never lost.
 * - Preserves tasks created locally that are not yet in remote, and tags them in `newerLocalTasks` so they can be synced.
 * - Appends remote-only tasks (e.g. from other devices or household members).
 */
export function mergeTasksLocalAndRemote(
  localTasks: RepeatingTask[] = [],
  remoteTasks: RepeatingTask[] = []
): TaskMergeResult {
  const localMap = new Map<string, RepeatingTask>();
  for (const t of localTasks) {
    if (t && t.id) localMap.set(t.id, t);
  }

  const remoteMap = new Map<string, RepeatingTask>();
  for (const t of remoteTasks) {
    if (t && t.id) remoteMap.set(t.id, t);
  }

  const mergedMap = new Map<string, RepeatingTask>();
  const newerLocalTasks: RepeatingTask[] = [];

  // 1. Process local tasks first to maintain local order
  for (const local of localTasks) {
    if (!local || !local.id) continue;
    const remote = remoteMap.get(local.id);

    if (!remote) {
      // Local only — keep local and tag for remote sync
      mergedMap.set(local.id, local);
      newerLocalTasks.push(local);
    } else {
      // Exists in both: compare recency
      const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;

      if (localTime > remoteTime) {
        mergedMap.set(local.id, local);
        newerLocalTasks.push(local);
      } else if (remoteTime > localTime) {
        mergedMap.set(local.id, remote);
      } else {
        // Timestamps equal or unparseable — compare history & completion
        const localHistLen = local.history?.length ?? 0;
        const remoteHistLen = remote.history?.length ?? 0;
        if (localHistLen > remoteHistLen) {
          mergedMap.set(local.id, local);
          newerLocalTasks.push(local);
        } else if (remoteHistLen > localHistLen) {
          mergedMap.set(local.id, remote);
        } else {
          // Check if local has completed today while remote does not
          const localDoneToday = hasCompletedToday(local);
          const remoteDoneToday = hasCompletedToday(remote);
          if (localDoneToday && !remoteDoneToday) {
            mergedMap.set(local.id, local);
            newerLocalTasks.push(local);
          } else {
            mergedMap.set(local.id, remote);
          }
        }
      }
    }
  }

  // 2. Append any remote tasks not present in local
  for (const remote of remoteTasks) {
    if (!remote || !remote.id) continue;
    if (!mergedMap.has(remote.id)) {
      mergedMap.set(remote.id, remote);
    }
  }

  return {
    merged: Array.from(mergedMap.values()),
    newerLocalTasks,
  };
}
