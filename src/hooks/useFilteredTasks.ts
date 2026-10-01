import { useMemo } from 'react';
import type { AnyCategoryKey, RepeatingTask, TaskGroup } from '@/types';
import { daysUntilDue } from '@/domain/recurrence';

export type FilterGroup = TaskGroup | 'upcoming' | 'all';

export interface FilterState {
  query: string;
  group: FilterGroup;
  category: AnyCategoryKey | 'all';
  householdId?: string | 'all' | 'personal';
}

export const DEFAULT_FILTER: FilterState = {
  query: '',
  group: 'all',
  category: 'all',
  householdId: 'all',
};

export function useFilteredTasks(tasks: RepeatingTask[], filter: FilterState) {
  return useMemo(() => {
    let result = tasks;

    // Query filter — search by title
    if (filter.query.trim()) {
      const q = filter.query.toLowerCase().trim();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }

    // Category filter
    if (filter.category !== 'all') {
      result = result.filter((t) => t.category === filter.category);
    }

    // Household context filter
    if (filter.householdId && filter.householdId !== 'all') {
      if (filter.householdId === 'personal') {
        result = result.filter((t) => !t.householdId);
      } else {
        result = result.filter((t) => t.householdId === filter.householdId);
      }
    }

    // Group filter (due date group)
    if (filter.group === 'upcoming') {
      result = result.filter((t) => {
        const d = daysUntilDue(t.nextDueDate);
        return d >= 0 && d <= 7;
      });
    } else if (filter.group === 'today') {
      result = result.filter((t) => daysUntilDue(t.nextDueDate) === 0);
    } else if (filter.group === 'overdue') {
      result = result.filter((t) => daysUntilDue(t.nextDueDate) < 0);
    } else if (filter.group === 'week') {
      result = result.filter((t) => {
        const d = daysUntilDue(t.nextDueDate);
        return d > 0 && d <= 7;
      });
    } else if (filter.group === 'month') {
      result = result.filter((t) => {
        const d = daysUntilDue(t.nextDueDate);
        return d > 7 && d <= 30;
      });
    } else if (filter.group === 'later') {
      result = result.filter((t) => daysUntilDue(t.nextDueDate) > 30);
    }

    return result;
  }, [tasks, filter]);
}
