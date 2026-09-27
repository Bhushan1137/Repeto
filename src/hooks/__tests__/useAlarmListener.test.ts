import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAlarmListener } from '../useAlarmListener';

vi.mock('@/providers/TaskProvider', () => ({
  useTasks: () => ({
    completeTask: vi.fn(),
    snoozeTask: vi.fn(),
  }),
}));

vi.mock('expo-notifications', () => ({
  addNotificationReceivedListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
}));

describe('useAlarmListener hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports useAlarmListener as a function', () => {
    expect(typeof useAlarmListener).toBe('function');
  });
});
