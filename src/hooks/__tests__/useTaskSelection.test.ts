import { describe, expect, it } from 'vitest';
import { useTaskSelection } from '@/hooks/useTaskSelection';

describe('hooks/useTaskSelection', () => {
  it('instantiates hook definition cleanly', () => {
    expect(typeof useTaskSelection).toBe('function');
  });
});
