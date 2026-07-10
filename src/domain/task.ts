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
  computeNextDueDate,
  getMonthLabel,
  parseFrequencyLabel,
} from '@/domain/recurrence';
import { daysUntilDue } from '@/domain/recurrence';

export const FREE_TASK_LIMIT = 10;
export const FREE_SHARED_PARTICIPANT_LIMIT = 1;

export function canAddTask(user: UserProfile | null, taskCount: number): boolean {
  if (!user || user.plan !== 'free') return true;
  return taskCount < FREE_TASK_LIMIT;
}

export function canShareWith(
  user: UserProfile | null,
  shared: SharedMember[]
): boolean {
  if (!user || user.plan !== 'free') return true;
  return shared.length <= FREE_SHARED_PARTICIPANT_LIMIT;
}

/** Cap onboarding presets to free tier limit */
export function capTasksForPlan<T>(user: UserProfile | null, items: T[]): T[] {
  if (!user || user.plan !== 'free') return items;
  return items.slice(0, FREE_TASK_LIMIT);
}

export function createTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createTaskFromFormValues(values: TaskFormValues, shared: SharedMember[] = []): RepeatingTask {
  const now = new Date().toISOString();
  return {
    id: createTaskId(),
    title: values.title.trim(),
    category: values.category,
    recurrence: values.recurrence,
    frequencyLabel: values.freq,
    nextDueDate: computeNextDueDate(values.recurrence),
    amount: values.amount,
    finance: values.finance || !!values.amount,
    reminderTime: values.reminderTime,
    sharedWith: shared,
    history: [],
    createdAt: now,
    updatedAt: now,
    escalationCount: 0,
    icon: values.icon,
  };
}

export function createTaskFromPreset(
  title: string,
  category: CategoryKey,
  freq: string,
  amount?: number,
  finance?: boolean,
  icon?: string
): RepeatingTask {
  const recurrence = parseFrequencyLabel(freq);
  return {
    id: createTaskId(),
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
  };
}

export function createTaskFromParsed(
  parsed: ParsedTaskInput,
  opts: { finance: boolean; shared: SharedMember[] }
): RepeatingTask {
  return {
    id: createTaskId(),
    title: parsed.title,
    category: parsed.category,
    recurrence: parsed.recurrence,
    frequencyLabel: parsed.frequencyLabel,
    nextDueDate: computeNextDueDate(parsed.recurrence),
    amount: parsed.amount,
    finance: opts.finance || !!parsed.amount,
    reminderTime: parsed.reminderTime,
    sharedWith: opts.shared,
    assignedTo: parsed.assignedTo,
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    escalationCount: 0,
    icon: parsed.icon,
  };
}

export function statusForCompletion(dueDateIso: string, completedAt: Date = new Date()): CompletionStatus {
  return daysUntilDue(dueDateIso, completedAt) < 0 ? 'late' : 'on_time';
}

export function completeTaskInstance(task: RepeatingTask, note?: string, completedBy?: string): RepeatingTask {
  const status = statusForCompletion(task.nextDueDate);
  return {
    ...task,
    history: [
      ...task.history.slice(-4),
      { month: getMonthLabel(), status, completedAt: new Date().toISOString(), note, completedBy },
    ],
    nextDueDate: computeNextDueDate(task.recurrence, new Date()),
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
      ...task.history.slice(-4),
      { month: getMonthLabel(), status: 'snoozed', completedAt: now, completedBy: userId, note: `Snoozed by ${days} days` },
    ],
    nextDueDate: due.toISOString(),
    snoozedUntil: due.toISOString(),
    updatedAt: now,
  };
}

export function skipTaskInstance(task: RepeatingTask, userId?: string): RepeatingTask {
  const now = new Date().toISOString();
  return {
    ...task,
    history: [...task.history.slice(-4), { month: getMonthLabel(), status: 'skipped', completedAt: now, completedBy: userId }],
    nextDueDate: computeNextDueDate(task.recurrence, new Date()),
    escalationCount: 0,
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
  // Only recalculate nextDueDate when the recurrence rule actually changes.
  // If only title, category, amount etc. change, preserve the current due date
  // so existing scheduling progress is not lost.
  const nextDueDate = recurrenceChanged(task.recurrence, values.recurrence)
    ? computeNextDueDate(values.recurrence)
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
