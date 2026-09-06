import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { cancelTaskReminder, requestNotificationPermission, scheduleTaskReminder } from '@/services/notifications';
import { createTaskFromPreset } from '@/domain/task';

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  setNotificationCategoryAsync: vi.fn().mockResolvedValue(true),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: vi.fn().mockResolvedValue('notif-id'),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(true),
  SchedulableTriggerInputTypes: { DATE: 'date' },
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

  it('scheduleTaskReminder schedules notification for upcoming task', async () => {
    const task = createTaskFromPreset('Rent', 'home', 'Monthly');
    const future = new Date();
    future.setDate(future.getDate() + 5);
    task.nextDueDate = future.toISOString();

    await scheduleTaskReminder(task);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('cancelTaskReminder cancels scheduled notification', async () => {
    await cancelTaskReminder('t123');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task-t123');
  });
});
