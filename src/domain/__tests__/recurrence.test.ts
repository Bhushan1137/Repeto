import { describe, expect, it } from 'vitest';
import {
  parseFrequencyLabel,
  computeNextDueDate,
  computeInitialDueDate,
  daysUntilDue,
  getTaskGroup,
} from '@/domain/recurrence';
import {
  canAddTask,
  capTasksForPlan,
  createTaskFromPreset,
  createTaskFromFormValues,
  completeTaskInstance,
  skipTaskInstance,
  FREE_TASK_LIMIT,
} from '@/domain/task';
import type { UserProfile } from '@/types';

const freeUser: UserProfile = {
  id: 'u1',
  name: 'Test',
  email: 'test@example.com',
  phone: '+91 9999999999',
  language: 'en',
  pushOptIn: true,
  profileComplete: true,
  onboardingComplete: true,
  plan: 'free',
};

describe('parseFrequencyLabel', () => {
  it('parses every N days', () => {
    expect(parseFrequencyLabel('Every 30 days')).toEqual({
      type: 'interval',
      interval: 30,
      intervalUnit: 'days',
    });
  });

  it('parses every N months', () => {
    expect(parseFrequencyLabel('Every 6 months')).toEqual({
      type: 'interval',
      interval: 6,
      intervalUnit: 'months',
    });
  });

  it('parses every 12 months as yearly', () => {
    expect(parseFrequencyLabel('Every 12 months')).toEqual({ type: 'yearly' });
  });

  it('parses nth weekday', () => {
    const rule = parseFrequencyLabel('Every 2nd Saturday');
    expect(rule.type).toBe('nthWeekday');
    expect(rule.nthWeekday).toBe(2);
    expect(rule.weekday).toBe(6);
  });

  it('parses month day', () => {
    expect(parseFrequencyLabel('Every 5th of month')).toEqual({
      type: 'monthDay',
      dayOfMonth: 5,
    });
  });
});

describe('computeNextDueDate', () => {
  it('adds interval days', () => {
    const from = new Date('2026-07-01T12:00:00Z');
    const rule = parseFrequencyLabel('Every 30 days');
    const next = new Date(computeNextDueDate(rule, from));
    expect(next.getDate()).toBe(31);
  });

  it('adds interval months', () => {
    const from = new Date('2026-01-15T12:00:00Z');
    const rule = parseFrequencyLabel('Every 6 months');
    const next = new Date(computeNextDueDate(rule, from));
    expect(next.getMonth()).toBe(6); // July (0-indexed)
  });

  it('preserves scheduled weekday when completed on that weekday', () => {
    // 2026-09-13 is Sunday (day 0)
    const from = new Date('2026-09-13T10:00:00Z');
    const rule = { type: 'weekly' as const, weekday: 0 };
    const next = new Date(computeNextDueDate(rule, from));
    expect(next.getDay()).toBe(0);
    expect(next.getDate()).toBe(20);
  });

  it('preserves scheduled weekday when completed overdue on a different weekday', () => {
    // Completed overdue on Thursday (2026-09-17, day 4), but rule is Sunday (day 0)
    const from = new Date('2026-09-17T10:00:00Z');
    const rule = { type: 'weekly' as const, weekday: 0 };
    const next = new Date(computeNextDueDate(rule, from));
    // Must advance to next Sunday (2026-09-20), not next Thursday!
    expect(next.getDay()).toBe(0);
    expect(next.getDate()).toBe(20);
  });
});

describe('computeInitialDueDate', () => {
  it('considers task due today when scheduled time is in the future today', () => {
    // Current time is 12:00 PM on 2026-09-12
    const now = new Date(2026, 8, 12, 12, 0, 0);
    const rule = { type: 'daily' as const };
    // Task scheduled for 1:00 PM (13:00) today
    const res = computeInitialDueDate(rule, '2026-09-12', '13:00', now);
    const dueDate = new Date(res);
    expect(dueDate.getFullYear()).toBe(2026);
    expect(dueDate.getMonth()).toBe(8);
    expect(dueDate.getDate()).toBe(12);
  });

  it('rolls over to tomorrow when scheduled time has already passed today', () => {
    // Current time is 1:30 PM on 2026-09-12
    const now = new Date(2026, 8, 12, 13, 30, 0);
    const rule = { type: 'daily' as const };
    // Task scheduled for 1:00 PM (13:00) today
    const res = computeInitialDueDate(rule, '2026-09-12', '13:00', now);
    const dueDate = new Date(res);
    expect(dueDate.getDate()).toBe(13);
  });

  it('preserves future start dates', () => {
    const now = new Date(2026, 8, 12, 12, 0, 0);
    const rule = { type: 'daily' as const };
    const res = computeInitialDueDate(rule, '2026-09-15', '10:00', now);
    const dueDate = new Date(res);
    expect(dueDate.getDate()).toBe(15);
  });

  it('considers weekly task due today when today matches weekday and time is future', () => {
    // 2026-09-12 is Saturday (getDay() === 6)
    const now = new Date(2026, 8, 12, 12, 0, 0);
    const rule = { type: 'weekly' as const, weekday: 6 };
    const res = computeInitialDueDate(rule, '2026-09-12', '13:00', now);
    const dueDate = new Date(res);
    expect(dueDate.getDate()).toBe(12);
  });

  it('advances weekly task by 7 days when today matches weekday but time has passed', () => {
    const now = new Date(2026, 8, 12, 14, 0, 0);
    const rule = { type: 'weekly' as const, weekday: 6 };
    const res = computeInitialDueDate(rule, '2026-09-12', '13:00', now);
    const dueDate = new Date(res);
    expect(dueDate.getDate()).toBe(19);
  });
});

