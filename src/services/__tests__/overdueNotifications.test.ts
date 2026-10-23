import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  cancelOverdueReminders,
  scheduleOverdueReminders,
  syncOverdueNotifications,
} from '@/services/notifications';
import type { RepeatingTask } from '@/types';

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  setNotificationCategoryAsync: vi.fn().mockResolvedValue(true),
  setNotificationChannelAsync: vi.fn().mockResolvedValue(true),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: vi.fn().mockResolvedValue('notif-id'),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(true),
  dismissNotificationAsync: vi.fn().mockResolvedValue(undefined),
  getExpoPushTokenAsync: vi.fn().mockResolvedValue({ data: 'ExponentPushToken[mock]' }),
  SchedulableTriggerInputTypes: {
    DATE: 'date',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
    TIME_INTERVAL: 'timeInterval',
  },
  AndroidImportance: { HIGH: 4 },
}));

function makeTask(overrides: Partial<RepeatingTask> = {}): RepeatingTask {
  // Default: overdue — nextDueDate set to yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return {
    id: 'task-overdue-1',
    title: 'Pay Electricity Bill',
    category: 'bills',
    householdId: null,
    recurrence: { type: 'monthly' },
    frequencyLabel: 'Monthly',
    nextDueDate: yesterday.toISOString(),
    finance: true,
    sharedWith: [],
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    escalationCount: 0,
    reminderTime: '09:30',
    ...overrides,
  };
}

