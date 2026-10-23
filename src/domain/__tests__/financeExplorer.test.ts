import { describe, expect, it } from 'vitest';
import { computeDetailedSpendReport } from '@/domain/financeExplorer';
import type { RepeatingTask } from '@/types';

const mockTasks: RepeatingTask[] = [
  {
    id: 'f-1',
    title: 'House Rent',
    category: 'bills',
    recurrence: { type: 'monthDay', dayOfMonth: 1 },
    frequencyLabel: 'Monthly',
    nextDueDate: '2026-09-01',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    escalationCount: 0,
    finance: true,
    amount: 20000,
    sharedWith: [],
    history: [
      {
        completedAt: '2026-09-01T10:00:00.000Z',
        status: 'on_time',
        month: new Date().toISOString().slice(0, 7),
      },
    ],
  },
  {
    id: 'f-2',
    title: 'Internet Bill',
    category: 'bills',
    recurrence: { type: 'monthDay', dayOfMonth: 15 },
    frequencyLabel: 'Monthly',
    nextDueDate: '2026-09-15',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    escalationCount: 0,
    finance: true,
    amount: 1000,
    sharedWith: [],
    history: [],
  },
  {
    id: 'f-3',
    title: 'Non-finance task',
    category: 'home',
    recurrence: { type: 'daily', interval: 1 },
    frequencyLabel: 'Daily',
    nextDueDate: '2026-09-02',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    escalationCount: 0,
    finance: false,
    sharedWith: [],
    history: [],
  },
];

describe('financeExplorer domain module', () => {
  it('computes detailed spend report for all tasks', () => {
    const report = computeDetailedSpendReport(mockTasks, 'en', 'all');

    expect(report.totalFinanceTasks).toBe(2);
    expect(report.projectedSpend).toBe(21000);
    expect(report.paidSoFar).toBe(20000);
    expect(report.remainingDue).toBe(1000);
    expect(report.percentPaid).toBe(95);
    expect(report.yearlyEstimate).toBe(252000);
    expect(report.categoryBreakdown).toHaveLength(1);
    expect(report.itemList).toHaveLength(2);
  });

  it('filters finance tasks by household scope', () => {
    const householdTask: RepeatingTask = {
      ...mockTasks[0],
      id: 'f-hh',
      householdId: 'hh-123',
    };
    const reportHH = computeDetailedSpendReport([householdTask], 'en', 'hh-123');
    expect(reportHH.totalFinanceTasks).toBe(1);

    const reportPersonal = computeDetailedSpendReport([householdTask], 'en', 'personal');
    expect(reportPersonal.totalFinanceTasks).toBe(0);
  });
});
