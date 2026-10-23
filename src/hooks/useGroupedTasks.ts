import { useMemo } from 'react';
import type { RepeatingTask, TaskGroup } from '@/types';
import { groupTasksByDue } from '@/domain/insights';

const GROUP_ORDER: TaskGroup[] = ['overdue', 'today', 'week', 'month', 'later'];

export function useGroupedTasks(tasks: RepeatingTask[], dayKey?: string) {
  return useMemo(() => {
    const grouped = groupTasksByDue(tasks);
    return GROUP_ORDER.map((group) => ({ group, items: grouped[group] })).filter(
      (g) => g.items.length > 0
    );
  }, [tasks, dayKey]);
}

export { GROUP_ORDER };
