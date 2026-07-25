import type { CategoryKey, CompletionStatus, HouseholdMemberProfile, RepeatingTask, TaskGroup } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { daysUntilDue, getTaskGroup, isCurrentMonth, getMonthLabel } from '@/domain/recurrence';

export interface CategoryInsight {
  label: string;
  percent: number;
  key: CategoryKey;
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
  category: CategoryKey;
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
  key: CategoryKey;
  label: string;
  icon: string;
  amount: number;
}

export interface SpendForecast {
  thisMonthTotal: number;
  nextMonthTotal: number;
  yearlyEstimate: number;
  byCategory: SpendForecastCategory[];
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

// ─── Existing InsightsResult (extended for P2 + P6) ──────────────────────

export interface InsightsResult {
  overallPercent: number;
  bars: CategoryInsight[];
  slipCategory: CategoryKey | null;
  isEmpty: boolean;
  streak: number;
  weeklyActivity: DailyActivity[];
  completionsCount: number;
  skippedCount: number;
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

export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function groupTasksByDue(tasks: RepeatingTask[]): Record<TaskGroup, RepeatingTask[]> {
  const groups: Record<TaskGroup, RepeatingTask[]> = {
    overdue: [],
    today: [],
    week: [],
    month: [],
  };
  tasks.forEach((task) => {
    const group = getTaskGroup(daysUntilDue(task.nextDueDate));
    groups[group].push(task);
  });
  // Sort each group by soonest due first
  (Object.keys(groups) as TaskGroup[]).forEach((key) => {
    groups[key].sort(
      (a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
    );
  });
  return groups;
}

export function computeInsights(tasks: RepeatingTask[], lang: 'en' | 'hi'): InsightsResult {
  const completedEntries = tasks.flatMap((t) =>
    t.history.filter((h) => h.status !== 'skipped' && isCurrentMonth(h.month))
  );
  const total = completedEntries.length;
  const streak = calculateStreak(tasks);
  const weeklyActivity = getWeeklyActivity(tasks, lang);

  const completionsCount = tasks.reduce((sum, t) => sum + t.history.filter(h => h.status === 'on_time' || h.status === 'late').length, 0);
  const skippedCount = tasks.reduce((sum, t) => sum + t.history.filter(h => h.status === 'skipped').length, 0);
  const activeTasksCount = tasks.length;

  // P2: overdue count
  const overdueCount = tasks.filter(t => daysUntilDue(t.nextDueDate) < 0).length;

  // P6: weekly completion count (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weeklyCompletionCount = tasks
    .flatMap(t => t.history)
    .filter(h =>
      h.completedAt &&
      new Date(h.completedAt) >= sevenDaysAgo &&
      (h.status === 'on_time' || h.status === 'late')
    ).length;

  if (total === 0) {
    return {
      overallPercent: 0,
      bars: [],
      slipCategory: null,
      isEmpty: true,
      streak,
      weeklyActivity,
      completionsCount,
      skippedCount,
      activeTasksCount,
      overdueCount,
      healthStatus: overdueCount > 0 ? 'attention' : 'great',
      weeklyCompletionCount,
    };
  }

  const onTime = completedEntries.filter((h) => h.status === 'on_time').length;
  const overallPercent = Math.round((onTime / total) * 100);

  // P2: health status
  const healthStatus: InsightsResult['healthStatus'] =
    overallPercent >= 75 ? 'great' : overallPercent >= 50 ? 'ok' : 'attention';

  const byCategory: Record<string, { onTime: number; total: number }> = {};
  tasks.forEach((task) => {
    if (!byCategory[task.category]) byCategory[task.category] = { onTime: 0, total: 0 };
    task.history
      .filter((h) => h.status !== 'skipped' && isCurrentMonth(h.month))
      .forEach((h) => {
        byCategory[task.category].total += 1;
        if (h.status === 'on_time') byCategory[task.category].onTime += 1;
      });
  });

  const bars: CategoryInsight[] = Object.entries(byCategory)
    .filter(([, stats]) => stats.total > 0)
    .map(([key, stats]) => {
      const cat = CATEGORY_MAP[key as CategoryKey];
      return {
        key: key as CategoryKey,
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
    weeklyActivity,
    completionsCount,
    skippedCount,
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

export function computeSpendForecast(
  tasks: RepeatingTask[],
  lang: 'en' | 'hi'
): SpendForecast {
  const financeTasks = tasks.filter(t => !t.archived && (t.finance === true || (t.amount !== undefined && Number(t.amount) > 0)));

  let thisMonthTotal = 0;
  let nextMonthTotal = 0;
  const byCategoryMap = new Map<CategoryKey, number>();

  financeTasks.forEach(t => {
    const amount = Number(t.amount) || 0;
    if (!amount) return;

    thisMonthTotal += amount;
    nextMonthTotal += amount;
    byCategoryMap.set(t.category, (byCategoryMap.get(t.category) ?? 0) + amount);
  });

  const byCategory: SpendForecastCategory[] = Array.from(byCategoryMap.entries())
    .map(([key, amount]) => {
      const cat = CATEGORY_MAP[key];
      return { key, label: lang === 'hi' ? cat.labelHi : cat.labelEn, icon: cat.icon, amount };
    })
    .sort((a, b) => b.amount - a.amount);

  const baseMonthly = thisMonthTotal || nextMonthTotal;

  return {
    thisMonthTotal,
    nextMonthTotal,
    yearlyEstimate: baseMonthly * 12,
    byCategory,
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
    return t.history.filter((h) => {
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
  const you: HouseholdMember = {
    name: currentUserName,
    short: initials(currentUserName),
    color: '#E8A33D',
    taskCount: tasks.length,
    isYou: true,
    onTimePercent: calculateMemberOnTime(tasks, currentUserId, currentUserCode, true),
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
    memberMap.set(member.code, {
      name: member.name,
      short: initials(member.name),
      color: member.color,
      taskCount: 0,
      code: member.code,
      userId: member.userId,
      status: member.status,
      onTimePercent: 100,
    });
  });

  tasks.forEach((task) => {
    task.sharedWith.forEach((member) => {
      if (
        (currentUserId && member.userId === currentUserId) ||
        (currentUserCode && member.code === currentUserCode)
      ) {
        return;
      }
      const key = member.code ?? member.phone;
      const existing = memberMap.get(key);
      if (existing) {
        existing.taskCount += 1;
        if (member.userId) existing.userId = member.userId;
      } else {
        memberMap.set(key, {
          name: member.name,
          short: initials(member.name),
          color: member.color,
          taskCount: 1,
          code: member.code,
          userId: member.userId,
          status: 'active',
          onTimePercent: 100,
        });
      }
    });
  });

  // Calculate stats for other members
  memberMap.forEach((m) => {
    m.onTimePercent = calculateMemberOnTime(tasks, m.userId, m.code, false);
  });

  return [you, ...memberMap.values()];
}

export function getHouseholdStats(tasks: RepeatingTask[]) {
  const shared = tasks.filter((t) => t.sharedWith.length > 0);

  const onTime = shared.reduce((acc, t) => {
    if (daysUntilDue(t.nextDueDate) < 0) return acc;
    const completed = t.history.filter((h) => h.status !== 'skipped' && h.completedAt);
    if (completed.length === 0) return acc;
    const latest = completed[completed.length - 1];
    return acc + (latest.status === 'on_time' ? 1 : 0);
  }, 0);

  const totalWithHistory = shared.filter(
    (t) => t.history.filter((h) => h.status !== 'skipped' && h.completedAt).length > 0
  ).length;

  return { onTime, total: totalWithHistory, shared };
}

export type { CompletionStatus };
