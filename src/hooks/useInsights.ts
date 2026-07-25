import { useMemo } from 'react';
import type { RepeatingTask } from '@/types';
import {
  computeInsights,
  computeUpcomingStrip,
  computeSpendForecast,
  computeMonthTrend,
  deriveHouseholdMembers,
  getHouseholdStats,
} from '@/domain/insights';
import { useAuth } from '@/providers/AuthProvider';
import { useTranslation } from '@/hooks/useTranslation';

export function useInsights(tasks: RepeatingTask[]) {
  const { language } = useTranslation();
  return useMemo(() => computeInsights(tasks, language), [tasks, language]);
}

/** P1 — 14-day upcoming due strip */
export function useUpcomingStrip(tasks: RepeatingTask[]) {
  const { language } = useTranslation();
  return useMemo(() => computeUpcomingStrip(tasks, language), [tasks, language]);
}

/** P3 — Monthly spend forecast */
export function useSpendForecast(tasks: RepeatingTask[]) {
  const { language } = useTranslation();
  return useMemo(() => computeSpendForecast(tasks, language), [tasks, language]);
}

/** P4 — Month-over-month trend */
export function useMonthTrend(tasks: RepeatingTask[]) {
  const { language } = useTranslation();
  return useMemo(() => computeMonthTrend(tasks, language), [tasks, language]);
}

export function useHousehold(tasks: RepeatingTask[]) {
  const { user, activeHousehold } = useAuth();
  const { language } = useTranslation();

  return useMemo(() => {
    const stats = getHouseholdStats(tasks);
    // Use active household members so leaderboard reflects the current context
    const members = deriveHouseholdMembers(
      tasks,
      user?.name ?? 'You',
      activeHousehold?.members ?? user?.householdMembers ?? [],
      user?.id,
      user?.userCode
    );
    return { stats, members, language };
  }, [tasks, user?.name, activeHousehold, user?.householdMembers, user?.id, user?.userCode, language]);
}
