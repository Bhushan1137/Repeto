import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTER, useFilteredTasks } from '@/hooks/useFilteredTasks';
import { createTaskFromPreset } from '@/domain/task';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useMemo: (fn: () => unknown) => fn(),
  };
});

describe('hooks/useFilteredTasks', () => {
  const task1 = createTaskFromPreset('Wifi Bill', 'bills', 'Monthly');
  const task2 = createTaskFromPreset('Gym Workout', 'health', 'Daily');
  const tasks = [task1, task2];

  it('returns all tasks with default filter', () => {
    const filtered = useFilteredTasks(tasks, DEFAULT_FILTER);
    expect(filtered).toHaveLength(2);
  });

  it('filters tasks by query string', () => {
    const filtered = useFilteredTasks(tasks, { ...DEFAULT_FILTER, query: 'wifi' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Wifi Bill');
  });

  it('filters tasks by category', () => {
    const filtered = useFilteredTasks(tasks, { ...DEFAULT_FILTER, category: 'health' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Gym Workout');
  });

  it('filters tasks by upcoming, today, and overdue groups', () => {
    const today = new Date();
    const overdueDate = new Date(today);
    overdueDate.setDate(today.getDate() - 2);
    const todayDate = new Date(today);
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 5);

    const distantDate = new Date(today);
    distantDate.setDate(today.getDate() + 135);

    const overdueTask = { ...task1, id: 't-overdue', nextDueDate: overdueDate.toISOString() };
    const todayTask = { ...task2, id: 't-today', nextDueDate: todayDate.toISOString() };
    const upcomingTask = { ...task1, id: 't-upcoming', nextDueDate: futureDate.toISOString() };
    const distantTask = { ...task1, id: 't-distant', nextDueDate: distantDate.toISOString() };
    const sample = [overdueTask, todayTask, upcomingTask, distantTask];

    const overdueFiltered = useFilteredTasks(sample, { ...DEFAULT_FILTER, group: 'overdue' });
    expect(overdueFiltered).toHaveLength(1);
    expect(overdueFiltered[0].id).toBe('t-overdue');

    const todayFiltered = useFilteredTasks(sample, { ...DEFAULT_FILTER, group: 'today' });
    expect(todayFiltered).toHaveLength(1);
    expect(todayFiltered[0].id).toBe('t-today');

    // Upcoming should include today and this week (0 <= d <= 7), but exclude distantTask (135d)
    const upcomingFiltered = useFilteredTasks(sample, { ...DEFAULT_FILTER, group: 'upcoming' });
    expect(upcomingFiltered).toHaveLength(2);
    expect(upcomingFiltered.map((t) => t.id)).toEqual(['t-today', 't-upcoming']);

    // Later should include tasks due in > 30 days
    const laterFiltered = useFilteredTasks(sample, { ...DEFAULT_FILTER, group: 'later' });
    expect(laterFiltered).toHaveLength(1);
    expect(laterFiltered[0].id).toBe('t-distant');
  });

  it('filters tasks by household context and personal tasks', () => {
    const personalTask = { ...task1, id: 't-personal', householdId: null };
    const hhTask1 = { ...task2, id: 't-hh1', householdId: 'hh-123' };
    const hhTask2 = { ...task1, id: 't-hh2', householdId: 'hh-456' };
    const sample = [personalTask, hhTask1, hhTask2];

    const personalFiltered = useFilteredTasks(sample, { ...DEFAULT_FILTER, householdId: 'personal' });
    expect(personalFiltered).toHaveLength(1);
    expect(personalFiltered[0].id).toBe('t-personal');

    const hh1Filtered = useFilteredTasks(sample, { ...DEFAULT_FILTER, householdId: 'hh-123' });
    expect(hh1Filtered).toHaveLength(1);
    expect(hh1Filtered[0].id).toBe('t-hh1');

    const allFiltered = useFilteredTasks(sample, { ...DEFAULT_FILTER, householdId: 'all' });
    expect(allFiltered).toHaveLength(3);
  });
});
