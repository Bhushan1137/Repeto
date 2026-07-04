import { useMemo } from 'react';
import type { CategoryKey, RepeatingTask, TaskGroup } from '@/types';
import { daysUntilDue, getTaskGroup } from '@/domain/recurrence';

export interface FilterState {
  query: string;
  group: TaskGroup | 'all';
  category: CategoryKey | 'all';
}

export const DEFAULT_FILTER: FilterState = {
  query: '',
  group: 'all',
  category: 'all',
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

    // Group filter (due date group)
    if (filter.group !== 'all') {
      result = result.filter((t) => getTaskGroup(daysUntilDue(t.nextDueDate)) === filter.group);
    }

    return result;
  }, [tasks, filter]);
}
