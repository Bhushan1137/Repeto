import { describe, expect, it, vi } from 'vitest';
import { GROUP_ORDER, useGroupedTasks } from '@/hooks/useGroupedTasks';
import { createTaskFromPreset } from '@/domain/task';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useMemo: (fn: () => unknown) => fn(),
  };
});

describe('hooks/useGroupedTasks', () => {
  it('groups tasks by due date bucket', () => {
    const t1 = createTaskFromPreset('Task 1', 'bills', 'Daily');
    t1.nextDueDate = new Date().toISOString();

    const grouped = useGroupedTasks([t1]);
    expect(grouped.length).toBeGreaterThan(0);
    expect(GROUP_ORDER).toContain('today');
  });
});
