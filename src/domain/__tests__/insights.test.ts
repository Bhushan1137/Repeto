import { describe, expect, it, vi } from 'vitest';
import {
  calculateStreak,
  calculateDailyStreak,
  getWeeklyActivity,
  initials,
  groupTasksByDue,
  computeInsights,
  computeUpcomingStrip,
  computeSpendForecast,
  computeMonthTrend,
  computeConsistencyMatrix,
  computeWeeklyVelocity,
  frequencyMultiplier,
  filterTasksByScope,
  calculateMemberOnTime,
  deriveHouseholdMembers,
  getHouseholdStats,
} from '@/domain/insights';
import { getMonthLabel } from '@/domain/recurrence';
import type { RepeatingTask } from '@/types';

const mockTask: RepeatingTask = {
  id: 'task-1',
  title: 'Pay Rent',
  category: 'bills',
  recurrence: { type: 'monthDay', dayOfMonth: 1 },
  frequencyLabel: 'Monthly',
  nextDueDate: '2026-09-01',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  escalationCount: 0,
  finance: true,
  amount: 15000,
  sharedWith: [{ code: 'MEMBER1', name: 'Alice', phone: '123', color: '#123456' }],
  history: [
    {
      completedAt: '2026-08-01T10:00:00.000Z',
      status: 'on_time',
      month: '2026-08',
      completedBy: 'user-1',
    },
    {
      completedAt: '2026-09-02T10:00:00.000Z',
      status: 'on_time',
      month: getMonthLabel(),
    },
  ],
};