describe('services/notifications — overdue helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Platform.OS = 'ios';
  });

  // ─── cancelOverdueReminders ───────────────────────────────────────────────
  describe('cancelOverdueReminders', () => {
    it('cancels d1 and d2 identifiers for the given task', async () => {
      await cancelOverdueReminders('task-abc');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'overdue-task-abc-d1'
      );
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'overdue-task-abc-d2'
      );
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    });

    it('is a no-op on web platform', async () => {
      Platform.OS = 'web';
      await cancelOverdueReminders('task-web');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });
  });

  // ─── scheduleOverdueReminders ─────────────────────────────────────────────
  describe('scheduleOverdueReminders', () => {
    it('schedules two DATE notifications (d1, d2) at the task reminderTime', async () => {
      const task = makeTask({ reminderTime: '09:30' });
      await scheduleOverdueReminders(task);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: `overdue-${task.id}-d1`,
          trigger: expect.objectContaining({ type: 'date' }),
          content: expect.objectContaining({
            title: '⚠️ Overdue Reminder',
            body: expect.stringContaining(task.title),
            categoryIdentifier: 'task-actions',
          }),
        })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: `overdue-${task.id}-d2`,
          trigger: expect.objectContaining({ type: 'date' }),
        })
      );
    });

    it('defaults to hour=9 minute=0 when reminderTime is not set', async () => {
      const task = makeTask({ reminderTime: undefined });
      await scheduleOverdueReminders(task);

      const calls = (
        Notifications.scheduleNotificationAsync as ReturnType<typeof vi.fn>
      ).mock.calls as unknown[][];
      const d1Call = calls.find(
        (args) => (args[0] as { identifier: string }).identifier === `overdue-${task.id}-d1`
      );
      expect(d1Call).toBeDefined();
      const triggerDate = (d1Call![0] as { trigger: { date: Date } }).trigger.date;
      expect(triggerDate.getHours()).toBe(9);
      expect(triggerDate.getMinutes()).toBe(0);
    });

    it('uses the custom reminderTime for trigger dates', async () => {
      const task = makeTask({ reminderTime: '14:45' });
      await scheduleOverdueReminders(task);

      const calls = (
        Notifications.scheduleNotificationAsync as ReturnType<typeof vi.fn>
      ).mock.calls as unknown[][];
      const d2Call = calls.find(
        (args) => (args[0] as { identifier: string }).identifier === `overdue-${task.id}-d2`
      );
      expect(d2Call).toBeDefined();
      const triggerDate = (d2Call![0] as { trigger: { date: Date } }).trigger.date;
      expect(triggerDate.getHours()).toBe(14);
      expect(triggerDate.getMinutes()).toBe(45);
    });

    it('d1 trigger date is tomorrow and d2 trigger date is the day after', async () => {
      const task = makeTask({ reminderTime: '08:00' });
      await scheduleOverdueReminders(task);

      type CallArg = { identifier: string; trigger: { date: Date } };
      const calls = (
        Notifications.scheduleNotificationAsync as ReturnType<typeof vi.fn>
      ).mock.calls as unknown[][];

      const d1 = (calls.find(
        (args) => (args[0] as CallArg).identifier === `overdue-${task.id}-d1`
      )![0] as CallArg).trigger.date;
      const d2 = (calls.find(
        (args) => (args[0] as CallArg).identifier === `overdue-${task.id}-d2`
      )![0] as CallArg).trigger.date;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);

      expect(d1.getDate()).toBe(tomorrow.getDate());
      expect(d2.getDate()).toBe(dayAfter.getDate());
    });

    it('does NOT schedule for archived tasks', async () => {
      const task = makeTask({ archived: true });
      await scheduleOverdueReminders(task);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('does NOT schedule for snoozed tasks', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 2);
      const task = makeTask({ snoozedUntil: future.toISOString() });
      await scheduleOverdueReminders(task);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('is a no-op on web platform', async () => {
      Platform.OS = 'web';
      await scheduleOverdueReminders(makeTask());
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('includes taskId and type=overdue in notification data payload', async () => {
      const task = makeTask();
      await scheduleOverdueReminders(task);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            data: expect.objectContaining({ taskId: task.id, type: 'overdue' }),
          }),
        })
      );
    });

    it('cancels existing overdue reminders before rescheduling', async () => {
      const task = makeTask();
      await scheduleOverdueReminders(task);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        `overdue-${task.id}-d1`
      );
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        `overdue-${task.id}-d2`
      );
    });
  });

  // ─── syncOverdueNotifications ─────────────────────────────────────────────
  describe('syncOverdueNotifications', () => {
    it('schedules overdue reminders for past-due, non-archived, non-snoozed tasks', async () => {
      const overdueTask = makeTask();
      await syncOverdueNotifications([overdueTask]);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: `overdue-${overdueTask.id}-d1` })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: `overdue-${overdueTask.id}-d2` })
      );
    });

    it('cancels overdue reminders for tasks due today (not past)', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentTask = makeTask({ nextDueDate: today.toISOString() });
      await syncOverdueNotifications([currentTask]);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        `overdue-${currentTask.id}-d1`
      );
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        `overdue-${currentTask.id}-d2`
      );
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels overdue reminders for archived overdue tasks', async () => {
      const archivedOverdue = makeTask({ archived: true });
      await syncOverdueNotifications([archivedOverdue]);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        `overdue-${archivedOverdue.id}-d1`
      );
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels overdue reminders for snoozed overdue tasks', async () => {
      const snoozeDate = new Date();
      snoozeDate.setDate(snoozeDate.getDate() + 2);
      const snoozedOverdue = makeTask({ snoozedUntil: snoozeDate.toISOString() });
      await syncOverdueNotifications([snoozedOverdue]);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        `overdue-${snoozedOverdue.id}-d1`
      );
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('handles a mixed list: schedules for overdue and cancels for current tasks', async () => {
      const overdueTask = makeTask({ id: 'o-1' });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentTask = makeTask({ id: 'c-1', nextDueDate: today.toISOString() });

      await syncOverdueNotifications([overdueTask, currentTask]);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'overdue-o-1-d1' })
      );
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('overdue-c-1-d1');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('overdue-c-1-d2');
    });

    it('processes an empty task list without error', async () => {
      await expect(syncOverdueNotifications([])).resolves.toBeUndefined();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('is a no-op on web platform', async () => {
      Platform.OS = 'web';
      await syncOverdueNotifications([makeTask()]);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('is a no-op when permissions are denied', async () => {
      vi.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce(
        { status: 'denied' } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>
      );
      await syncOverdueNotifications([makeTask()]);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });
});
