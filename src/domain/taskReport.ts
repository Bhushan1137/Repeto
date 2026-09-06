import type { CategoryKey, RepeatingTask } from '@/types';
import { daysUntilDue } from '@/domain/recurrence';

// ─── Types ────────────────────────────────────────────────────────────────

export type TaskStatusFilter =
  | 'all'
  | 'overdue'
  | 'on_track'
  | 'slipping'
  | 'no_history'
  | 'shared'
  | 'finance'
  | CategoryKey;

export type TaskSort = 'due_soon' | 'rate_asc' | 'rate_desc' | 'alpha';

export type TaskRowStatus = 'on_track' | 'slipping' | 'overdue' | 'no_history';

export interface TaskReportRow {
  task: RepeatingTask;
  onTimePercent: number;   // 0–100; -1 means no history
  totalDone: number;
  longestRun: number;
  monthsTracked: number;
  lastCompletedAt: string | null;
  totalSkipped: number;
  status: TaskRowStatus;
}

// ─── computeTaskStats ────────────────────────────────────────────────────

export function computeTaskStats(task: RepeatingTask): {
  onTimePercent: number;
  totalDone: number;
  totalSkipped: number;
  longestRun: number;
  lastCompletedAt: string | null;
  monthsTracked: number;
} {
  const history = task.history ?? [];

  // Skipped entries excluded from rate — skipping is a deliberate action, not a failure
  const countable = history.filter(h => h.status !== 'skipped' && h.status !== 'snoozed');
  const onTime = countable.filter(h => h.status === 'on_time').length;
  const skipped = history.filter(h => h.status === 'skipped').length;

  const onTimePercent = countable.length === 0 ? -1 : Math.round((onTime / countable.length) * 100);

  // Longest consecutive run of on_time | late without a missed/gap
  let longestRun = 0;
  let currentRun = 0;
  for (const h of history) {
    if (h.status === 'on_time' || h.status === 'late') {
      currentRun++;
      if (currentRun > longestRun) longestRun = currentRun;
    } else if (h.status === 'missed') {
      currentRun = 0;
    }
    // skipped/snoozed don't break the run
  }

  const completions = history.filter(h => h.completedAt && (h.status === 'on_time' || h.status === 'late'));
  const lastCompletedAt = completions.length > 0
    ? completions[completions.length - 1].completedAt ?? null
    : null;

  const months = new Set(history.map(h => h.month)).size;

  return {
    onTimePercent,
    totalDone: completions.length,
    totalSkipped: skipped,
    longestRun,
    lastCompletedAt,
    monthsTracked: months,
  };
}

// ─── computeTaskReport ───────────────────────────────────────────────────

function classifyStatus(task: RepeatingTask, onTimePercent: number): TaskRowStatus {
  if (daysUntilDue(task.nextDueDate) < 0) return 'overdue';
  if (onTimePercent === -1) return 'no_history';
  if (onTimePercent >= 75) return 'on_track';
  return 'slipping';
}

export function computeTaskReport(tasks: RepeatingTask[]): TaskReportRow[] {
  return tasks
    .filter(t => !t.archived)
    .map(task => {
      const stats = computeTaskStats(task);
      return {
        task,
        onTimePercent: stats.onTimePercent,
        totalDone: stats.totalDone,
        longestRun: stats.longestRun,
        monthsTracked: stats.monthsTracked,
        lastCompletedAt: stats.lastCompletedAt,
        totalSkipped: stats.totalSkipped,
        status: classifyStatus(task, stats.onTimePercent),
      };
    });
}

// ─── filterRows ──────────────────────────────────────────────────────────

const STATUS_FILTERS: TaskStatusFilter[] = ['all', 'overdue', 'on_track', 'slipping', 'no_history', 'shared', 'finance'];

export function isStatusFilter(f: TaskStatusFilter): f is 'all' | 'overdue' | 'on_track' | 'slipping' | 'no_history' | 'shared' | 'finance' {
  return STATUS_FILTERS.includes(f);
}

export function filterRows(rows: TaskReportRow[], filter: TaskStatusFilter, search: string): TaskReportRow[] {
  const q = search.trim().toLowerCase();

  return rows.filter(row => {
    // Search match
    if (q && !row.task.title.toLowerCase().includes(q)) return false;

    // Filter match
    if (filter === 'all') return true;
    if (filter === 'overdue') return row.status === 'overdue';
    if (filter === 'on_track') return row.status === 'on_track';
    if (filter === 'slipping') return row.status === 'slipping';
    if (filter === 'no_history') return row.status === 'no_history';
    if (filter === 'shared') return row.task.sharedWith.length > 0;
    if (filter === 'finance') return row.task.finance === true || (row.task.amount !== undefined && row.task.amount > 0);
    // Category key
    return row.task.category === filter;
  });
}

// ─── sortRows ────────────────────────────────────────────────────────────

export function sortRows(rows: TaskReportRow[], sort: TaskSort): TaskReportRow[] {
  return [...rows].sort((a, b) => {
    if (sort === 'due_soon') {
      return daysUntilDue(a.task.nextDueDate) - daysUntilDue(b.task.nextDueDate);
    }
    if (sort === 'rate_asc') {
      // No-history tasks go last (worst first means lowest rate, but -1 goes last)
      if (a.onTimePercent === -1 && b.onTimePercent === -1) return 0;
      if (a.onTimePercent === -1) return 1;
      if (b.onTimePercent === -1) return -1;
      return a.onTimePercent - b.onTimePercent;
    }
    if (sort === 'rate_desc') {
      if (a.onTimePercent === -1 && b.onTimePercent === -1) return 0;
      if (a.onTimePercent === -1) return 1;
      if (b.onTimePercent === -1) return -1;
      return b.onTimePercent - a.onTimePercent;
    }
    if (sort === 'alpha') {
      return a.task.title.localeCompare(b.task.title);
    }
    return 0;
  });
}

// ─── Cycle sort helper ───────────────────────────────────────────────────

const SORT_CYCLE: TaskSort[] = ['due_soon', 'rate_asc', 'rate_desc', 'alpha'];

export function cycleSort(current: TaskSort): TaskSort {
  const idx = SORT_CYCLE.indexOf(current);
  return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
}

export function sortLabel(sort: TaskSort, lang: 'en' | 'hi'): string {
  if (lang === 'hi') {
    if (sort === 'due_soon') return 'जल्द देय ↕';
    if (sort === 'rate_asc') return 'दर: कम पहले ↕';
    if (sort === 'rate_desc') return 'दर: अधिक पहले ↕';
    return 'A–Z ↕';
  }
  if (sort === 'due_soon') return 'Due Soon ↕';
  if (sort === 'rate_asc') return 'Rate: Low First ↕';
  if (sort === 'rate_desc') return 'Rate: High First ↕';
  return 'A–Z ↕';
}
