import { describe, expect, it } from 'vitest';
import {
  computeTaskReport,
  computeTaskStats,
  cycleSort,
  filterRows,
  isStatusFilter,
  sortLabel,
  sortRows,
  type TaskStatusFilter,
} from '@/domain/taskReport';
import { createTaskFromPreset } from '@/domain/task';

describe('domain/taskReport', () => {
  it('computeTaskStats calculates percentage, runs, skipped, and last completed', () => {
    const task = createTaskFromPreset('Water Bill', 'bills', 'Monthly');
    task.history = [
      { month: 'Jan', status: 'on_time', completedAt: '2026-01-05T10:00:00.000Z' },
      { month: 'Feb', status: 'skipped' },
      { month: 'Mar', status: 'late', completedAt: '2026-03-05T10:00:00.000Z' },
      { month: 'Apr', status: 'missed' },
      { month: 'May', status: 'on_time', completedAt: '2026-05-05T10:00:00.000Z' },
    ];

    const stats = computeTaskStats(task);
    expect(stats.totalDone).toBe(3);
    expect(stats.totalSkipped).toBe(1);
    expect(stats.monthsTracked).toBe(5);
    expect(stats.lastCompletedAt).toBe('2026-05-05T10:00:00.000Z');
    expect(stats.onTimePercent).toBe(50); // 2 on_time out of 4 countable (on_time, late, missed, on_time) -> 2/4 = 50%
    expect(stats.longestRun).toBe(2); // Jan (on_time) + Mar (late) with skipped in between
  });

  it('computeTaskReport filters out archived tasks and computes rows', () => {
    const active = createTaskFromPreset('Active Task', 'bills', 'Monthly');
    const archived = createTaskFromPreset('Archived Task', 'home', 'Monthly');
    archived.archived = true;

    const rows = computeTaskReport([active, archived]);
    expect(rows).toHaveLength(1);
    expect(rows[0].task.id).toBe(active.id);
  });

  it('isStatusFilter checks validity of filter keys', () => {
    expect(isStatusFilter('overdue')).toBe(true);
    expect(isStatusFilter('finance')).toBe(true);
    expect(isStatusFilter('vehicle' as TaskStatusFilter)).toBe(false);
  });

  it('filterRows filters report rows by search string and filter category/status', () => {
    const t1 = createTaskFromPreset('Wifi Bill', 'bills', 'Monthly');
    t1.nextDueDate = '2020-01-01T00:00:00.000Z'; // overdue
    const t2 = createTaskFromPreset('Gym Workout', 'health', 'Daily');
    t2.sharedWith = [{ name: 'Alice', code: 'A1', phone: '123', color: '#123' }];
    const t3 = createTaskFromPreset('Car Service', 'vehicle', 'Monthly', 5000, true);

    const rows = computeTaskReport([t1, t2, t3]);

    expect(filterRows(rows, 'all', 'wifi')).toHaveLength(1);
    expect(filterRows(rows, 'overdue', '')).toHaveLength(1);
    expect(filterRows(rows, 'shared', '')).toHaveLength(1);
    expect(filterRows(rows, 'finance', '')).toHaveLength(1);
    expect(filterRows(rows, 'health', '')).toHaveLength(1);
  });

  it('sortRows sorts by due_soon, rate_asc, rate_desc, alpha', () => {
    const t1 = createTaskFromPreset('Zebra Task', 'bills', 'Monthly');
    t1.nextDueDate = '2026-09-10T00:00:00.000Z';
    const t2 = createTaskFromPreset('Alpha Task', 'bills', 'Monthly');
    t2.nextDueDate = '2026-09-01T00:00:00.000Z';

    const rows = computeTaskReport([t1, t2]);

    const sortedAlpha = sortRows(rows, 'alpha');
    expect(sortedAlpha[0].task.title).toBe('Alpha Task');

    const sortedDue = sortRows(rows, 'due_soon');
    expect(sortedDue[0].task.title).toBe('Alpha Task');
  });

  it('cycleSort and sortLabel cycle sort types and return labels', () => {
    expect(cycleSort('due_soon')).toBe('rate_asc');
    expect(cycleSort('rate_asc')).toBe('rate_desc');
    expect(cycleSort('rate_desc')).toBe('alpha');
    expect(cycleSort('alpha')).toBe('due_soon');

    expect(sortLabel('due_soon', 'en')).toBe('Due Soon ↕');
    expect(sortLabel('due_soon', 'hi')).toBe('जल्द देय ↕');
  });
});
