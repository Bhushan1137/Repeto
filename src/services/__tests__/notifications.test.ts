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

  it('setupNotificationCategories configures foreground action options', async () => {
    const { setupNotificationCategories } = await import('@/services/notifications');
    await setupNotificationCategories(false);
    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
      'task-actions',
      expect.arrayContaining([
        expect.objectContaining({
          identifier: 'MARK_DONE',
          options: { opensAppToForeground: true },
        }),
        expect.objectContaining({
          identifier: 'SNOOZE_2D',
          options: { opensAppToForeground: true },
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


