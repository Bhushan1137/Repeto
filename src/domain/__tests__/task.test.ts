import { describe, expect, it } from 'vitest';
import {
  archiveTask,
  canAddTask,
  canShareWith,
  capTasksForPlan,
  cleanupTasksOnRemoval,
  completeTaskInstance,
  createTaskId,
  createTaskFromFormValues,
  createTaskFromParsed,
  createTaskFromPreset,
  duplicateTask,
  restoreTask,
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

    const snoozed = snoozeTaskInstance(task, 3, 'UserA');
    expect(snoozed.snoozedUntil).toBeDefined();
    expect(snoozed.history[0].status).toBe('snoozed');

    const skipped = skipTaskInstance(task, 'UserB');
    expect(skipped.history[0].status).toBe('skipped');
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
});
