import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  archiveTask,
  canAddTask,
  canCompleteTask,
  canSnoozeTask,
  canShareWith,
  capTasksForPlan,
  cleanupTasksOnRemoval,
  completeTaskInstance,
  createTaskId,
  createTaskFromFormValues,
  createTaskFromParsed,
  createTaskFromPreset,
  duplicateTask,
  hasCompletedToday,
  isOverdueToday,
  restoreTask,
  undoCompleteTaskInstance,
  undoSkipTask,
  setNextDueDate,
  skipTaskInstance,
  snoozeTaskInstance,
  statusForCompletion,
  toggleTaskPin,
  updateTaskDetails,
  updateTaskInList,
  mergeTasksLocalAndRemote,
  getTodayDoseProgress,
  normalizeReminderTimes,
} from '@/domain/task';
import type { RepeatingTask } from '@/types';
import type { TaskFormValues } from '@/domain/taskForm';
import { daysUntilDue } from '@/domain/recurrence';

describe('domain/task', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('capTasksForPlan, canAddTask, canShareWith return expected defaults', () => {
    expect(canAddTask(null, 5)).toBe(true);
    expect(canShareWith(null, [])).toBe(true);
    expect(capTasksForPlan(null, [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('createTaskId produces a task id prefix', () => {
    const id = createTaskId();
    expect(id).toMatch(/^task-\d+-[a-z0-9]+$/);
  });

  it('createTaskFromFormValues creates repeating task object', () => {
    const values: TaskFormValues = {
      title: '  Electricity Bill  ',
      category: 'bills',
      recurrence: { type: 'monthly' },
      freq: 'Monthly',
      amount: 1500,
      finance: true,
      reminderTime: '10:00',
      startDate: '2026-09-01T00:00:00.000Z',
    };
    const task = createTaskFromFormValues(
      values,
      [{ name: 'Alice', code: 'ABC', phone: '123', color: '#123' }],
      'Bob'
    );
    expect(task.title).toBe('Electricity Bill');
    expect(task.category).toBe('bills');
    expect(task.amount).toBe(1500);
    expect(task.finance).toBe(true);
    expect(task.creatorName).toBe('Bob');
    expect(task.sharedWith).toHaveLength(1);
    expect(task.escalationCount).toBe(0);
  });

  it('createTaskFromPreset creates repeating task object', () => {
    const task = createTaskFromPreset('Rent', 'home', 'Monthly', 25000, true, 'home-icon', 'Owner');
    expect(task.title).toBe('Rent');
    expect(task.category).toBe('home');
    expect(task.amount).toBe(25000);
    expect(task.finance).toBe(true);
    expect(task.icon).toBe('home-icon');
  });

  it('createTaskFromParsed creates task from natural language parsed output', () => {
    const task = createTaskFromParsed(
      {
        title: 'Water Bill',
        category: 'bills',
        recurrence: { type: 'monthly' },
        frequencyLabel: 'Monthly',
        amount: 500,
      },
      { finance: true, shared: [{ name: 'Sam', code: 'SAM123', phone: '123', color: '#123' }] },
      'Creator'
    );
    expect(task.title).toBe('Water Bill');
    expect(task.sharedWith).toHaveLength(1);
    expect(task.householdId).toBeUndefined();
  });

  it('statusForCompletion computes late or on_time', () => {
    const now = new Date('2026-09-05T10:00:00.000Z');
    expect(statusForCompletion('2026-09-01T00:00:00.000Z', now)).toBe('late');
    expect(statusForCompletion('2026-09-10T00:00:00.000Z', now)).toBe('on_time');
  });

  it('completeTaskInstance appends history and advances nextDueDate', () => {
    const task = createTaskFromPreset('Gym', 'health', 'Monthly');
    const completed = completeTaskInstance(task, 'done for today', 'User1');
    expect(completed.history).toHaveLength(1);
    expect(completed.history[0].status).toBe('on_time');
    expect(completed.history[0].completedBy).toBe('User1');
    expect(completed.history[0].note).toBe('done for today');
  });

  it('toggleTaskPin, archiveTask, restoreTask, setNextDueDate mutate task as expected', () => {
    const task = createTaskFromPreset('Gym', 'health', 'Monthly');
    const pinned = toggleTaskPin(task);
    expect(pinned.pinned).toBe(true);
    const unpinned = toggleTaskPin(pinned);
    expect(unpinned.pinned).toBe(false);

    const archived = archiveTask(task);
    expect(archived.archived).toBe(true);
    expect(archived.archivedAt).toBeDefined();

    const restored = restoreTask(archived);
    expect(restored.archived).toBe(false);
    expect(restored.archivedAt).toBeUndefined();

    const newDate = new Date('2026-10-01T10:00:00.000Z');
    const updatedDate = setNextDueDate(task, newDate);
    expect(updatedDate.nextDueDate).toBe('2026-10-01T10:00:00.000Z');
  });

  it('duplicateTask creates copy with reset stats', () => {
    const task = createTaskFromPreset('Gym', 'health', 'Monthly');
    task.history = [{ month: 'Jan', status: 'on_time', completedAt: 'iso' }];
    task.pinned = true;
    task.archived = true;

    const copy = duplicateTask(task);
    expect(copy.id).not.toBe(task.id);
    expect(copy.title).toBe('Gym (copy)');
    expect(copy.history).toHaveLength(0);
    expect(copy.pinned).toBe(false);
    expect(copy.archived).toBe(false);
  });

  it('snoozeTaskInstance and skipTaskInstance add history entries', () => {
    const task = createTaskFromPreset('Gym', 'health', 'Monthly');
    task.nextDueDate = '2026-09-01T00:00:00.000Z';
    const skipped = skipTaskInstance(task, 'UserB');
    expect(skipped.history).toHaveLength(1);
    expect(skipped.history[0].status).toBe('skipped');

    const unskipped = undoSkipTask(skipped);
    expect(unskipped.history).toHaveLength(0);

    const snoozed = snoozeTaskInstance(task, 3, 'UserA');
    expect(snoozed.snoozedUntil).toBeDefined();
    expect(snoozed.history[0].status).toBe('snoozed');
  });

  it('updateTaskDetails updates fields and recalculates date if recurrence or start date changes', () => {
    const task = createTaskFromPreset('Gym', 'health', 'Monthly');
    const newValues: TaskFormValues = {
      title: ' Gym Updated ',
      category: 'health',
      recurrence: { type: 'daily' },
      freq: 'Daily',
      finance: false,
    };
    const updated = updateTaskDetails(task, newValues);
    expect(updated.title).toBe('Gym Updated');
    expect(updated.recurrence.type).toBe('daily');

    // same recurrence, start date unchanged
    const updated2 = updateTaskDetails(updated, {
      ...newValues,
      title: ' Gym Updated Again ',
    });
    expect(updated2.title).toBe('Gym Updated Again');
  });

  it('updateTaskInList updates target task in list', () => {
    const task1 = createTaskFromPreset('Gym', 'health', 'Monthly');
    const task2 = createTaskFromPreset('Milk', 'home', 'Daily');
    const tasks = [task1, task2];

    const result = updateTaskInList(tasks, task1.id, (t) => toggleTaskPin(t));
    expect(result[0].pinned).toBe(true);
    expect(result[1].pinned).toBe(undefined);
  });

  it('cleanupTasksOnRemoval removes or modifies shared tasks when member is removed', () => {
    const task1: RepeatingTask = {
      ...createTaskFromPreset('Shared Task', 'home', 'Monthly'),
      sharedWith: [{ name: 'Alice', code: 'ALICE1', phone: '123', color: '#123' }],
      assignedTo: 'ALICE1',
    };
    const task2 = createTaskFromPreset('Private Task', 'home', 'Monthly');
    const tasks = [task1, task2];

    // removeSharedTasks = true
    const cleaned = cleanupTasksOnRemoval(tasks, 'ALICE1', undefined, true);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].id).toBe(task2.id);

    // removeSharedTasks = false
    const modified = cleanupTasksOnRemoval(tasks, 'ALICE1', undefined, false);
    expect(modified).toHaveLength(2);
    expect(modified[0].sharedWith).toHaveLength(0);
    expect(modified[0].assignedTo).toBeUndefined();
  });

  it('hasCompletedToday correctly detects same-day completions', () => {
    const today = new Date('2026-09-12T10:00:00.000Z');
    const task = createTaskFromPreset('Water Plants', 'home', 'Daily');
    expect(hasCompletedToday(task, today)).toBe(false);

    // With completion today
    const completedTodayTask: RepeatingTask = {
      ...task,
      history: [
        { month: 'Sep 2026', status: 'on_time', completedAt: '2026-09-12T08:30:00.000Z' },
      ],
    };
    expect(hasCompletedToday(completedTodayTask, today)).toBe(true);

    // With skipped today - should NOT count as completed today
    const skippedTodayTask: RepeatingTask = {
      ...task,
      history: [
        { month: 'Sep 2026', status: 'skipped', completedAt: '2026-09-12T08:30:00.000Z' },
      ],
    };
    expect(hasCompletedToday(skippedTodayTask, today)).toBe(false);

    // With completion yesterday
    const completedYesterdayTask: RepeatingTask = {
      ...task,
      history: [
        { month: 'Sep 2026', status: 'on_time', completedAt: '2026-09-11T10:00:00.000Z' },
      ],
    };
    expect(hasCompletedToday(completedYesterdayTask, today)).toBe(false);
  });

  it('canCompleteTask enforces same-day lock and future task window restrictions', () => {
    const today = new Date('2026-09-12T10:00:00.000Z');

    // 1. Task due today (days = 0)
    const taskDueToday: RepeatingTask = {
      ...createTaskFromPreset('Electricity Bill', 'bills', 'Monthly'),
      nextDueDate: '2026-09-12T10:00:00.000Z',
    };
    expect(canCompleteTask(taskDueToday, { today, maxEarlyDays: 0 })).toEqual({
      allowed: true,
      daysUntilDue: 0,
    });

    // 2. Overdue task (days < 0)
    const taskOverdue: RepeatingTask = {
      ...createTaskFromPreset('Credit Card', 'bills', 'Monthly'),
      nextDueDate: '2026-09-10T10:00:00.000Z',
    };
    expect(canCompleteTask(taskOverdue, { today, maxEarlyDays: 0 })).toEqual({
      allowed: true,
      daysUntilDue: -2,
    });

    // 3. Already completed today -> rejected
    const taskDoneToday: RepeatingTask = {
      ...taskDueToday,
      history: [{ month: 'Sep 2026', status: 'on_time', completedAt: '2026-09-12T08:00:00.000Z' }],
    };
    expect(canCompleteTask(taskDoneToday, { today, maxEarlyDays: 0 })).toEqual({
      allowed: false,
      reason: 'already_completed_today',
      daysUntilDue: 0,
    });

    // 4. Future task due in 1 day (tomorrow)
    const taskTomorrow: RepeatingTask = {
      ...createTaskFromPreset('Workout', 'health', 'Daily'),
      nextDueDate: '2026-09-13T10:00:00.000Z',
    };
    // Disallowed for quick complete (maxEarlyDays = 0)
    expect(canCompleteTask(taskTomorrow, { today, maxEarlyDays: 0 })).toEqual({
      allowed: false,
      reason: 'future_task',
      daysUntilDue: 1,
    });
    // Allowed from detail sheet early window (maxEarlyDays = 2)
    expect(canCompleteTask(taskTomorrow, { today, maxEarlyDays: 2 })).toEqual({
      allowed: true,
      daysUntilDue: 1,
    });

    // 5. Future task due in 40 days
    const taskNextMonth: RepeatingTask = {
      ...createTaskFromPreset('Quarterly Tax', 'finance', 'Monthly'),
      nextDueDate: '2026-10-22T10:00:00.000Z',
    };
    // Disallowed for quick complete
    expect(canCompleteTask(taskNextMonth, { today, maxEarlyDays: 0 })).toEqual({
      allowed: false,
      reason: 'future_task',
      daysUntilDue: 40,
    });
    // Disallowed even from detail sheet (maxEarlyDays = 2)
    expect(canCompleteTask(taskNextMonth, { today, maxEarlyDays: 2 })).toEqual({
      allowed: false,
      reason: 'future_task',
      daysUntilDue: 40,
    });

    // 6. Archived task
    const taskArchived: RepeatingTask = {
      ...taskDueToday,
      archived: true,
    };
    expect(canCompleteTask(taskArchived, { today })).toEqual({
      allowed: false,
      reason: 'archived',
      daysUntilDue: 0,
    });

    // 7. Household task assigned to someone else
    const householdTaskOther: RepeatingTask = {
      ...taskDueToday,
      householdId: 'hh-123',
      assignedTo: 'user-bob',
    };
    // Disallowed for Alice
    expect(canCompleteTask(householdTaskOther, { today, currentUserId: 'user-alice' })).toEqual({
      allowed: false,
      reason: 'assigned_to_other',
      daysUntilDue: 0,
    });
    // Allowed for Bob
    expect(canCompleteTask(householdTaskOther, { today, currentUserId: 'user-bob' })).toEqual({
      allowed: true,
      daysUntilDue: 0,
    });
  });

  it('canSnoozeTask restricts snooze to today and this week (days <= 7)', () => {
    const today = new Date('2026-09-12T10:00:00.000Z');

    const baseTask = createTaskFromPreset('Internet Bill', 'bills', 'Monthly');

    // Overdue task (days = -2) -> allowed
    const overdueTask: RepeatingTask = { ...baseTask, nextDueDate: '2026-09-10T10:00:00.000Z' };
    expect(canSnoozeTask(overdueTask, { today })).toEqual({
      allowed: true,
      daysUntilDue: -2,
    });

    // Today task (days = 0) -> allowed
    const todayTask: RepeatingTask = { ...baseTask, nextDueDate: '2026-09-12T10:00:00.000Z' };
    expect(canSnoozeTask(todayTask, { today })).toEqual({
      allowed: true,
      daysUntilDue: 0,
    });

    // This week task (days = 5) -> allowed
    const thisWeekTask: RepeatingTask = { ...baseTask, nextDueDate: '2026-09-17T10:00:00.000Z' };
    expect(canSnoozeTask(thisWeekTask, { today })).toEqual({
      allowed: true,
      daysUntilDue: 5,
    });

    // 7 days away -> allowed
    const sevenDaysTask: RepeatingTask = { ...baseTask, nextDueDate: '2026-09-19T10:00:00.000Z' };
    expect(canSnoozeTask(sevenDaysTask, { today })).toEqual({
      allowed: true,
      daysUntilDue: 7,
    });

    // Future task (days = 10 or 136) -> rejected
    const tenDaysTask: RepeatingTask = { ...baseTask, nextDueDate: '2026-09-22T10:00:00.000Z' };
    expect(canSnoozeTask(tenDaysTask, { today })).toEqual({
      allowed: false,
      reason: 'not_in_range',
      daysUntilDue: 10,
    });

    const farFutureTask: RepeatingTask = { ...baseTask, nextDueDate: '2027-01-26T10:00:00.000Z' };
    expect(canSnoozeTask(farFutureTask, { today }).allowed).toBe(false);

    // Archived task -> rejected
    const archivedTask: RepeatingTask = { ...todayTask, archived: true };
    expect(canSnoozeTask(archivedTask, { today })).toEqual({
      allowed: false,
      reason: 'archived',
      daysUntilDue: 0,
    });
  });

  it('undoCompleteTaskInstance removes history and restores nextDueDate', () => {
    const originalDue = '2026-09-12T10:00:00.000Z';
    const task: RepeatingTask = {
      ...createTaskFromPreset('Water Bill', 'bills', 'Monthly'),
      recurrence: { type: 'monthly' },
      nextDueDate: originalDue,
      snoozedUntil: '2026-09-14T10:00:00.000Z',
      escalationCount: 2,
    };

    // 1. Mark Done
    const completed = completeTaskInstance(task, 'Paid via UPI', 'user-1');
    expect(completed.history).toHaveLength(1);
    expect(completed.history[0].status).toBe('on_time');
    expect(completed.history[0].note).toBe('Paid via UPI');
    expect(completed.history[0].completedBy).toBe('user-1');
    expect(completed.escalationCount).toBe(0);
    expect(completed.snoozedUntil).toBeUndefined();
    expect(new Date(completed.nextDueDate).getTime()).toBeGreaterThan(new Date(originalDue).getTime());

    // 2. Undo Completion
    const undone = undoCompleteTaskInstance(completed);
    expect(undone.history).toHaveLength(0);
    // nextDueDate should be restored back to the previous due date
    expect(new Date(undone.nextDueDate).getMonth()).toBe(new Date(originalDue).getMonth());
    expect(new Date(undone.nextDueDate).getDate()).toBe(new Date(originalDue).getDate());
  });

  it('undoSkipTask removes skipped history entry and restores nextDueDate', () => {
    const originalDue = '2026-09-12T10:00:00.000Z';
    const task: RepeatingTask = {
      ...createTaskFromPreset('Gym Routine', 'health', 'Weekly'),
      recurrence: { type: 'weekly' },
      nextDueDate: originalDue,
    };

    // 1. Skip task
    const skipped = skipTaskInstance(task, 'user-1');
    expect(skipped.history).toHaveLength(1);
    expect(skipped.history[0].status).toBe('skipped');
    expect(skipped.history[0].completedBy).toBe('user-1');
    expect(new Date(skipped.nextDueDate).getTime()).toBeGreaterThan(new Date(originalDue).getTime());

    // 2. Undo skip
    const undone = undoSkipTask(skipped);
    expect(undone.history).toHaveLength(0);
    expect(new Date(undone.nextDueDate).getDate()).toBe(new Date(originalDue).getDate());
  });

  it('undoCompleteTaskInstance restores overdue task back to its exact overdue date instead of today', () => {
    // Overdue task due 10 days ago
    const overdueDate = new Date(Date.now() - 10 * 86400000).toISOString();
    const task: RepeatingTask = {
      ...createTaskFromPreset('Overdue Electric Bill', 'bills', 'Daily'),
      recurrence: { type: 'daily' },
      nextDueDate: overdueDate,
    };

    // 1. Mark overdue task as Done
    const completed = completeTaskInstance(task, 'Paid late', 'user-1');
    expect(completed.history[0].status).toBe('late');
    expect(completed.history[0].previousDueDate).toBe(overdueDate);

    // 2. Undo completion
    const undone = undoCompleteTaskInstance(completed);
    expect(undone.history).toHaveLength(0);
    // nextDueDate should be restored to the exact overdue date, NOT today!
    expect(undone.nextDueDate).toBe(overdueDate);
    expect(daysUntilDue(undone.nextDueDate)).toBeLessThan(0);
  });

  it('undoSkipTask restores overdue task back to its exact overdue date', () => {
    const overdueDate = new Date(Date.now() - 5 * 86400000).toISOString();
    const task: RepeatingTask = {
      ...createTaskFromPreset('Overdue Filter Cleaning', 'home', 'Daily'),
      recurrence: { type: 'daily' },
      nextDueDate: overdueDate,
    };

    const skipped = skipTaskInstance(task, 'user-1');
    expect(skipped.history[0].status).toBe('skipped');
    expect(skipped.history[0].previousDueDate).toBe(overdueDate);

    const undone = undoSkipTask(skipped);
    expect(undone.nextDueDate).toBe(overdueDate);
    expect(daysUntilDue(undone.nextDueDate)).toBeLessThan(0);
  });

  it('Bulk flows: correctly performs bulk done, snooze, skip, undo, and pin on multiple tasks', () => {
    const today = new Date('2026-09-12T10:00:00.000Z');

    // Create 3 diverse repeating tasks
    const task1: RepeatingTask = {
      ...createTaskFromPreset('Daily Vitamins', 'health', 'Daily'),
      recurrence: { type: 'daily' },
      nextDueDate: '2026-09-12T08:00:00.000Z', // due today
      escalationCount: 1,
    };
    const task2: RepeatingTask = {
      ...createTaskFromPreset('Car Wash', 'home', 'Weekly'),
      recurrence: { type: 'weekly' },
      nextDueDate: '2026-09-10T10:00:00.000Z', // overdue (2 days late)
      escalationCount: 2,
    };
    const task3: RepeatingTask = {
      ...createTaskFromPreset('Internet Bill', 'bills', 'Monthly'),
      recurrence: { type: 'monthly' },
      nextDueDate: '2026-10-12T10:00:00.000Z', // future (30 days out)
      escalationCount: 0,
    };

    const taskList = [task1, task2, task3];

    // ── 1. BULK DONE FLOW ──
    // Bulk complete only applies to eligible tasks (days <= 0)
    const eligibleForDone = taskList.filter((t) => canCompleteTask(t, { today, maxEarlyDays: 0 }).allowed);
    expect(eligibleForDone).toHaveLength(2); // task1 and task2 eligible, task3 future rejected

    const bulkCompleted = taskList.map((t) => {
      if (canCompleteTask(t, { today, maxEarlyDays: 0 }).allowed) {
        return completeTaskInstance(t, undefined, 'bulk-user');
      }
      return t;
    });

    // Verify task1 (daily) updated properly
    expect(bulkCompleted[0].history).toHaveLength(1);
    expect(bulkCompleted[0].history[0].status).toBe('on_time');
    expect(bulkCompleted[0].escalationCount).toBe(0);
    expect(new Date(bulkCompleted[0].nextDueDate).getTime()).toBeGreaterThan(new Date(task1.nextDueDate).getTime());

    // Verify task2 (weekly, was overdue) updated properly
    expect(bulkCompleted[1].history).toHaveLength(1);
    expect(bulkCompleted[1].history[0].status).toBe('late');
    expect(bulkCompleted[1].escalationCount).toBe(0);
    expect(new Date(bulkCompleted[1].nextDueDate).getTime()).toBeGreaterThan(new Date(task2.nextDueDate).getTime());

    // Verify task3 (future) was not modified
    expect(bulkCompleted[2].history).toHaveLength(0);
    expect(bulkCompleted[2].nextDueDate).toBe(task3.nextDueDate);

    // ── 2. BULK UNDO FLOW ──
    const bulkUndone = bulkCompleted.map((t) => {
      if (t.history && t.history.length > 0) {
        return undoCompleteTaskInstance(t);
      }
      return t;
    });

    expect(bulkUndone[0].history).toHaveLength(0);
    expect(new Date(bulkUndone[0].nextDueDate).getDate()).toBe(new Date(task1.nextDueDate).getDate());
    expect(bulkUndone[1].history).toHaveLength(0);

    // ── 3. BULK SNOOZE FLOW ──
    const snoozeDays = 3;
    const bulkSnoozed = taskList.map((t) => snoozeTaskInstance(t, snoozeDays, 'snooze-user'));

    for (let i = 0; i < bulkSnoozed.length; i++) {
      const snoozed = bulkSnoozed[i];
      expect(snoozed.history).toHaveLength(1);
      expect(snoozed.history[0].status).toBe('snoozed');
      expect(snoozed.history[0].note).toBe('Snoozed by 3 days');
      expect(snoozed.history[0].completedBy).toBe('snooze-user');
      expect(snoozed.snoozedUntil).toBeDefined();
      expect(snoozed.nextDueDate).toBe(snoozed.snoozedUntil);
    }

    // ── 4. BULK SKIP FLOW ──
    const bulkSkipped = taskList.map((t) => skipTaskInstance(t, 'skip-user'));

    for (let i = 0; i < bulkSkipped.length; i++) {
      const skipped = bulkSkipped[i];
      expect(skipped.history).toHaveLength(1);
      expect(skipped.history[0].status).toBe('skipped');
      expect(skipped.history[0].completedBy).toBe('skip-user');
      expect(skipped.snoozedUntil).toBeUndefined();
      expect(skipped.escalationCount).toBe(0);
      expect(new Date(skipped.nextDueDate).getTime()).toBeGreaterThan(new Date(taskList[i].nextDueDate).getTime());
    }

    // ── 5. BULK PIN / UNPIN FLOW ──
    const bulkPinned = taskList.map((t) => toggleTaskPin(t));
    expect(bulkPinned.every((t) => t.pinned === true)).toBe(true);

    const bulkUnpinned = bulkPinned.map((t) => toggleTaskPin(t));
    expect(bulkUnpinned.every((t) => t.pinned === false)).toBe(true);
  });

  describe('mergeTasksLocalAndRemote', () => {
    it('prefers local task when local updatedAt is newer than remote', () => {
      const remoteTask: RepeatingTask = {
        ...createTaskFromPreset('Car Wash', 'vehicle', 'Weekly'),
        id: 'task-car-wash',
        nextDueDate: '2026-09-10T00:00:00.000Z', // Overdue
        history: [],
        updatedAt: '2026-09-10T12:00:00.000Z',
      };

      // User marked done locally
      const localCompletedTask = completeTaskInstance(remoteTask);

      const result = mergeTasksLocalAndRemote([localCompletedTask], [remoteTask]);
      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].id).toBe('task-car-wash');
      expect(result.merged[0].history).toHaveLength(1);
      expect(result.merged[0].history[0].status).toBe('late');
      expect(result.newerLocalTasks).toHaveLength(1);
      expect(result.newerLocalTasks[0].id).toBe('task-car-wash');
    });

    it('prefers remote task when remote updatedAt is newer than local', () => {
      const localTask: RepeatingTask = {
        ...createTaskFromPreset('Rent', 'bills', 'Monthly'),
        id: 'task-rent',
        nextDueDate: '2026-09-15T00:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z',
      };

      const remoteTask: RepeatingTask = {
        ...localTask,
        title: 'Rent (Updated Remotely)',
        updatedAt: '2026-09-12T15:00:00.000Z',
      };

      const result = mergeTasksLocalAndRemote([localTask], [remoteTask]);
      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].title).toBe('Rent (Updated Remotely)');
      expect(result.newerLocalTasks).toHaveLength(0);
    });

    it('preserves local tasks that are missing from remote and tags them in newerLocalTasks', () => {
      const localTask: RepeatingTask = {
        ...createTaskFromPreset('New Offline Task', 'personal', 'Daily'),
        id: 'task-offline-new',
        updatedAt: '2026-09-12T16:00:00.000Z',
      };

      const remoteTask: RepeatingTask = {
        ...createTaskFromPreset('Existing Remote Task', 'bills', 'Monthly'),
        id: 'task-remote-1',
        updatedAt: '2026-09-12T10:00:00.000Z',
      };

      const result = mergeTasksLocalAndRemote([localTask], [remoteTask]);
      expect(result.merged).toHaveLength(2);
      expect(result.merged.map((t) => t.id)).toEqual(['task-offline-new', 'task-remote-1']);
      expect(result.newerLocalTasks).toHaveLength(1);
      expect(result.newerLocalTasks[0].id).toBe('task-offline-new');
    });

    it('resolves ties by favoring task with completion today', () => {
      const nowIso = new Date().toISOString();
      const localWithCompletion: RepeatingTask = {
        ...createTaskFromPreset('Water Plants', 'home', 'Daily'),
        id: 'task-plants',
        history: [{ month: 'Sep', status: 'on_time', completedAt: nowIso }],
        updatedAt: nowIso,
      };

      const remoteWithoutCompletion: RepeatingTask = {
        ...createTaskFromPreset('Water Plants', 'home', 'Daily'),
        id: 'task-plants',
        history: [],
        updatedAt: nowIso,
      };

      const result = mergeTasksLocalAndRemote([localWithCompletion], [remoteWithoutCompletion]);
      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].history).toHaveLength(1);
      expect(result.newerLocalTasks).toHaveLength(1);
    });
  });

  describe('Multi-time / multi-dose tasks', () => {
    it('creates multi-time task with timesPerDay and reminderTimes', () => {
      const values: TaskFormValues = {
        title: 'Paracetamol 650mg',
        category: 'medicines',
        recurrence: { type: 'daily' },
        freq: '3 times a day',
        finance: false,
        reminderTime: '08:00',
        timesPerDay: 3,
        reminderTimes: ['08:00', '14:00', '20:00'],
      };
      const task = createTaskFromFormValues(values);
      expect(task.timesPerDay).toBe(3);
      expect(task.reminderTimes).toEqual(['08:00', '14:00', '20:00']);
      expect(task.frequencyLabel).toBe('3 times a day');

      const progress = getTodayDoseProgress(task);
      expect(progress.totalDoses).toBe(3);
      expect(progress.completedCount).toBe(0);
      expect(progress.nextDoseIndex).toBe(0);
      expect(progress.isAllDone).toBe(false);
      expect(hasCompletedToday(task)).toBe(false);
      expect(canCompleteTask(task).allowed).toBe(true);
    });

    it('completes doses sequentially: 1/3, 2/3, and 3/3 advances nextDueDate', () => {
      const task: RepeatingTask = {
        ...createTaskFromPreset('Daily Vitamins', 'medicines', '3 times a day'),
        recurrence: { type: 'daily' },
        nextDueDate: '2026-09-12T00:00:00.000Z',
        timesPerDay: 3,
        reminderTimes: ['08:00', '14:00', '20:00'],
        reminderTime: '08:00',
      };

      // Dose 1 completed
      const afterDose1 = completeTaskInstance(task, 'Morning dose taken');
      expect(afterDose1.history).toHaveLength(1);
      expect(afterDose1.history[0].doseIndex).toBe(0);
      expect(afterDose1.history[0].doseTime).toBe('08:00');
      expect(afterDose1.reminderTime).toBe('14:00');
      // Still due today because only 1 of 3 doses is completed
      expect(daysUntilDue(afterDose1.nextDueDate, new Date('2026-09-12T10:00:00.000Z'))).toBe(0);
      expect(hasCompletedToday(afterDose1)).toBe(false);
      expect(canCompleteTask(afterDose1).allowed).toBe(true);

      const progress1 = getTodayDoseProgress(afterDose1);
      expect(progress1.completedCount).toBe(1);
      expect(progress1.nextDoseIndex).toBe(1);
      expect(progress1.isAllDone).toBe(false);

      // Dose 2 completed
      const afterDose2 = completeTaskInstance(afterDose1, 'Afternoon dose taken');
      expect(afterDose2.history).toHaveLength(2);
      expect(afterDose2.history[1].doseIndex).toBe(1);
      expect(afterDose2.history[1].doseTime).toBe('14:00');
      expect(afterDose2.reminderTime).toBe('20:00');
      expect(daysUntilDue(afterDose2.nextDueDate, new Date('2026-09-12T10:00:00.000Z'))).toBe(0);
      expect(hasCompletedToday(afterDose2)).toBe(false);
      expect(canCompleteTask(afterDose2).allowed).toBe(true);

      const progress2 = getTodayDoseProgress(afterDose2);
      expect(progress2.completedCount).toBe(2);
      expect(progress2.nextDoseIndex).toBe(2);
      expect(progress2.isAllDone).toBe(false);

      // Dose 3 completed (All 3 done!)
      const afterDose3 = completeTaskInstance(afterDose2, 'Night dose taken');
      expect(afterDose3.history).toHaveLength(3);
      expect(afterDose3.history[2].doseIndex).toBe(2);
      expect(afterDose3.history[2].doseTime).toBe('20:00');
      expect(afterDose3.reminderTime).toBe('08:00');
      // All doses completed today -> advances to tomorrow
      expect(daysUntilDue(afterDose3.nextDueDate, new Date('2026-09-12T10:00:00.000Z'))).toBe(1);
      expect(hasCompletedToday(afterDose3)).toBe(true);
      expect(canCompleteTask(afterDose3).allowed).toBe(false);

      const progress3 = getTodayDoseProgress(afterDose3);
      expect(progress3.completedCount).toBe(3);
      expect(progress3.isAllDone).toBe(true);

      // Undoing dose 3 restores the task to pending today with 2 of 3 completed
      const undone = undoCompleteTaskInstance(afterDose3);
      expect(undone.history).toHaveLength(2);
      expect(daysUntilDue(undone.nextDueDate, new Date('2026-09-12T10:00:00.000Z'))).toBe(0);
      expect(hasCompletedToday(undone)).toBe(false);
      expect(canCompleteTask(undone).allowed).toBe(true);
      const undoneProgress = getTodayDoseProgress(undone);
      expect(undoneProgress.completedCount).toBe(2);
      expect(undoneProgress.nextDoseIndex).toBe(2);
    });

    it('updateTaskDetails preserves and updates multi-time configuration', () => {
      const task: RepeatingTask = {
        ...createTaskFromPreset('Water Intake', 'health', 'Daily'),
        recurrence: { type: 'daily' },
        timesPerDay: 2,
        reminderTimes: ['08:00', '18:00'],
      };

      const updated = updateTaskDetails(task, {
        title: 'Water Intake (Hydrate)',
        category: 'health',
        recurrence: { type: 'daily' },
        freq: '4 times a day',
        finance: false,
        reminderTime: '08:00',
        timesPerDay: 4,
        reminderTimes: ['08:00', '12:00', '16:00', '20:00'],
      });

      expect(updated.title).toBe('Water Intake (Hydrate)');
      expect(updated.timesPerDay).toBe(4);
      expect(updated.reminderTimes).toEqual(['08:00', '12:00', '16:00', '20:00']);
      expect(updated.frequencyLabel).toBe('4 times a day');
    });

    it('handles out-of-order dose completions (e.g. Dose 2 taken before Dose 1)', () => {
      const task: RepeatingTask = {
        ...createTaskFromPreset('Daily Eye Drops', 'health', '3 times a day'),
        recurrence: { type: 'daily' },
        nextDueDate: '2026-09-12T00:00:00.000Z',
        timesPerDay: 3,
        reminderTimes: ['08:00', '14:00', '20:00'],
        reminderTime: '08:00',
      };

      // User takes Dose 2 (index 1) first
      const afterDose2 = completeTaskInstance(task, 'Afternoon dose taken first', undefined, 1);
      expect(afterDose2.history).toHaveLength(1);
      expect(afterDose2.history[0].doseIndex).toBe(1);
      expect(afterDose2.history[0].doseTime).toBe('14:00');
      // Next pending dose should now be Dose 1 (index 0)
      const progress = getTodayDoseProgress(afterDose2);
      expect(progress.completedCount).toBe(1);
      expect(progress.completedIndices).toEqual([1]);
      expect(progress.nextDoseIndex).toBe(0);
      expect(afterDose2.reminderTime).toBe('08:00');
      expect(hasCompletedToday(afterDose2)).toBe(false);

      // Now user takes Dose 1 (index 0)
      const afterDose1 = completeTaskInstance(afterDose2, 'Morning dose taken late', undefined, 0);
      expect(afterDose1.history).toHaveLength(2);
      expect(afterDose1.history[1].doseIndex).toBe(0);
      const progress2 = getTodayDoseProgress(afterDose1);
      expect(progress2.completedCount).toBe(2);
      expect(progress2.completedIndices).toContain(0);
      expect(progress2.completedIndices).toContain(1);
      expect(progress2.nextDoseIndex).toBe(2);
      expect(afterDose1.reminderTime).toBe('20:00');

      // Now user takes Dose 3 (index 2) -> all done today!
      const afterDose3 = completeTaskInstance(afterDose1, 'Night dose taken', undefined, 2);
      expect(afterDose3.history).toHaveLength(3);
      expect(getTodayDoseProgress(afterDose3).isAllDone).toBe(true);
      expect(hasCompletedToday(afterDose3)).toBe(true);
      expect(daysUntilDue(afterDose3.nextDueDate, new Date('2026-09-12T10:00:00.000Z'))).toBe(1);
      expect(afterDose3.reminderTime).toBe('08:00');
    });

    it('ignores duplicate or already-completed specificDoseIndex without double counting', () => {
      const task: RepeatingTask = {
        ...createTaskFromPreset('Iron Supplement', 'health', '2 times a day'),
        recurrence: { type: 'daily' },
        nextDueDate: '2026-09-12T00:00:00.000Z',
        timesPerDay: 2,
        reminderTimes: ['09:00', '21:00'],
      };

      // Take Dose 1
      const step1 = completeTaskInstance(task, 'Dose 1', undefined, 0);
      expect(getTodayDoseProgress(step1).completedCount).toBe(1);

      // Erroneously call complete on Dose 1 again
      const step2 = completeTaskInstance(step1, 'Dose 1 again', undefined, 0);
      // It should gracefully pick the remaining pending dose (index 1)
      expect(step2.history[1].doseIndex).toBe(1);
      const progress = getTodayDoseProgress(step2);
      expect(progress.completedCount).toBe(2);
      expect(progress.isAllDone).toBe(true);
    });

    it('handles out-of-range specificDoseIndex gracefully (-1, 99)', () => {
      const task: RepeatingTask = {
        ...createTaskFromPreset('Multivitamin', 'health', '2 times a day'),
        recurrence: { type: 'daily' },
        nextDueDate: '2026-09-12T00:00:00.000Z',
        timesPerDay: 2,
        reminderTimes: ['09:00', '21:00'],
      };

      // Pass out-of-range index 99
      const step1 = completeTaskInstance(task, 'Test 99', undefined, 99);
      expect(step1.history[0].doseIndex).toBe(0); // Safely defaulted to next pending dose (0)

      // Pass negative index -1
      const step2 = completeTaskInstance(step1, 'Test -1', undefined, -1);
      expect(step2.history[1].doseIndex).toBe(1); // Safely defaulted to next pending dose (1)
      expect(getTodayDoseProgress(step2).isAllDone).toBe(true);
    });

    it('skipping multi-dose task resets reminderTime to dose 1, and undoing skip restores pending dose reminderTime', () => {
      const task: RepeatingTask = {
        ...createTaskFromPreset('Blood Pressure Med', 'health', '3 times a day'),
        recurrence: { type: 'daily' },
        nextDueDate: '2026-09-12T00:00:00.000Z',
        timesPerDay: 3,
        reminderTimes: ['08:00', '14:00', '20:00'],
        reminderTime: '08:00',
      };

      // Complete dose 1
      const afterDose1 = completeTaskInstance(task, 'Morning taken');
      expect(afterDose1.reminderTime).toBe('14:00');

      // User skips the rest of today's schedule
      const skipped = skipTaskInstance(afterDose1, 'user-1');
      expect(skipped.history).toHaveLength(2);
      expect(skipped.history[1].status).toBe('skipped');
      expect(daysUntilDue(skipped.nextDueDate, new Date('2026-09-12T10:00:00.000Z'))).toBe(1);
      // For tomorrow, reminder time resets back to dose 1 (08:00)
      expect(skipped.reminderTime).toBe('08:00');

      // User undoes the skip
      const unskipped = undoSkipTask(skipped);
      expect(unskipped.history).toHaveLength(1);
      expect(daysUntilDue(unskipped.nextDueDate, new Date('2026-09-12T10:00:00.000Z'))).toBe(0);
      // Reminder time restores back to pending Dose 2 (14:00)
      expect(unskipped.reminderTime).toBe('14:00');
    });

    it('handles overdue multi-dose task completion and undo properly', () => {
      const task: RepeatingTask = {
        ...createTaskFromPreset('Antibiotic', 'health', '2 times a day'),
        recurrence: { type: 'daily' },
        nextDueDate: '2026-09-10T00:00:00.000Z', // 2 days overdue relative to 2026-09-12
        timesPerDay: 2,
        reminderTimes: ['09:00', '21:00'],
        reminderTime: '09:00',
      };

      // Take Dose 1 today
      const afterDose1 = completeTaskInstance(task, 'Dose 1 taken late');
      expect(afterDose1.history).toHaveLength(1);
      expect(afterDose1.history[0].previousDueDate).toBe('2026-09-10T00:00:00.000Z');
      // Task is now active today for dose 2
      expect(daysUntilDue(afterDose1.nextDueDate, new Date('2026-09-12T10:00:00.000Z'))).toBe(0);

      // Undoing dose 1 restores exact overdue date
      const undone = undoCompleteTaskInstance(afterDose1);
      expect(undone.nextDueDate).toBe('2026-09-10T00:00:00.000Z');

      // Completing all doses on overdue task advances to tomorrow (2026-09-13), not yesterday
      const step1 = completeTaskInstance(undone);
      const step2 = completeTaskInstance(step1);
      expect(getTodayDoseProgress(step2).isAllDone).toBe(true);
      expect(daysUntilDue(step2.nextDueDate, new Date('2026-09-12T10:00:00.000Z'))).toBe(1);
    });

    it('normalizes missing or short reminderTimes array seamlessly', () => {
      const normalized2 = normalizeReminderTimes(2, []);
      expect(normalized2).toEqual(['08:00', '20:00']);

      const normalized3 = normalizeReminderTimes(3, ['07:00']);
      expect(normalized3).toEqual(['07:00', '14:00', '20:00']);

      const normalized5 = normalizeReminderTimes(5, ['06:00', '09:00']);
      expect(normalized5).toEqual(['06:00', '09:00', '13:00', '17:00', '21:00']);

      const single = normalizeReminderTimes(1, ['11:00']);
      expect(single).toEqual(['11:00']);

      // Task with missing reminderTimes still computes progress cleanly
      const partialTask: RepeatingTask = {
        ...createTaskFromPreset('Hydration', 'health', '3 times a day'),
        recurrence: { type: 'daily' },
        timesPerDay: 3,
        reminderTimes: undefined,
      };
      const progress = getTodayDoseProgress(partialTask);
      expect(progress.totalDoses).toBe(3);
      expect(progress.times).toEqual(['08:00', '14:00', '20:00']);
    });

    it('isolates today dose progress from previous days history entries', () => {
      const task: RepeatingTask = {
        ...createTaskFromPreset('Allergy Medicine', 'health', '2 times a day'),
        recurrence: { type: 'daily' },
        nextDueDate: '2026-09-12T00:00:00.000Z',
        timesPerDay: 2,
        reminderTimes: ['08:00', '20:00'],
        history: [
          {
            month: 'Sep 2026',
            status: 'on_time',
            completedAt: '2026-09-11T10:00:00.000Z', // Yesterday dose 1
            doseIndex: 0,
            doseTime: '08:00',
          },
          {
            month: 'Sep 2026',
            status: 'on_time',
            completedAt: '2026-09-11T12:00:00.000Z', // Yesterday dose 2
            doseIndex: 1,
            doseTime: '20:00',
          },
        ],
      };

      // Today (2026-09-12) is completely fresh
      const progress = getTodayDoseProgress(task, new Date('2026-09-12T10:00:00.000Z'));
      expect(progress.completedCount).toBe(0);
      expect(progress.completedIndices).toEqual([]);
      expect(progress.nextDoseIndex).toBe(0);
      expect(hasCompletedToday(task, new Date('2026-09-12T10:00:00.000Z'))).toBe(false);
      expect(canCompleteTask(task, { today: new Date('2026-09-12T10:00:00.000Z') }).allowed).toBe(true);
    });

    it('mergeTasksLocalAndRemote preserves multi-dose task configuration and completion history', () => {
      const localTask: RepeatingTask = {
        ...createTaskFromPreset('Calcium Tablet', 'health', '2 times a day'),
        id: 'task-calcium',
        recurrence: { type: 'daily' },
        nextDueDate: '2026-09-12T00:00:00.000Z',
        timesPerDay: 2,
        reminderTimes: ['09:00', '21:00'],
        history: [
          {
            month: 'Sep 2026',
            status: 'on_time',
            completedAt: '2026-09-12T09:05:00.000Z',
            doseIndex: 0,
            doseTime: '09:00',
          },
        ],
        updatedAt: '2026-09-12T09:06:00.000Z',
      };

      const remoteTask: RepeatingTask = {
        ...localTask,
        history: [],
        updatedAt: '2026-09-12T08:00:00.000Z',
      };

      const result = mergeTasksLocalAndRemote([localTask], [remoteTask]);
      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].timesPerDay).toBe(2);
      expect(result.merged[0].history).toHaveLength(1);
      expect(result.merged[0].history[0].doseIndex).toBe(0);
      expect(result.newerLocalTasks).toHaveLength(1);
    });
  });

  // ─── isOverdueToday ────────────────────────────────────────────────────────
  describe('isOverdueToday', () => {
    // The outer beforeEach pins time to 2026-09-12T10:00:00.000Z (UTC),
    // which is 15:30 IST — well past 09:00 local.
    // We work in local calendar date helpers, so we construct dates using local time.

    function makeTask(overrides: Partial<RepeatingTask> = {}): RepeatingTask {
      const todayLocal = new Date();
      // Build a nextDueDate that is today (midnight local)
      const todayMidnight = new Date(
        todayLocal.getFullYear(),
        todayLocal.getMonth(),
        todayLocal.getDate(),
        0, 0, 0, 0
      );
      return {
        id: 'test-overdue',
        title: 'Test Task',
        category: 'home',
        householdId: null,
        recurrence: { type: 'daily' },
        frequencyLabel: 'Every day',
        nextDueDate: todayMidnight.toISOString(),
        finance: false,
        sharedWith: [],
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        escalationCount: 0,
        ...overrides,
      };
    }

    it('returns false when current time is before the reminderTime', () => {
      // System time is 10:00 UTC (15:30 IST). We explicitly pass a "now" at 08:00 local.
      const earlyNow = new Date();
      earlyNow.setHours(8, 0, 0, 0);
      const task = makeTask({ reminderTime: '09:00' });
      expect(isOverdueToday(task, earlyNow)).toBe(false);
    });

    it('returns true when current time is past the reminderTime and task not completed', () => {
      const lateNow = new Date();
      lateNow.setHours(10, 30, 0, 0); // 10:30 local — past 09:00
      const task = makeTask({ reminderTime: '09:00' });
      expect(isOverdueToday(task, lateNow)).toBe(true);
    });

    it('returns true exactly at the reminderTime (boundary — inclusive)', () => {
      const exactNow = new Date();
      exactNow.setHours(9, 0, 0, 0);
      const task = makeTask({ reminderTime: '09:00' });
      expect(isOverdueToday(task, exactNow)).toBe(true);
    });

    it('defaults to 09:00 when reminderTime is not set, and marks overdue after 09:00', () => {
      const afterNineNow = new Date();
      afterNineNow.setHours(9, 30, 0, 0);
      const task = makeTask({ reminderTime: undefined });
      expect(isOverdueToday(task, afterNineNow)).toBe(true);
    });

    it('defaults to 09:00 when reminderTime is not set, and NOT overdue before 09:00', () => {
      const beforeNineNow = new Date();
      beforeNineNow.setHours(8, 59, 0, 0);
      const task = makeTask({ reminderTime: undefined });
      expect(isOverdueToday(task, beforeNineNow)).toBe(false);
    });

    it('returns false when task is already completed today', () => {
      const lateNow = new Date();
      lateNow.setHours(12, 0, 0, 0);
      const task = makeTask({
        reminderTime: '09:00',
        history: [
          {
            month: 'Sep 2026',
            status: 'on_time',
            completedAt: lateNow.toISOString(),
          },
        ],
      });
      expect(isOverdueToday(task, lateNow)).toBe(false);
    });

    it('returns false when task nextDueDate is tomorrow', () => {
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const task = makeTask({ nextDueDate: tomorrow.toISOString(), reminderTime: '09:00' });
      expect(isOverdueToday(task, now)).toBe(false);
    });

    it('returns false when task nextDueDate is yesterday (already in overdue group)', () => {
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const task = makeTask({ nextDueDate: yesterday.toISOString(), reminderTime: '09:00' });
      expect(isOverdueToday(task, now)).toBe(false);
    });

    it('respects custom reminderTime — not overdue at 10:00 when scheduled for 14:00', () => {
      const tenAM = new Date();
      tenAM.setHours(10, 0, 0, 0);
      const task = makeTask({ reminderTime: '14:00' });
      expect(isOverdueToday(task, tenAM)).toBe(false);
    });

    it('respects custom reminderTime — overdue at 15:00 when scheduled for 14:00', () => {
      const threePM = new Date();
      threePM.setHours(15, 0, 0, 0);
      const task = makeTask({ reminderTime: '14:00' });
      expect(isOverdueToday(task, threePM)).toBe(true);
    });
  });
});
