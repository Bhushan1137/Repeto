import { useMemo } from 'react';
import type { RepeatingTask } from '@/types';
import { computeInsights, deriveHouseholdMembers, getHouseholdStats } from '@/domain/insights';
import { useAuth } from '@/providers/AuthProvider';
import { useTranslation } from '@/hooks/useTranslation';

export function useInsights(tasks: RepeatingTask[]) {
  const { language } = useTranslation();
  return useMemo(() => computeInsights(tasks, language), [tasks, language]);
}

export function useHousehold(tasks: RepeatingTask[]) {
  const { user } = useAuth();
  const { language } = useTranslation();

  return useMemo(() => {
    const stats = getHouseholdStats(tasks);
    const members = deriveHouseholdMembers(tasks, user?.name ?? 'You', user?.householdMembers ?? [], user?.id);
    return { stats, members, language };
  }, [tasks, user?.name, user?.householdMembers, user?.id, language]);
}
