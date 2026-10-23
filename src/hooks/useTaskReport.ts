import { useMemo, useState } from 'react';
import type { RepeatingTask } from '@/types';
import {
  computeTaskReport,
  filterRows,
  sortRows,
  type TaskStatusFilter,
  type TaskSort,
  type TaskReportRow,
} from '@/domain/taskReport';

export function useTaskReport(tasks: RepeatingTask[]) {
  return useMemo(() => computeTaskReport(tasks), [tasks]);
}

export function useFilteredReport(
  rows: TaskReportRow[],
  filter: TaskStatusFilter,
  sort: TaskSort,
  search: string
): TaskReportRow[] {
  return useMemo(
    () => sortRows(filterRows(rows, filter, search), sort),
    [rows, filter, sort, search]
  );
}

/** Convenience hook — manages filter/sort/search state + returns filtered rows */
export function useTaskReportState(tasks: RepeatingTask[]) {
  const [filter, setFilter] = useState<TaskStatusFilter>('all');
  const [sort, setSort] = useState<TaskSort>('due_soon');
  const [search, setSearch] = useState('');

  const allRows = useTaskReport(tasks);
  const filteredRows = useFilteredReport(allRows, filter, sort, search);

  const clearFilters = () => {
    setFilter('all');
    setSearch('');
  };

  const isFiltered = filter !== 'all' || search.trim().length > 0;

  return {
    allRows,
    filteredRows,
    filter, setFilter,
    sort, setSort,
    search, setSearch,
    clearFilters,
    isFiltered,
  };
}
