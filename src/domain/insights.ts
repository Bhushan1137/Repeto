import type { AnyCategoryKey, CompletionStatus, HouseholdMemberProfile, RecurrenceRule, RepeatingTask, TaskGroup } from '@/types';
import { getCategoryDef } from '@/constants/categoryHelpers';
import { daysUntilDue, getTaskGroup, isCurrentMonth, getMonthLabel } from '@/domain/recurrence';
import { hasCompletedToday } from '@/domain/task';

export interface CategoryInsight {
  label: string;
  percent: number;
  key: AnyCategoryKey;
}

export interface DailyActivity {
  dayName: string;
  isToday: boolean;
  hasCompletion: boolean;
  dateStr: string;
}

// ─── P1: Upcoming Strip ────────────────────────────────────────────────────

export interface UpcomingTaskItem {
  id: string;
  title: string;
  icon?: string;
  category: AnyCategoryKey;
  amount?: number;
  finance: boolean;
  isOverdue: boolean;
}

export interface UpcomingDaySlot {
  /** ISO date string "YYYY-MM-DD" */
  dateStr: string;
  /** Localised label: "Mon 28", "Today", "Overdue" */
  dayLabel: string;
  isToday: boolean;
  isOverdue: boolean;
  tasks: UpcomingTaskItem[];
}

// ─── P3: Spend Forecast ────────────────────────────────────────────────────

export interface SpendForecastCategory {
  key: AnyCategoryKey;
  label: string;
  icon: string;
  amount: number;
}

export interface HighImpactTask {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  category: AnyCategoryKey;
  icon?: string;
  daysUntil: number;
}

export interface SpendForecast {
  thisMonthTotal: number;
  nextMonthTotal: number;
  spentSoFarThisMonth: number;
  upcomingThisMonth: number;
  yearlyEstimate: number;
  byCategory: SpendForecastCategory[];
  highImpactDueSoon: HighImpactTask[];
  financeTaskCount: number;
  currency: '₹';
}

// ─── P4: Month Trend ───────────────────────────────────────────────────────

export interface MonthTrend {
  direction: 'up' | 'down' | 'same' | 'insufficient_data';
  delta: number;
  thisMonthPercent: number;
  lastMonthPercent: number;
  lastMonthLabel: string;
}

// ─── P5: Consistency Matrix & Velocity ─────────────────────────────────────

export interface MatrixDaySlot {
  dateStr: string;
  dayLabel: string;
  dayNumber: number;
  count: number;
  intensity: 0 | 1 | 2 | 3;
  isToday: boolean;
}

export type ConsistencyDay = MatrixDaySlot;

export interface WeeklyVelocity {
  completedThisWeek: number;
  skippedThisWeek: number;
  completedCount: number;
  skippedCount: number;
  topHabitTitle: string | null;
  slipCategory: AnyCategoryKey | null;
}

// ─── Existing InsightsResult (extended for P2 + P6) ──────────────────────

export interface InsightsResult {
  overallPercent: number;
  bars: CategoryInsight[];
  slipCategory: AnyCategoryKey | null;
  isEmpty: boolean;
  streak: number;
  dailyStreak: number;
  weeklyActivity: DailyActivity[];
  completionsCount: number;
  allTimeCompletionsCount?: number;
  onTimeCount: number;
  lateCount: number;
  skippedCount: number;
  allTimeSkippedCount?: number;
  activeTasksCount: number;
  /** P2: count of tasks currently overdue */
  overdueCount: number;
  /** P2: overall health bucket */
  healthStatus: 'great' | 'ok' | 'attention';
  /** P6: tasks completed in the last 7 days (on_time | late) */
  weeklyCompletionCount: number;
}

