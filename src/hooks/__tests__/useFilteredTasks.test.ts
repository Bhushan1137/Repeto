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
});
