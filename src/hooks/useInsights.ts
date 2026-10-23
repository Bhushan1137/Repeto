import { useMemo } from 'react';
import type { HouseholdMemberProfile, RepeatingTask } from '@/types';
import {
  computeInsights,
  computeUpcomingStrip,
  computeSpendForecast,
  computeMonthTrend,
  computeConsistencyMatrix,
  computeWeeklyVelocity,
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

/** P5 — 28-day Habit consistency matrix */
export function useConsistencyMatrix(tasks: RepeatingTask[]) {
  return useMemo(() => computeConsistencyMatrix(tasks), [tasks]);
}

/** P6 — Weekly habit velocity stats */
export function useWeeklyVelocity(tasks: RepeatingTask[]) {
  return useMemo(() => computeWeeklyVelocity(tasks), [tasks]);
}

export function useHousehold(
  tasks: RepeatingTask[],
  customMembers?: HouseholdMemberProfile[]
) {
  const { user, activeHousehold } = useAuth();
  const { language } = useTranslation();

  return useMemo(() => {
    const stats = getHouseholdStats(tasks);
    // Use scoped custom members if provided, else fallback to active context
    const rawMembers = customMembers ?? activeHousehold?.members ?? user?.householdMembers ?? [];
    const members = deriveHouseholdMembers(
      tasks,
      user?.name ?? 'You',
      rawMembers,
      user?.id,
      user?.userCode
    );
    return { stats, members, language };
  }, [tasks, customMembers, user?.name, activeHousehold, user?.householdMembers, user?.id, user?.userCode, language]);
}
