import { describe, expect, it } from 'vitest';
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
} from '@/domain/task';
import type { RepeatingTask } from '@/types';
import type { TaskFormValues } from '@/domain/taskForm';

describe('domain/task', () => {
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
});
