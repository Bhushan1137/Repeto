import type { CategoryKey, CompletionStatus, HouseholdMemberProfile, RepeatingTask, TaskGroup } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { daysUntilDue, getTaskGroup, isCurrentMonth } from '@/domain/recurrence';

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

export interface InsightsResult {
  overallPercent: number;
  bars: CategoryInsight[];
  slipCategory: CategoryKey | null;
  isEmpty: boolean;
  streak: number;
  weeklyActivity: DailyActivity[];
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

  if (total === 0) {
    return { overallPercent: 0, bars: [], slipCategory: null, isEmpty: true, streak, weeklyActivity };
  }

  const onTime = completedEntries.filter((h) => h.status === 'on_time').length;
  const overallPercent = Math.round((onTime / total) * 100);

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
  };
}

export interface HouseholdMember {
  name: string;
  short: string;
  color: string;
  taskCount: number;
  isYou?: boolean;
  code?: string;
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
  currentUserId?: string
): HouseholdMember[] {
  const you: HouseholdMember = {
    name: currentUserName,
    short: initials(currentUserName),
    color: '#E8A33D',
    taskCount: tasks.length,
    isYou: true,
    onTimePercent: calculateMemberOnTime(tasks, currentUserId, undefined, true),
  };

  const memberMap = new Map<string, HouseholdMember>();
  householdMembers.forEach((member) => {
    memberMap.set(member.code, {
      name: member.name,
      short: initials(member.name),
      color: member.color,
      taskCount: 0,
      code: member.code,
      status: member.status,
      onTimePercent: 100,
    });
  });

  tasks.forEach((task) => {
    task.sharedWith.forEach((member) => {
      const key = member.code ?? member.phone;
      const existing = memberMap.get(key);
      if (existing) {
        existing.taskCount += 1;
      } else {
        memberMap.set(key, {
          name: member.name,
          short: initials(member.name),
          color: member.color,
          taskCount: 1,
          code: member.code,
          status: 'active',
          onTimePercent: 100,
        });
      }
    });
  });

  // Calculate stats for other members
  memberMap.forEach((m) => {
    m.onTimePercent = calculateMemberOnTime(tasks, m.code, m.code, false);
  });

  return [you, ...memberMap.values()];
}

export function getHouseholdStats(tasks: RepeatingTask[]) {
  const shared = tasks.filter((t) => t.sharedWith.length > 0);

  // A shared task counts as "on time" when:
  // - It is not currently overdue (next due date is today or future), AND
  // - It has at least one completed (non-skipped) history entry where the latest is on_time.
  // Tasks with no history yet that aren't overdue are treated as neutral (not counted either way).
  const onTime = shared.reduce((acc, t) => {
    if (daysUntilDue(t.nextDueDate) < 0) return acc; // currently overdue — not on time
    const completed = t.history.filter((h) => h.status !== 'skipped' && h.completedAt);
    if (completed.length === 0) return acc; // no completion history yet — neutral, skip
    const latest = completed[completed.length - 1];
    return acc + (latest.status === 'on_time' ? 1 : 0);
  }, 0);

  // Total counts only shared tasks that have at least one completion history entry
  const totalWithHistory = shared.filter(
    (t) => t.history.filter((h) => h.status !== 'skipped' && h.completedAt).length > 0
  ).length;

  return { onTime, total: totalWithHistory, shared };
}

export type { CompletionStatus };
