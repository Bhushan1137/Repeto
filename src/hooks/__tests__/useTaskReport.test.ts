import { describe, expect, it, vi } from 'vitest';
import { useFilteredReport, useTaskReport } from '@/hooks/useTaskReport';
import { createTaskFromPreset } from '@/domain/task';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useMemo: (fn: () => unknown) => fn(),
  };
});

describe('hooks/useTaskReport', () => {
  it('useTaskReport computes rows for task list', () => {
    const t1 = createTaskFromPreset('Wifi', 'bills', 'Monthly');
    const rows = useTaskReport([t1]);

    expect(rows).toHaveLength(1);
    expect(rows[0].task.title).toBe('Wifi');
  });

  it('useFilteredReport filters and sorts rows', () => {
    const t1 = createTaskFromPreset('Wifi', 'bills', 'Monthly');
    const rows = useTaskReport([t1]);
    const filtered = useFilteredReport(rows, 'all', 'due_soon', 'Wifi');

    expect(filtered).toHaveLength(1);
  });
});
