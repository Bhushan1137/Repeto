import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { cancelTaskReminder, requestNotificationPermission, scheduleTaskReminder } from '@/services/notifications';
import { createTaskFromPreset } from '@/domain/task';

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  setNotificationCategoryAsync: vi.fn().mockResolvedValue(true),
  setNotificationChannelAsync: vi.fn().mockResolvedValue(true),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: vi.fn().mockResolvedValue('notif-id'),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(true),
  SchedulableTriggerInputTypes: {
    DATE: 'date',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
  },
  AndroidImportance: {
    HIGH: 4,
  },
}));

describe('services/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Platform.OS = 'ios';
  });

  it('requestNotificationPermission requests Expo permissions', async () => {
    const granted = await requestNotificationPermission();
    expect(granted).toBe(true);
  });

  it('scheduleTaskReminder schedules DAILY notification for daily task', async () => {
    const task = createTaskFromPreset('Water Plants', 'home', 'Every day');
    task.reminderTime = '08:30';

    await scheduleTaskReminder(task);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: `task-${task.id}`,
        trigger: expect.objectContaining({
          type: 'daily',
          hour: 8,
          minute: 30,
        }),
      })
    );
  });

  it('scheduleTaskReminder schedules WEEKLY notification for weekly task', async () => {
    const task = createTaskFromPreset('Team Sync', 'work', 'Every week');
    task.recurrence = { type: 'weekly', weekday: 1 }; // Monday (JS 1 -> Expo 2)

    await scheduleTaskReminder(task);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: `task-${task.id}`,
        trigger: expect.objectContaining({
          type: 'weekly',
          weekday: 2,
        }),
      })
    );
  });

  it('scheduleTaskReminder schedules 5-occurrence rolling buffer for interval task', async () => {
    const task = createTaskFromPreset('Filter Change', 'home', 'Every 3 days');
    const future = new Date();
    future.setDate(future.getDate() + 1);
    task.nextDueDate = future.toISOString();
    task.recurrence = { type: 'interval', interval: 3, intervalUnit: 'days' };

    await scheduleTaskReminder(task);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(5);
  });

  it('cancelTaskReminder cancels scheduled notifications for all task IDs', async () => {
    await cancelTaskReminder('t123');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task-t123');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task-t123-0');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task-t123-4');
  });
});