export function calculateStreak(tasks: RepeatingTask[]): number {
  const history = tasks.flatMap((t) => t.history);
  const completed = history
    .filter((h) => h.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

  let streak = 0;
  for (const entry of completed) {
    if (entry.status === 'on_time' || entry.status === 'late') {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function calculateDailyStreak(tasks: RepeatingTask[], today = new Date()): number {
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const completionDates = tasks
    .flatMap((t) => t.history ?? [])
    .filter((h) => (h.status === 'on_time' || h.status === 'late') && h.completedAt)
    .map((h) => new Date(h.completedAt!));

  if (completionDates.length === 0) return 0;

  let streak = 0;
  const checkDate = new Date(today);
  checkDate.setHours(0, 0, 0, 0);

  // If no task was completed today, check if yesterday had one to preserve streak
  const hasToday = completionDates.some((d) => isSameDay(d, checkDate));
  if (!hasToday) {
    checkDate.setDate(checkDate.getDate() - 1);
    const hasYesterday = completionDates.some((d) => isSameDay(d, checkDate));
    if (!hasYesterday) return 0;
  }

  // Count backwards day by day
  let checking = true;
  while (checking) {
    const hasComp = completionDates.some((d) => isSameDay(d, checkDate));
    if (hasComp) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      checking = false;
    }
  }

  return streak;
}

export function computeConsistencyMatrix(
  tasks: RepeatingTask[],
  today = new Date(),
  totalDays = 28
): MatrixDaySlot[] {
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const completionDates = tasks
    .flatMap((t) => t.history ?? [])
    .filter((h) => (h.status === 'on_time' || h.status === 'late') && h.completedAt)
    .map((h) => new Date(h.completedAt!));

  const slots: MatrixDaySlot[] = [];
  const start = new Date(today);
  start.setDate(today.getDate() - (totalDays - 1));
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < totalDays; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);

    const count = completionDates.filter((d) => isSameDay(d, current)).length;
    const intensity: 0 | 1 | 2 | 3 = count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : 3;

    slots.push({
      dateStr: current.toISOString().slice(0, 10),
      dayLabel: dayNamesEn[current.getDay()],
      dayNumber: current.getDate(),
      count,
      intensity,
      isToday: isSameDay(current, today),
    });
  }

  return slots;
}

export function computeWeeklyVelocity(
  tasks: RepeatingTask[],
  today = new Date()
): WeeklyVelocity {
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let completedCount = 0;
  let skippedCount = 0;
  const taskCompletionMap = new Map<string, number>();

  tasks.forEach((t) => {
    (t.history ?? []).forEach((h) => {
      if (!h.completedAt) return;
      const compDate = new Date(h.completedAt);
      if (compDate >= sevenDaysAgo && compDate <= today) {
        if (h.status === 'on_time' || h.status === 'late') {
          completedCount += 1;
          taskCompletionMap.set(t.title, (taskCompletionMap.get(t.title) ?? 0) + 1);
        } else if (h.status === 'skipped') {
          skippedCount += 1;
        }
      }
    });
  });

  let topHabitTitle: string | null = null;
  let maxCompletions = 0;
  taskCompletionMap.forEach((cnt, title) => {
    if (cnt > maxCompletions) {
      maxCompletions = cnt;
      topHabitTitle = title;
    }
  });

  const overdueTasks = tasks.filter((t) => daysUntilDue(t.nextDueDate) < 0);
  const slipCategory = overdueTasks.length > 0 ? overdueTasks[0].category : null;

  return {
    completedThisWeek: completedCount,
    skippedThisWeek: skippedCount,
    completedCount,
    skippedCount,
    topHabitTitle,
    slipCategory,
  };
}

export function getWeeklyActivity(tasks: RepeatingTask[], lang: 'en' | 'hi'): DailyActivity[] {
  const result: DailyActivity[] = [];
  const today = new Date();

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const dayNamesEn = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dayNamesHi = ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'];

  const completedDates = tasks
    .flatMap((t) => t.history)
    .filter((h) => h.completedAt)
    .map((h) => new Date(h.completedAt!));

  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(today.getDate() - i);
    const dayIdx = day.getDay();
    const dayName = lang === 'hi' ? dayNamesHi[dayIdx] : dayNamesEn[dayIdx];

    const hasCompletion = completedDates.some((date) => isSameDay(date, day));

    result.push({
      dayName,
      isToday: i === 0,
      hasCompletion,
      dateStr: day.toLocaleDateString(),
    });
  }

  return result;
}

