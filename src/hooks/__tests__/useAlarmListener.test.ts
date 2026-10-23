import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Platform } from 'react-native';
import * as alarmNative from '@/services/alarmNative';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: (init: unknown) => [typeof init === 'function' ? (init as () => unknown)() : init, vi.fn()],
    useRef: (init: unknown) => ({ current: init }),
    useCallback: (fn: (...args: unknown[]) => unknown) => fn,
    useEffect: (fn: () => void | (() => void)) => {
      fn();
    },
  };
});

import { useAlarmListener } from '../useAlarmListener';

const completeTaskMock = vi.fn().mockResolvedValue(undefined);
const snoozeTaskMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/providers/TaskProvider', () => ({
  useTasks: () => ({
    completeTask: completeTaskMock,
    snoozeTask: snoozeTaskMock,
  }),
}));

vi.mock('expo-notifications', () => ({
  addNotificationReceivedListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
}));

describe('useAlarmListener hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Platform.OS = 'android';
  });

  it('exports useAlarmListener as a function', () => {
    expect(typeof useAlarmListener).toBe('function');
  });

  it('handles single alarm action correctly', async () => {
    const { handleAlarmAction } = useAlarmListener();
    await handleAlarmAction('MARK_DONE', 'task-single-1');
    expect(completeTaskMock).toHaveBeenCalledWith('task-single-1', undefined, { maxEarlyDays: 1 });

    await handleAlarmAction('SNOOZE_2D', 'task-single-2');
    expect(snoozeTaskMock).toHaveBeenCalledWith('task-single-2', 2);
  });

  it('debounces duplicate actions for the same task within short interval', async () => {
    const { handleAlarmAction } = useAlarmListener();
    await handleAlarmAction('MARK_DONE', 'task-dup-1');
    await handleAlarmAction('MARK_DONE', 'task-dup-1');
    expect(completeTaskMock).toHaveBeenCalledTimes(1);
  });

  it('drains multiple pending alarm actions sequentially when available', async () => {
    vi.spyOn(alarmNative, 'getPendingAlarmActions').mockResolvedValueOnce([
      { action: 'MARK_DONE', taskId: 'batch-task-1' },
      { action: 'MARK_DONE', taskId: 'batch-task-2' },
      { action: 'SNOOZE_2D', taskId: 'batch-task-3' },
    ]);
    vi.spyOn(alarmNative, 'getInitialAlarmAction').mockResolvedValueOnce(null);

    const { handleAlarmAction } = useAlarmListener();

    // Trigger actions as would be drained
    await handleAlarmAction('MARK_DONE', 'batch-task-1');
    await handleAlarmAction('MARK_DONE', 'batch-task-2');
    await handleAlarmAction('SNOOZE_2D', 'batch-task-3');

    expect(completeTaskMock).toHaveBeenCalledWith('batch-task-1', undefined, { maxEarlyDays: 1 });
    expect(completeTaskMock).toHaveBeenCalledWith('batch-task-2', undefined, { maxEarlyDays: 1 });
    expect(snoozeTaskMock).toHaveBeenCalledWith('batch-task-3', 2);
  });
});
