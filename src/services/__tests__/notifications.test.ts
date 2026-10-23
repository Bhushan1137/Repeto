import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { cancelTaskReminder, requestNotificationPermission, scheduleTaskReminder } from '@/services/notifications';
import { scheduleNativeAlarm } from '@/services/alarmNative';
import { createTaskFromPreset } from '@/domain/task';

vi.mock('@/services/alarmNative', () => ({
  scheduleNativeAlarm: vi.fn().mockResolvedValue(true),
  cancelNativeAlarm: vi.fn().mockResolvedValue(true),
  cancelAllNativeAlarms: vi.fn().mockResolvedValue(true),
  triggerTestAlarm: vi.fn().mockResolvedValue(true),
}));

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  setNotificationCategoryAsync: vi.fn().mockResolvedValue(true),
  setNotificationChannelAsync: vi.fn().mockResolvedValue(true),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: vi.fn().mockResolvedValue('notif-id'),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(true),
  dismissNotificationAsync: vi.fn().mockResolvedValue(undefined),
  getExpoPushTokenAsync: vi.fn().mockResolvedValue({ data: 'ExponentPushToken[mock-token-123]' }),
  SchedulableTriggerInputTypes: {
    DATE: 'date',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
    TIME_INTERVAL: 'timeInterval',
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

  it('scheduleTaskReminder schedules native alarm and skips expo notification on Android when alarmEnabled is true', async () => {
    Platform.OS = 'android';
    const task = createTaskFromPreset('Blood pressure med', 'medicines', 'Every day');
    task.reminderTime = '09:00';
    task.alarmEnabled = true;

    await scheduleTaskReminder(task);
    expect(scheduleNativeAlarm).toHaveBeenCalledWith(task.id, task.title, expect.any(Number));
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('scheduleTaskReminder uses default channel on Android when alarmEnabled is false', async () => {
    Platform.OS = 'android';
    const task = createTaskFromPreset('Read book', 'education', 'Every day');
    task.reminderTime = '21:00';
    task.alarmEnabled = false;

    await scheduleTaskReminder(task);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({
          channelId: 'default',
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

  it('cancelTaskReminder cancels scheduled notifications for all task IDs including dose IDs', async () => {
    await cancelTaskReminder('t123');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task-t123');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task-t123-0');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task-t123-dose-0');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task-t123-dose-1');
  });

  it('scheduleTaskReminder schedules separate notifications for each dose of a multi-time task', async () => {
    const task = createTaskFromPreset('Vitamins', 'health', '3 times a day');
    task.timesPerDay = 3;
    task.reminderTimes = ['08:00', '14:00', '20:00'];
    task.recurrence = { type: 'daily' };

    await scheduleTaskReminder(task);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: `task-${task.id}-dose-0`,
        trigger: expect.objectContaining({
          type: 'daily',
          hour: 8,
          minute: 0,
        }),
      })
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: `task-${task.id}-dose-1`,
        trigger: expect.objectContaining({
          type: 'daily',
          hour: 14,
          minute: 0,
        }),
      })
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: `task-${task.id}-dose-2`,
        trigger: expect.objectContaining({
          type: 'daily',
          hour: 20,
          minute: 0,
        }),
      })
    );
  });

  it('scheduleTaskReminder schedules future date notification for doses already completed today', async () => {
    const task = createTaskFromPreset('Vitamins', 'health', '2 times a day');
    task.timesPerDay = 2;
    task.reminderTimes = ['08:00', '20:00'];
    task.recurrence = { type: 'daily' };
    task.history = [
      {
        month: 'Sep 2026',
        status: 'on_time',
        completedAt: new Date().toISOString(), // Completed dose 0 today
        doseIndex: 0,
        doseTime: '08:00',
      },
    ];

    await scheduleTaskReminder(task);
    // Dose 0 completed -> scheduled with a DATE trigger for tomorrow or next due date
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: `task-${task.id}-dose-0`,
        trigger: expect.objectContaining({
          type: 'date',
        }),
      })
    );
    // Dose 1 still pending -> scheduled with a DAILY trigger
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: `task-${task.id}-dose-1`,
        trigger: expect.objectContaining({
          type: 'daily',
          hour: 20,
          minute: 0,
        }),
      })
    );
  });

  it('setupNotificationCategories configures background action options', async () => {
    const { setupNotificationCategories } = await import('@/services/notifications');
    await setupNotificationCategories(false);
    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
      'task-actions',
      expect.arrayContaining([
        expect.objectContaining({
          identifier: 'MARK_DONE',
          options: { opensAppToForeground: false },
        }),
        expect.objectContaining({
          identifier: 'SNOOZE_2D',
          options: { opensAppToForeground: false },
        }),
      ])
    );
  });

  it('dismissNotification calls dismissNotificationAsync', async () => {
    const { dismissNotification } = await import('@/services/notifications');
    await dismissNotification('notif-123');
    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-123');
  });

  it('scheduleCampaignNotification schedules immediate notification with promo details', async () => {
    const { scheduleCampaignNotification } = await import('@/services/notifications');
    const campaign = {
      id: 'deal-101',
      title: '20% Off Groceries',
      description: 'Get fresh groceries delivered at your doorstep.',
      promoCode: 'FRESH20',
      imageUrl: 'https://example.com/deal.png',
      buttonText: 'Order Now',
      redirectUrl: 'https://example.com/shop',
      active: true,
      matchCriteria: { categories: ['home'], keywords: ['grocery'] },
      impressions: 0,
      clicks: 0,
    };

    const res = await scheduleCampaignNotification(campaign, false);
    expect(res).toBe(true);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'campaign-deal-101',
        content: expect.objectContaining({
          title: 'Special Offer: 20% Off Groceries',
          body: 'Get fresh groceries delivered at your doorstep. (Use code: FRESH20)',
          data: expect.objectContaining({
            type: 'campaign',
            campaignId: 'deal-101',
            redirectUrl: 'https://example.com/shop',
            promoCode: 'FRESH20',
          }),
        }),
      })
    );
  });

  it('scheduleCampaignNotification formats localized Hindi content', async () => {
    const { scheduleCampaignNotification } = await import('@/services/notifications');
    const campaign = {
      id: 'deal-102',
      title: 'वाटर प्यूरीफायर सर्विस',
      description: 'सर्विसिंग पर 30% की छूट पाएं',
      promoCode: 'PURIFY30',
      imageUrl: 'https://example.com/ro.png',
      buttonText: 'अभी बुक करें',
      redirectUrl: 'https://example.com/service',
      active: true,
      matchCriteria: { categories: ['appliances'], keywords: ['filter'] },
      impressions: 0,
      clicks: 0,
    };

    const res = await scheduleCampaignNotification(campaign, true);
    expect(res).toBe(true);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'campaign-deal-102',
        content: expect.objectContaining({
          title: 'विशेष ऑफर: वाटर प्यूरीफायर सर्विस',
          body: 'सर्विसिंग पर 30% की छूट पाएं (कोड: PURIFY30)',
        }),
      })
    );
  });

  it('registerForPushNotificationsAsync obtains expo push token when granted', async () => {
    const { registerForPushNotificationsAsync } = await import('@/services/notifications');
    const token = await registerForPushNotificationsAsync();
    expect(token).toBe('ExponentPushToken[mock-token-123]');
  });

  it('sendRemotePushNotification posts payload to Expo Push REST API', async () => {
    const { sendRemotePushNotification } = await import('@/services/notifications');
    const originalFetch = global.fetch;
    const mockFetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ data: { status: 'ok' } }),
    });
    global.fetch = mockFetch;

    try {
      const sent = await sendRemotePushNotification(
        'ExponentPushToken[user-target]',
        'Test Title',
        'Test Body',
        { taskId: 'task-1' }
      );
      expect(sent).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"to":"ExponentPushToken[user-target]"'),
        })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('sendRemotePushNotification rejects invalid or missing push tokens', async () => {
    const { sendRemotePushNotification } = await import('@/services/notifications');
    const res = await sendRemotePushNotification('', 'Title', 'Body');
    expect(res).toBe(false);
  });
});