export function initials(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function groupTasksByDue(
  tasks: RepeatingTask[],
  today: Date = new Date()
): Record<TaskGroup, RepeatingTask[]> {
  const todayDate = today || new Date();
  const groups: Record<TaskGroup, RepeatingTask[]> = {
    overdue: [],
    today: [],
    week: [],
    month: [],
    later: [],
  };
  tasks.forEach((task) => {
    // Filter out invalid/empty tasks
    if (!task || !task.title || !task.title.trim()) return;

    const group = getTaskGroup(daysUntilDue(task.nextDueDate));
    groups[group].push(task);
  });

  // Sort each group: pending tasks first, completed today tasks at the bottom
  (Object.keys(groups) as TaskGroup[]).forEach((key) => {
    groups[key].sort((a, b) => {
      const aDoneToday = hasCompletedToday(a, todayDate);
      const bDoneToday = hasCompletedToday(b, todayDate);

      if (aDoneToday !== bDoneToday) {
        return aDoneToday ? 1 : -1; // Move completed to bottom
      }
      return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
    });
  });
  return groups;
}

export function computeInsights(tasks: RepeatingTask[], lang: 'en' | 'hi'): InsightsResult {
  const isEntryThisMonth = (h: { month?: string; completedAt?: string }) =>
    (h.month && isCurrentMonth(h.month)) ||
    (h.completedAt ? isCurrentMonth(h.completedAt.slice(0, 7)) : false);

  const completedEntries = tasks.flatMap((t) =>
    (t.history ?? []).filter((h) => h.status !== 'skipped' && isEntryThisMonth(h))
  );
  const total = completedEntries.length;
  const streak = calculateStreak(tasks);
  const weeklyActivity = getWeeklyActivity(tasks, lang);

  const allTimeCompletionsCount = tasks.reduce(
    (sum, t) => sum + (t.history ?? []).filter((h) => h.status === 'on_time' || h.status === 'late').length,
    0
  );
  const allTimeSkippedCount = tasks.reduce(
    (sum, t) => sum + (t.history ?? []).filter((h) => h.status === 'skipped').length,
    0
  );

  const onTimeCount = completedEntries.filter((h) => h.status === 'on_time').length;
  const lateCount = completedEntries.filter((h) => h.status === 'late').length;
  const completionsCount = onTimeCount + lateCount;
  const skippedCount = tasks.reduce(
    (sum, t) => sum + (t.history ?? []).filter((h) => h.status === 'skipped' && isEntryThisMonth(h)).length,
    0
  );
  const activeTasksCount = tasks.length;

  // P2: overdue count
  const overdueCount = tasks.filter((t) => daysUntilDue(t.nextDueDate) < 0).length;

  // P6: weekly completion count (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weeklyCompletionCount = tasks
    .flatMap((t) => t.history ?? [])
    .filter(
      (h) =>
        h.completedAt &&
        new Date(h.completedAt) >= sevenDaysAgo &&
        (h.status === 'on_time' || h.status === 'late')
    ).length;

  if (total === 0) {
    const hasOverdue = overdueCount > 0;
    const overallPercent = hasOverdue
      ? Math.max(0, Math.round(((activeTasksCount - overdueCount) / Math.max(1, activeTasksCount)) * 100))
      : 100;

    return {
      overallPercent,
      bars: [],
      slipCategory: hasOverdue ? (tasks.find((t) => daysUntilDue(t.nextDueDate) < 0)?.category ?? null) : null,
      isEmpty: activeTasksCount === 0,
      streak,
      dailyStreak: calculateDailyStreak(tasks),
      weeklyActivity,
      completionsCount,
      allTimeCompletionsCount,
      onTimeCount: 0,
      lateCount: 0,
      skippedCount,
      allTimeSkippedCount,
      activeTasksCount,
      overdueCount,
      healthStatus: hasOverdue ? 'attention' : 'great',
      weeklyCompletionCount,
    };
  }

  const overallPercent = Math.round((onTimeCount / total) * 100);

  // P2: health status
  const healthStatus: InsightsResult['healthStatus'] =
    overallPercent >= 75 ? 'great' : overallPercent >= 50 ? 'ok' : 'attention';

  const byCategory: Record<string, { onTime: number; total: number }> = {};
  tasks.forEach((task) => {
    if (!byCategory[task.category]) byCategory[task.category] = { onTime: 0, total: 0 };
    (task.history ?? [])
      .filter((h) => h.status !== 'skipped' && isEntryThisMonth(h))
      .forEach((h) => {
        byCategory[task.category].total += 1;
        if (h.status === 'on_time') byCategory[task.category].onTime += 1;
      });
  });

  const bars: CategoryInsight[] = Object.entries(byCategory)
    .filter(([, stats]) => stats.total > 0)
    .map(([key, stats]) => {
      const cat = getCategoryDef(key as AnyCategoryKey);
      return {
        key: key as AnyCategoryKey,
        label: lang === 'hi' ? cat.labelHi : cat.labelEn,
        percent: Math.round((stats.onTime / stats.total) * 100),
      };
    });

  const slipCategory =
    bars.length > 0 ? [...bars].sort((a, b) => a.percent - b.percent)[0].key : null;

  return {
    overallPercent,
    bars: bars.sort((a, b) => b.percent - a.percent),
    slipCategory,
    isEmpty: false,
    streak,
    dailyStreak: calculateDailyStreak(tasks),
    weeklyActivity,
    completionsCount,
    allTimeCompletionsCount,
    onTimeCount,
    lateCount,
    skippedCount,
    allTimeSkippedCount,
    activeTasksCount,
    overdueCount,
    healthStatus,
    weeklyCompletionCount,
  };
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDayLabel(d: Date, isToday: boolean, lang: 'en' | 'hi'): string {
  if (isToday) return lang === 'hi' ? 'आज' : 'Today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (toDateStr(d) === toDateStr(tomorrow)) return lang === 'hi' ? 'कल' : 'Tomorrow';
  const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNamesHi = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];
  const dayName = lang === 'hi' ? dayNamesHi[d.getDay()] : dayNamesEn[d.getDay()];
  return `${dayName} ${d.getDate()}`;
}

export function computeUpcomingStrip(
  tasks: RepeatingTask[],
  lang: 'en' | 'hi'
): UpcomingDaySlot[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  // Collect overdue tasks (days < 0)
  const overdueTasks: UpcomingTaskItem[] = tasks
    .filter(t => daysUntilDue(t.nextDueDate) < 0)
    .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
    .map(t => ({
      id: t.id,
      title: t.title,
      icon: t.icon,
      category: t.category,
      amount: t.amount,
      finance: t.finance,
      isOverdue: true,
    }));

  // Build 15-day forward map: today + 14 future days
  const dayMap = new Map<string, UpcomingTaskItem[]>();
  for (let i = 0; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dayMap.set(toDateStr(d), []);
  }

  // Place non-overdue tasks into their due-date slot
  tasks
    .filter(t => daysUntilDue(t.nextDueDate) >= 0)
    .forEach(t => {
      const ds = t.nextDueDate.slice(0, 10);
      if (dayMap.has(ds)) {
        dayMap.get(ds)!.push({
          id: t.id,
          title: t.title,
          icon: t.icon,
          category: t.category,
          amount: t.amount,
          finance: t.finance,
          isOverdue: false,
        });
      }
    });

  const slots: UpcomingDaySlot[] = [];

  // Overdue slot first
  if (overdueTasks.length > 0) {
    slots.push({
      dateStr: '',
      dayLabel: lang === 'hi' ? 'विलंबित' : 'Overdue',
      isToday: false,
      isOverdue: true,
      tasks: overdueTasks,
    });
  }

  // Day slots — always show today, skip empty future days
  dayMap.forEach((slotTasks, ds) => {
    const d = new Date(ds + 'T00:00:00');
    const isToday = ds === todayStr;
    if (!isToday && slotTasks.length === 0) return;
    slots.push({
      dateStr: ds,
      dayLabel: buildDayLabel(d, isToday, lang),
      isToday,
      isOverdue: false,
      tasks: slotTasks,
    });
  });

  return slots;
}

export function frequencyMultiplier(recurrence?: RecurrenceRule): number {
  if (!recurrence) return 1;
  switch (recurrence.type) {
    case 'daily':
      return 30;
    case 'weekly':
      return 4.33;
    case 'monthly':
    case 'monthDay':
    case 'nthWeekday':
      return 1;
    case 'yearly':
      return 1 / 12;
    case 'interval': {
      const interval = Math.max(1, recurrence.interval ?? 1);
      if (recurrence.intervalUnit === 'days') {
        return 30 / interval;
      }
      return 1 / interval;
    }
    default:
      return 1;
  }
}

export function computeSpendForecast(
  tasks: RepeatingTask[],
  lang: 'en' | 'hi'
): SpendForecast {
  const financeTasks = tasks.filter(
    (t) => !t.archived && (t.finance === true || (t.amount !== undefined && Number(t.amount) > 0))
  );

  let spentSoFarThisMonth = 0;
  let upcomingThisMonth = 0;
  let normalizedMonthlyTotal = 0;
  const byCategoryMap = new Map<AnyCategoryKey, number>();
  const currentMonth = getMonthLabel();

  financeTasks.forEach((t) => {
    const amount = Number(t.amount) || 0;
    if (!amount) return;

    const mult = frequencyMultiplier(t.recurrence);
    const monthlyAmt = amount * mult;
    normalizedMonthlyTotal += monthlyAmt;

    byCategoryMap.set(t.category, (byCategoryMap.get(t.category) ?? 0) + monthlyAmt);

    // Calculate actual spent so far in the current month from completion history
    const currentMonthCompletions = (t.history ?? []).filter(
      (h) => (h.status === 'on_time' || h.status === 'late') && h.month === currentMonth
    ).length;
    if (currentMonthCompletions > 0) {
      spentSoFarThisMonth += amount * currentMonthCompletions;
    }

    // Calculate upcoming bills in the current month
    const days = daysUntilDue(t.nextDueDate);
    const dueMonth = t.nextDueDate.slice(0, 7);
    if (isCurrentMonth(dueMonth) && days >= 0) {
      upcomingThisMonth += amount;
    }
  });

  const highImpactDueSoon: HighImpactTask[] = financeTasks
    .filter((t) => {
      const amt = Number(t.amount) || 0;
      const days = daysUntilDue(t.nextDueDate);
      return amt >= 1000 && days >= -14 && days <= 7;
    })
    .sort((a, b) => daysUntilDue(a.nextDueDate) - daysUntilDue(b.nextDueDate))
    .map((t) => ({
      id: t.id,
      title: t.title,
      amount: Number(t.amount) || 0,
      dueDate: t.nextDueDate,
      category: t.category,
      icon: t.icon,
      daysUntil: daysUntilDue(t.nextDueDate),
    }));

  const byCategory: SpendForecastCategory[] = Array.from(byCategoryMap.entries())
    .map(([key, amount]) => {
      const cat = getCategoryDef(key);
      return {
        key,
        label: lang === 'hi' ? cat.labelHi : cat.labelEn,
        icon: cat.icon,
        amount: Math.round(amount),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const thisMonthTotal = Math.round(normalizedMonthlyTotal);
  const nextMonthTotal = Math.round(normalizedMonthlyTotal);
  const yearlyEstimate = Math.round(normalizedMonthlyTotal * 12);

  return {
    thisMonthTotal,
    nextMonthTotal,
    spentSoFarThisMonth: Math.round(spentSoFarThisMonth),
    upcomingThisMonth: Math.round(upcomingThisMonth),
    yearlyEstimate,
    byCategory,
    highImpactDueSoon,
    financeTaskCount: financeTasks.length,
    currency: '₹',
  };
}

function getLastMonthLabel(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return getMonthLabel(d);
}

function getLastMonthName(lang: 'en' | 'hi'): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const en = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const hi = ['जनवरी','फ़रवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'];
  return lang === 'hi' ? hi[d.getMonth()] : en[d.getMonth()];
}

export function computeMonthTrend(
  tasks: RepeatingTask[],
  lang: 'en' | 'hi'
): MonthTrend {
  const currentLabel = getMonthLabel();
  const lastLabel = getLastMonthLabel();

  const filterByMonth = (label: string) =>
    tasks.flatMap(t => t.history.filter(h => h.month === label && h.status !== 'skipped'));

  const currentEntries = filterByMonth(currentLabel);
  const lastEntries = filterByMonth(lastLabel);

  if (currentEntries.length < 3 || lastEntries.length < 3) {
    return {
      direction: 'insufficient_data',
      delta: 0,
      thisMonthPercent: 0,
      lastMonthPercent: 0,
      lastMonthLabel: getLastMonthName(lang),
    };
  }

  const pct = (entries: ReturnType<typeof filterByMonth>) =>
    Math.round((entries.filter(h => h.status === 'on_time').length / entries.length) * 100);

  const thisMonthPercent = pct(currentEntries);
  const lastMonthPercent = pct(lastEntries);
  const delta = Math.abs(thisMonthPercent - lastMonthPercent);
  const direction: MonthTrend['direction'] =
    delta < 2 ? 'same' : thisMonthPercent > lastMonthPercent ? 'up' : 'down';

  return { direction, delta, thisMonthPercent, lastMonthPercent, lastMonthLabel: getLastMonthName(lang) };
}

// ─── Household helpers ────────────────────────────────────────

export interface HouseholdMember {
  name: string;
  short: string;
  color: string;
  taskCount: number;
  completedCount?: number;
  isYou?: boolean;
  code?: string;
  userId?: string;
  status?: 'active' | 'pending';
  onTimePercent: number;
}

export function calculateMemberOnTime(
  tasks: RepeatingTask[],
  memberId: string | undefined,
  memberCode: string | undefined,
  isYou: boolean
): number {
  const history = tasks.flatMap((t) => {
    return (t.history ?? []).filter((h) => {
      if (h.status === 'skipped' || !h.completedAt) return false;
      if (h.completedBy) {
        return (memberId && h.completedBy === memberId) || (memberCode && h.completedBy === memberCode);
      }
      if (isYou) return true;
      return false;
    });
  });

  if (history.length === 0) return 100;
  const onTime = history.filter((h) => h.status === 'on_time').length;
  return Math.round((onTime / history.length) * 100);
}

export function deriveHouseholdMembers(
  tasks: RepeatingTask[],
  currentUserName: string,
  householdMembers: HouseholdMemberProfile[] = [],
  currentUserId?: string,
  currentUserCode?: string
): HouseholdMember[] {
  // Helper to check if task is assigned or shared with You
  const isYouTask = (t: RepeatingTask) => {
    if (t.assignedTo) {
      return (
        (currentUserId && t.assignedTo === currentUserId) ||
        (currentUserCode && t.assignedTo === currentUserCode)
      );
    }
    if (t.sharedWith && t.sharedWith.length > 0) {
      return t.sharedWith.some(
        (m) =>
          (currentUserId && m.userId === currentUserId) ||
          (currentUserCode && m.code === currentUserCode)
      );
    }
    // General unassigned task in scope
    return true;
  };

  // Helper to check if task is assigned or shared with specific member
  const isMemberTask = (t: RepeatingTask, memberUserId?: string, memberCode?: string) => {
    if (t.assignedTo) {
      return (
        (memberUserId && t.assignedTo === memberUserId) ||
        (memberCode && t.assignedTo === memberCode)
      );
    }
    if (t.sharedWith && t.sharedWith.length > 0) {
      return t.sharedWith.some(
        (sm) =>
          (memberUserId && sm.userId === memberUserId) ||
          (memberCode && sm.code === memberCode)
      );
    }
    return false;
  };

  function getMemberCompletions(
    memberUserId?: string,
    memberCode?: string,
    isYou = false
  ) {
    const history = tasks.flatMap((t) => {
      return (t.history ?? []).filter((h) => {
        if (h.status === 'skipped' || !h.completedAt) return false;
        if (h.completedBy) {
          return (
            (memberUserId && h.completedBy === memberUserId) ||
            (memberCode && h.completedBy === memberCode)
          );
        }
        if (isYou) return true;
        return false;
      });
    });

    const completedCount = history.length;
    if (completedCount === 0) {
      return { completedCount: 0, onTimePercent: 100 };
    }
    const onTime = history.filter((h) => h.status === 'on_time').length;
    return {
      completedCount,
      onTimePercent: Math.round((onTime / completedCount) * 100),
    };
  }

  const youStats = getMemberCompletions(currentUserId, currentUserCode, true);
  const you: HouseholdMember = {
    name: currentUserName,
    short: initials(currentUserName),
    color: '#E8A33D',
    taskCount: tasks.filter(isYouTask).length,
    completedCount: youStats.completedCount,
    isYou: true,
    onTimePercent: youStats.onTimePercent,
  };

  const memberMap = new Map<string, HouseholdMember>();
  householdMembers.forEach((member) => {
    // Exclude current user from additional member map (since 'you' represents current user)
    if (
      (currentUserId && member.userId === currentUserId) ||
      (currentUserCode && member.code === currentUserCode) ||
      (member.name && member.name.trim().toLowerCase() === currentUserName.trim().toLowerCase())
    ) {
      return;
    }
    const mStats = getMemberCompletions(member.userId, member.code, false);
    const assignedCount = tasks.filter((t) => isMemberTask(t, member.userId, member.code)).length;

    memberMap.set(member.code, {
      name: member.name,
      short: initials(member.name),
      color: member.color,
      taskCount: assignedCount,
      completedCount: mStats.completedCount,
      code: member.code,
      userId: member.userId,
      status: member.status,
      onTimePercent: mStats.onTimePercent,
    });
  });

  // Only fallback to scanning task.sharedWith if no explicit household members were provided (legacy mode)
  if (householdMembers.length === 0) {
    tasks.forEach((task) => {
      (task.sharedWith ?? []).forEach((member) => {
        if (
          (currentUserId && member.userId === currentUserId) ||
          (currentUserCode && member.code === currentUserCode) ||
          (member.name && member.name.trim().toLowerCase() === currentUserName.trim().toLowerCase())
        ) {
          return;
        }
        const key = member.code ?? member.phone;
        if (!memberMap.has(key)) {
          const mStats = getMemberCompletions(member.userId, member.code, false);
          const assignedCount = tasks.filter((t) => isMemberTask(t, member.userId, member.code)).length;
          memberMap.set(key, {
            name: member.name,
            short: initials(member.name),
            color: member.color,
            taskCount: assignedCount,
            completedCount: mStats.completedCount,
            code: member.code,
            userId: member.userId,
            status: 'active',
            onTimePercent: mStats.onTimePercent,
          });
        }
      });
    });
  }

  const allMembers = [you, ...Array.from(memberMap.values())];

  // Rank by real contribution: active first, then completed count desc, then on-time percent desc, then task count desc
  allMembers.sort((a, b) => {
    if (a.status === 'active' && b.status === 'pending') return -1;
    if (b.status === 'active' && a.status === 'pending') return 1;

    const compDiff = (b.completedCount ?? 0) - (a.completedCount ?? 0);
    if (compDiff !== 0) return compDiff;

    if (b.onTimePercent !== a.onTimePercent) {
      return b.onTimePercent - a.onTimePercent;
    }

    return b.taskCount - a.taskCount;
  });

  return allMembers;
}

export function getHouseholdStats(tasks: RepeatingTask[]) {
  const shared = tasks.filter((t) => t.sharedWith && t.sharedWith.length > 0);

  const onTime = shared.reduce((acc, t) => {
    if (daysUntilDue(t.nextDueDate) < 0) return acc;
    const completed = (t.history ?? []).filter((h) => h.status !== 'skipped' && h.completedAt);
    if (completed.length === 0) return acc;
    const latest = completed[completed.length - 1];
    return acc + (latest.status === 'on_time' ? 1 : 0);
  }, 0);

  const totalWithHistory = shared.filter(
    (t) => (t.history ?? []).filter((h) => h.status !== 'skipped' && h.completedAt).length > 0
  ).length;

  return { onTime, total: totalWithHistory, shared };
}

export function filterTasksByScope(
  tasks: RepeatingTask[],
  scope: 'all' | 'personal' | string,
  validHouseholdIds?: Set<string>
): RepeatingTask[] {
  if (scope === 'all') return tasks;
  if (scope === 'personal') {
    return tasks.filter(
      (t) => !t.householdId || (validHouseholdIds && !validHouseholdIds.has(t.householdId))
    );
  }
  return tasks.filter((t) => t.householdId === scope);
}

export type { CompletionStatus };