describe('insights domain module', () => {
  it('calculates initials properly', () => {
    expect(initials('Malay Mahajan')).toBe('MM');
    expect(initials('Single')).toBe('S');
    expect(initials('John Doe Extra')).toBe('JD');
  });

  it('calculates streak', () => {
    expect(calculateStreak([mockTask])).toBe(2);
    const brokenTask: RepeatingTask = {
      ...mockTask,
      history: [{ status: 'skipped', month: '2026-08' }],
    };
    expect(calculateStreak([brokenTask])).toBe(0);
  });

  it('gets weekly activity', () => {
    const activityEn = getWeeklyActivity([mockTask], 'en');
    const activityHi = getWeeklyActivity([mockTask], 'hi');
    expect(activityEn).toHaveLength(7);
    expect(activityHi).toHaveLength(7);
    expect(activityEn[6].isToday).toBe(true);
  });

  it('groups tasks by due status', () => {
    const grouped = groupTasksByDue([mockTask]);
    expect(grouped).toHaveProperty('overdue');
    expect(grouped).toHaveProperty('today');
    expect(grouped).toHaveProperty('week');
    expect(grouped).toHaveProperty('month');
    expect(grouped).toHaveProperty('later');
  });

  it('computes overall insights result', () => {
    const emptyResult = computeInsights([], 'en');
    expect(emptyResult.isEmpty).toBe(true);

    const fullResult = computeInsights([mockTask], 'en');
    expect(fullResult.isEmpty).toBe(false);
    expect(fullResult.activeTasksCount).toBe(1);
    expect(fullResult.bars.length).toBeGreaterThan(0);
  });

  it('computes upcoming strip slots', () => {
    const slotsEn = computeUpcomingStrip([mockTask], 'en');
    const slotsHi = computeUpcomingStrip([mockTask], 'hi');
    expect(slotsEn.length).toBeGreaterThan(0);
    expect(slotsHi.length).toBeGreaterThan(0);
  });

  it('computes frequency multiplier correctly', () => {
    expect(frequencyMultiplier({ type: 'daily' })).toBe(30);
    expect(frequencyMultiplier({ type: 'weekly' })).toBe(4.33);
    expect(frequencyMultiplier({ type: 'monthly' })).toBe(1);
    expect(frequencyMultiplier({ type: 'yearly' })).toBeCloseTo(1 / 12);
    expect(frequencyMultiplier({ type: 'interval', interval: 2, intervalUnit: 'days' })).toBe(15);
  });

  it('computes normalized spend forecast with paid vs upcoming split', () => {
    const forecast = computeSpendForecast([mockTask], 'en');
    expect(forecast.thisMonthTotal).toBe(15000);
    expect(forecast.yearlyEstimate).toBe(180000);
    expect(forecast.currency).toBe('₹');
    expect(forecast.spentSoFarThisMonth).toBe(15000); // completed history in current month
  });

  it('correctly calculates upcomingThisMonth for bills due later this month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T10:00:00.000Z'));
    try {
      const pendingTask: RepeatingTask = {
        ...mockTask,
        id: 'task-pending',
        amount: 4500,
        nextDueDate: '2026-06-28T10:00:00.000Z',
        history: [],
      };
      const forecast = computeSpendForecast([pendingTask], 'en');
      expect(forecast.upcomingThisMonth).toBe(4500);
      expect(forecast.spentSoFarThisMonth).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('calculates true daily streak across multiple days', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const streakTask: RepeatingTask = {
      ...mockTask,
      history: [
        {
          completedAt: yesterday.toISOString(),
          status: 'on_time',
          month: getMonthLabel(),
        },
        {
          completedAt: today.toISOString(),
          status: 'on_time',
          month: getMonthLabel(),
        },
      ],
    };

    const streak = calculateDailyStreak([streakTask], today);
    expect(streak).toBe(2);
  });

  it('computes 28-day habit consistency matrix', () => {
    const matrix = computeConsistencyMatrix([mockTask]);
    expect(matrix).toHaveLength(28);
    const todayEntry = matrix.find((d) => d.isToday);
    expect(todayEntry).toBeDefined();
    expect([0, 1, 2, 3]).toContain(todayEntry?.intensity);
  });

  it('computes weekly velocity stats', () => {
    const velocity = computeWeeklyVelocity([mockTask]);
    expect(velocity).toHaveProperty('completedThisWeek');
    expect(velocity).toHaveProperty('skippedThisWeek');
    expect(velocity).toHaveProperty('topHabitTitle');
  });

  it('filters tasks by scope correctly', () => {
    const personalTask: RepeatingTask = { ...mockTask, id: 't-p', householdId: undefined };
    const householdTask: RepeatingTask = { ...mockTask, id: 't-h', householdId: 'hh-1' };
    const all = [personalTask, householdTask];

    expect(filterTasksByScope(all, 'all')).toHaveLength(2);
    expect(filterTasksByScope(all, 'personal')).toEqual([personalTask]);
    expect(filterTasksByScope(all, 'hh-1')).toEqual([householdTask]);
    expect(filterTasksByScope(all, 'hh-other')).toHaveLength(0);
  });

  it('computes month trend', () => {
    const trend = computeMonthTrend([mockTask], 'en');
    expect(trend.direction).toBe('insufficient_data');
  });

  it('derives household members and member statistics', () => {
    const members = deriveHouseholdMembers(
      [mockTask],
      'Malay',
      [{ code: 'MEMBER1', name: 'Alice', color: '#123456', status: 'active', addedAt: '2026-01-01' }],
      'user-1',
      'USERCODE1'
    );
    expect(members).toHaveLength(2);
    expect(members[0].isYou).toBe(true);

    const onTime = calculateMemberOnTime([mockTask], 'user-1', undefined, true);
    expect(onTime).toBeGreaterThanOrEqual(0);

    const stats = getHouseholdStats([mockTask]);
    expect(stats.shared).toHaveLength(1);
  });

  it('does not resurrect departed members from task.sharedWith when householdMembers is provided', () => {
    // Task historically has Alice in sharedWith
    const taskWithAlice: RepeatingTask = {
      ...mockTask,
      sharedWith: [{ code: 'ALICE_CODE', name: 'Alice', phone: '123', color: '#123456', userId: 'user-alice' }],
    };

    // Alice has left the household! Authoritative householdMembers only has Bob
    const authoritativeMembers = [
      { code: 'BOB_CODE', name: 'Bob', color: '#654321', status: 'active' as const, addedAt: '2026-01-01', userId: 'user-bob' },
    ];

    const derived = deriveHouseholdMembers(
      [taskWithAlice],
      'Owner',
      authoritativeMembers,
      'user-owner',
      'OWNER_CODE'
    );

    // Should contain: Owner (isYou) and Bob. Alice must NOT be resurrected!
    expect(derived).toHaveLength(2);
    expect(derived.map((m) => m.name)).toEqual(['Owner', 'Bob']);
    expect(derived.some((m) => m.name === 'Alice')).toBe(false);
  });
});
