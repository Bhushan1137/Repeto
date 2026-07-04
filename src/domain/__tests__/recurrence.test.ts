import { describe, expect, it } from 'vitest';
import {
  parseFrequencyLabel,
  computeNextDueDate,
  daysUntilDue,
  getTaskGroup,
} from '@/domain/recurrence';
import { canAddTask, capTasksForPlan, createTaskFromPreset, FREE_TASK_LIMIT } from '@/domain/task';
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
});

describe('free tier limits', () => {
  it('blocks at 10 tasks', () => {
    expect(canAddTask(freeUser, FREE_TASK_LIMIT)).toBe(false);
    expect(canAddTask(freeUser, FREE_TASK_LIMIT - 1)).toBe(true);
  });

  it('caps onboarding presets', () => {
    const items = Array.from({ length: 14 }, (_, i) => i);
    expect(capTasksForPlan(freeUser, items)).toHaveLength(FREE_TASK_LIMIT);
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