describe('daysUntilDue', () => {
  it('returns 0 for today', () => {
    const today = new Date('2026-07-03T15:00:00Z');
    expect(daysUntilDue('2026-07-03T00:00:00Z', today)).toBe(0);
  });
});

describe('getTaskGroup', () => {
  it('classifies overdue', () => {
    expect(getTaskGroup(-1)).toBe('overdue');
  });
  it('classifies today', () => {
    expect(getTaskGroup(0)).toBe('today');
  });
  it('classifies week for <= 7 days', () => {
    expect(getTaskGroup(3)).toBe('week');
    expect(getTaskGroup(7)).toBe('week');
  });
  it('classifies month for 8 to 30 days', () => {
    expect(getTaskGroup(8)).toBe('month');
    expect(getTaskGroup(25)).toBe('month');
    expect(getTaskGroup(30)).toBe('month');
  });
  it('classifies later for > 30 days (such as 136 and 175 days)', () => {
    expect(getTaskGroup(31)).toBe('later');
    expect(getTaskGroup(136)).toBe('later');
    expect(getTaskGroup(175)).toBe('later');
  });
});

describe('free tier limits', () => {
  it('does not block tasks (unlimited)', () => {
    expect(canAddTask(freeUser, FREE_TASK_LIMIT)).toBe(true);
    expect(canAddTask(freeUser, FREE_TASK_LIMIT + 10)).toBe(true);
  });

  it('does not cap onboarding presets (unlimited)', () => {
    const items = Array.from({ length: 14 }, (_, i) => i);
    expect(capTasksForPlan(freeUser, items)).toHaveLength(14);
  });
});

describe('createTaskFromPreset', () => {
  it('starts with empty history', () => {
    const task = createTaskFromPreset('Test', 'bills', 'Every 6 months');
    expect(task.history).toEqual([]);
    expect(task.recurrence.intervalUnit).toBe('months');
    expect(task.recurrence.interval).toBe(6);
  });
});

describe('task actions and start date fixes', () => {
  it('creates task starting from selected startDate', () => {
    const startDate = '2026-08-10';
    const task = createTaskFromFormValues({
      title: 'Custom Start Task',
      category: 'medicines',
      recurrence: { type: 'monthly' },
      freq: 'monthly',
      finance: false,
      startDate,
    });
    // For monthly, next due date is 1 month from start date (2026-09-10)
    const nextDate = new Date(task.nextDueDate);
    expect(nextDate.getFullYear()).toBe(2026);
    expect(nextDate.getMonth()).toBe(8); // September (0-indexed)
    expect(nextDate.getDate()).toBe(10);
    expect(task.startDate).toBe(startDate);
  });

  it('advances nextDueDate relative to current nextDueDate on early completion', () => {
    const futureDueDate = new Date();
    futureDueDate.setDate(futureDueDate.getDate() + 15); // due in 15 days
    const task = createTaskFromPreset('Early Done Task', 'medicines', 'Everyday');
    task.nextDueDate = futureDueDate.toISOString();
    task.recurrence = { type: 'daily' };

    const completed = completeTaskInstance(task);
    // Next due date should be 1 day after the current futureDueDate, not 1 day after today
    const nextDate = new Date(completed.nextDueDate);
    const expected = new Date(futureDueDate);
    expected.setDate(expected.getDate() + 1);

    expect(nextDate.getFullYear()).toBe(expected.getFullYear());
    expect(nextDate.getMonth()).toBe(expected.getMonth());
    expect(nextDate.getDate()).toBe(expected.getDate());
  });

  it('advances nextDueDate relative to current nextDueDate on early skip', () => {
    const futureDueDate = new Date();
    futureDueDate.setMonth(futureDueDate.getMonth() + 1); // due in 1 month
    const task = createTaskFromPreset('Early Skip Task', 'medicines', 'Monthly');
    task.nextDueDate = futureDueDate.toISOString();
    task.recurrence = { type: 'monthly' };

    const skipped = skipTaskInstance(task);
    // Next due date should be 1 month after the current futureDueDate, not 1 month after today
    const nextDate = new Date(skipped.nextDueDate);
    const expected = new Date(futureDueDate);
    expected.setMonth(expected.getMonth() + 1);

    expect(nextDate.getFullYear()).toBe(expected.getFullYear());
    expect(nextDate.getMonth()).toBe(expected.getMonth());
    expect(nextDate.getDate()).toBe(expected.getDate());
  });
});
