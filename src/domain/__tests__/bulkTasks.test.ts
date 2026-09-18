import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  canCompleteTask,
  completeTaskInstance,
  createTaskFromPreset,
  skipTaskInstance,
  snoozeTaskInstance,
  toggleTaskPin,
  undoCompleteTaskInstance,
  undoSkipTask,
} from '@/domain/task';
import type { RepeatingTask } from '@/types';

describe('Bulk Tasks End-to-End Flows (Done, Snooze, Skip, Undo, Pin)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockTasks = (): RepeatingTask[] => {
    const t1: RepeatingTask = {
      ...createTaskFromPreset('Pay Utility Bill', 'bills', 'Monthly'),
      id: 'task-1',
      recurrence: { type: 'monthly' },
      nextDueDate: '2026-09-12T00:00:00.000Z', // due today
      escalationCount: 2,
      pinned: false,
    };
    const t2: RepeatingTask = {
      ...createTaskFromPreset('Water Plants', 'home', 'Daily'),
      id: 'task-2',
      recurrence: { type: 'daily' },
      nextDueDate: '2026-09-11T00:00:00.000Z', // overdue (yesterday)
      escalationCount: 1,
      pinned: true,
    };
    const t3: RepeatingTask = {
      ...createTaskFromPreset('Filter Change', 'home', 'Every 3 months'),
      id: 'task-3',
      recurrence: { type: 'interval', interval: 3, intervalUnit: 'months' },
      nextDueDate: '2026-10-15T00:00:00.000Z', // future (33 days away)
      escalationCount: 0,
      pinned: false,
    };
    return [t1, t2, t3];
  };

  it('1. Bulk DONE flow: marks eligible tasks done, resets escalation, clears snooze, advances nextDueDate, and ignores future tasks', () => {
    const tasks = createMockTasks();
    const today = new Date('2026-09-12T12:00:00.000Z');

    // Simulate bulk complete with business eligibility guard
    const updated = tasks.map((task) => {
      const eligibility = canCompleteTask(task, { today, maxEarlyDays: 0 });
      if (eligibility.allowed) {
        return completeTaskInstance(task, 'Bulk completed', 'user-alpha');
      }
      return task;
    });

    // Task 1: Due today -> marked complete
    expect(updated[0].history).toHaveLength(1);
    expect(updated[0].history[0].status).toBe('on_time');
    expect(updated[0].history[0].note).toBe('Bulk completed');
    expect(updated[0].history[0].completedBy).toBe('user-alpha');
    expect(updated[0].escalationCount).toBe(0);
    expect(updated[0].snoozedUntil).toBeUndefined();
    expect(new Date(updated[0].nextDueDate).getMonth()).toBe(9); // Advanced from Sep (month 8) to Oct (month 9)

    // Task 2: Overdue -> marked complete as late
    expect(updated[1].history).toHaveLength(1);
    expect(updated[1].history[0].status).toBe('late');
    expect(updated[1].history[0].note).toBe('Bulk completed');
    expect(updated[1].history[0].completedBy).toBe('user-alpha');
    expect(updated[1].escalationCount).toBe(0);
    expect(new Date(updated[1].nextDueDate).getTime()).toBeGreaterThan(new Date(tasks[1].nextDueDate).getTime());

    // Task 3: Future task -> ignored, untouched
    expect(updated[2].history).toHaveLength(0);
    expect(updated[2].nextDueDate).toBe(tasks[2].nextDueDate);
    expect(updated[2].escalationCount).toBe(0);
  });

  it('2. Bulk SNOOZE flow: snoozes multiple tasks, sets snoozedUntil, and logs snoozed history entry', () => {
    const tasks = createMockTasks();
    const snoozeDays = 3;

    const updated = tasks.map((task) => snoozeTaskInstance(task, snoozeDays, 'user-alpha'));

    // Check all tasks
    for (let i = 0; i < updated.length; i++) {
      const orig = tasks[i];
      const snoozed = updated[i];

      expect(snoozed.history).toHaveLength(1);
      expect(snoozed.history[0].status).toBe('snoozed');
      expect(snoozed.history[0].note).toBe(`Snoozed by ${snoozeDays} days`);
      expect(snoozed.history[0].completedBy).toBe('user-alpha');
      expect(snoozed.snoozedUntil).toBeDefined();
      expect(snoozed.nextDueDate).toBe(snoozed.snoozedUntil);

      // Verify date math: new date is ahead of original due date
      expect(new Date(snoozed.nextDueDate).getTime()).toBeGreaterThan(new Date(orig.nextDueDate).getTime());
    }
  });

  it('3. Bulk SKIP flow: advances recurrence for all tasks, clears snooze, resets escalation, and logs skipped history', () => {
    const tasks = createMockTasks();
    // Pre-set snooze on task 1 to verify skip clears it
    tasks[0].snoozedUntil = '2026-09-15T00:00:00.000Z';

    const updated = tasks.map((task) => skipTaskInstance(task, 'user-alpha'));

    for (let i = 0; i < updated.length; i++) {
      const orig = tasks[i];
      const skipped = updated[i];

      expect(skipped.history).toHaveLength(1);
      expect(skipped.history[0].status).toBe('skipped');
      expect(skipped.history[0].completedBy).toBe('user-alpha');
      expect(skipped.escalationCount).toBe(0);
      expect(skipped.snoozedUntil).toBeUndefined(); // Cleared snooze
      expect(new Date(skipped.nextDueDate).getTime()).toBeGreaterThan(new Date(orig.nextDueDate).getTime());
    }
  });

  it('4. Bulk UNDO flow: reverts completions across tasks and accurately rolls back nextDueDate to original cycle', () => {
    const tasks = createMockTasks();
    const today = new Date('2026-09-12T12:00:00.000Z');

    // 1. Mark done
    const completedTasks = tasks.map((task) => {
      const eligibility = canCompleteTask(task, { today, maxEarlyDays: 0 });
      if (eligibility.allowed) {
        return completeTaskInstance(task, 'Done for now', 'user-alpha');
      }
      return task;
    });

    // 2. Perform bulk undo on completed tasks
    const undoneTasks = completedTasks.map((task) => {
      if (task.history && task.history.length > 0) {
        return undoCompleteTaskInstance(task);
      }
      return task;
    });

    // Task 1: History removed, nextDueDate rolled back to original Sep 12
    expect(undoneTasks[0].history).toHaveLength(0);
    expect(new Date(undoneTasks[0].nextDueDate).getMonth()).toBe(new Date(tasks[0].nextDueDate).getMonth());
    expect(new Date(undoneTasks[0].nextDueDate).getDate()).toBe(new Date(tasks[0].nextDueDate).getDate());

    // Task 2: History removed, nextDueDate rolled back from tomorrow (Sep 13) to original overdue cycle (Sep 11)
    expect(undoneTasks[1].history).toHaveLength(0);
    expect(new Date(undoneTasks[1].nextDueDate).getDate()).toBe(11);

    // Task 3: Remained untouched
    expect(undoneTasks[2].history).toHaveLength(0);
    expect(undoneTasks[2].nextDueDate).toBe(tasks[2].nextDueDate);
  });

  it('5. Bulk Undo Skip flow: reverts skipped status and rolls back nextDueDate to original cycle', () => {
    // Tasks due today or in the future
    const tasks: RepeatingTask[] = [
      {
        ...createTaskFromPreset('Pay Utility Bill', 'bills', 'Monthly'),
        id: 'task-1',
        recurrence: { type: 'monthly' },
        nextDueDate: '2026-09-12T00:00:00.000Z',
      },
      {
        ...createTaskFromPreset('Water Plants', 'home', 'Daily'),
        id: 'task-2',
        recurrence: { type: 'daily' },
        nextDueDate: '2026-09-12T00:00:00.000Z',
      },
      {
        ...createTaskFromPreset('Filter Change', 'home', 'Every 3 months'),
        id: 'task-3',
        recurrence: { type: 'interval', interval: 3, intervalUnit: 'months' },
        nextDueDate: '2026-10-15T00:00:00.000Z',
      },
    ];

    // 1. Bulk skip
    const skippedTasks = tasks.map((task) => skipTaskInstance(task, 'user-alpha'));

    // 2. Bulk undo skip
    const undoneTasks = skippedTasks.map((task) => undoSkipTask(task));

    for (let i = 0; i < undoneTasks.length; i++) {
      expect(undoneTasks[i].history).toHaveLength(0);
      expect(new Date(undoneTasks[i].nextDueDate).getDate()).toBe(new Date(tasks[i].nextDueDate).getDate());
      expect(new Date(undoneTasks[i].nextDueDate).getMonth()).toBe(new Date(tasks[i].nextDueDate).getMonth());
    }
  });

  it('6. Bulk PIN / UNPIN flow: toggles pin status across tasks while preserving all task details', () => {
    const tasks = createMockTasks();
    const originalPinnedStates = tasks.map((t) => !!t.pinned);

    // Toggle pin on all tasks
    const toggled1 = tasks.map((t) => toggleTaskPin(t));
    for (let i = 0; i < toggled1.length; i++) {
      expect(toggled1[i].pinned).toBe(!originalPinnedStates[i]);
      // Verify other fields are fully preserved
      expect(toggled1[i].id).toBe(tasks[i].id);
      expect(toggled1[i].title).toBe(tasks[i].title);
      expect(toggled1[i].recurrence).toEqual(tasks[i].recurrence);
      expect(toggled1[i].nextDueDate).toBe(tasks[i].nextDueDate);
    }

    // Toggle pin back
    const toggled2 = toggled1.map((t) => toggleTaskPin(t));
    for (let i = 0; i < toggled2.length; i++) {
      expect(toggled2[i].pinned).toBe(originalPinnedStates[i]);
    }
  });
});
