import type { CategoryKey, Language, RepeatingTask } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { daysUntilDue } from '@/domain/recurrence';

export interface FinanceItem {
  task: RepeatingTask;
  amount: number;
  status: 'paid' | 'due' | 'overdue';
  dueDate: string;
  paidAt?: string;
}

export interface CategorySpendBreakdown {
  key: CategoryKey;
  label: string;
  icon: string;
  projected: number;
  paid: number;
  remaining: number;
  percentPaid: number;
}

export interface DetailedSpendReport {
  projectedSpend: number;
  paidSoFar: number;
  remainingDue: number;
  percentPaid: number;
  paidCount: number;
  pendingCount: number;
  totalFinanceTasks: number;
  yearlyEstimate: number;
  categoryBreakdown: CategorySpendBreakdown[];
  itemList: FinanceItem[];
}

import { isCurrentMonth } from '@/domain/recurrence';
import { frequencyMultiplier } from '@/domain/insights';

export function computeDetailedSpendReport(
  tasks: RepeatingTask[],
  lang: Language,
  scopeFilter: string = 'all'
): DetailedSpendReport {
  const financeTasks = tasks.filter((t) => {
    if (t.archived) return false;
    if (!t.finance && (!t.amount || Number(t.amount) <= 0)) return false;
    if (scopeFilter === 'personal') return !t.householdId;
    if (scopeFilter !== 'all') return t.householdId === scopeFilter;
    return true;
  });

  let projectedSpend = 0;
  let paidSoFar = 0;
  let paidCount = 0;
  let pendingCount = 0;

  const categoryMap: Record<
    string,
    { projected: number; paid: number; remaining: number }
  > = {};

  const itemList: FinanceItem[] = [];

  for (const t of financeTasks) {
    const rawAmt = Number(t.amount) || 0;
    const mult = frequencyMultiplier(t.recurrence);
    const monthlyAmt = Math.round(rawAmt * mult);
    projectedSpend += monthlyAmt;

    if (!categoryMap[t.category]) {
      categoryMap[t.category] = { projected: 0, paid: 0, remaining: 0 };
    }
    categoryMap[t.category].projected += monthlyAmt;

    // Check completions in current month
    const currentMonthEntries = (t.history ?? []).filter(
      (h) =>
        (h.status === 'on_time' || h.status === 'late') &&
        (isCurrentMonth(h.month ?? '') || (h.completedAt ? isCurrentMonth(h.completedAt.slice(0, 7)) : false))
    );
    const completionsCountThisMonth = currentMonthEntries.length;

    const isHighFrequency =
      t.recurrence?.type === 'daily' ||
      t.recurrence?.type === 'weekly' ||
      (t.recurrence?.type === 'interval' && t.recurrence?.intervalUnit === 'days');

    const paidAmt = isHighFrequency
      ? Math.min(monthlyAmt, rawAmt * completionsCountThisMonth)
      : completionsCountThisMonth > 0
      ? monthlyAmt
      : 0;

    paidSoFar += paidAmt;
    categoryMap[t.category].paid += paidAmt;

    const days = daysUntilDue(t.nextDueDate);
    const isOverdue = days < 0;
    const isPaid = isHighFrequency ? paidAmt >= monthlyAmt : completionsCountThisMonth > 0;

    if (isPaid) {
      paidCount += 1;
      itemList.push({
        task: t,
        amount: rawAmt,
        status: 'paid',
        dueDate: t.nextDueDate,
        paidAt: currentMonthEntries[currentMonthEntries.length - 1]?.completedAt,
      });
    } else {
      pendingCount += 1;
      itemList.push({
        task: t,
        amount: rawAmt,
        status: isOverdue ? 'overdue' : 'due',
        dueDate: t.nextDueDate,
      });
    }
  }

  // Ensure remaining in categories strictly reflects projected - paid
  Object.values(categoryMap).forEach((cat) => {
    cat.remaining = Math.max(0, cat.projected - cat.paid);
  });

  const remainingDue = Math.max(0, projectedSpend - paidSoFar);
  const percentPaid = projectedSpend > 0 ? Math.round((paidSoFar / projectedSpend) * 100) : 0;
  const yearlyEstimate = projectedSpend * 12;

  // Build category breakdown array
  const categoryBreakdown: CategorySpendBreakdown[] = Object.entries(categoryMap)
    .map(([key, data]) => {
      const cat = CATEGORY_MAP[key as CategoryKey] || CATEGORY_MAP['home'];
      const catPercent = data.projected > 0 ? Math.round((data.paid / data.projected) * 100) : 0;
      return {
        key: key as CategoryKey,
        label: lang === 'hi' ? cat.labelHi : cat.labelEn,
        icon: cat.icon,
        projected: data.projected,
        paid: data.paid,
        remaining: data.remaining,
        percentPaid: catPercent,
      };
    })
    .sort((a, b) => b.projected - a.projected);

  // Sort item list: overdue first, then due soon, then paid
  itemList.sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (b.status === 'overdue' && a.status !== 'overdue') return 1;
    if (a.status === 'due' && b.status === 'paid') return -1;
    if (b.status === 'due' && a.status === 'paid') return 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return {
    projectedSpend,
    paidSoFar,
    remainingDue,
    percentPaid,
    paidCount,
    pendingCount,
    totalFinanceTasks: financeTasks.length,
    yearlyEstimate,
    categoryBreakdown,
    itemList,
  };
}
