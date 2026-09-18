import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { RepeatingTask } from '@/types';
import type { Recommendation } from '@/types/recommendation';
import { computeNextDueDate } from '@/domain/recurrence';
import { hasCompletedToday } from '@/domain/task';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Task Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => {});

    Notifications.setNotificationChannelAsync('household', {
      name: 'Household & Nudges',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => {});

    Notifications.setNotificationChannelAsync('promotions', {
      name: 'Special Offers & Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => {});
  }

  if (Platform.OS !== 'web') {
    Notifications.setNotificationCategoryAsync('task-actions', [
      {
        identifier: 'MARK_DONE',
        buttonTitle: 'Mark Done',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'SNOOZE_2D',
        buttonTitle: 'Snooze 2 Days',
        options: { opensAppToForeground: false },
      },
    ]).catch(() => {});
  }
} catch (error) {
  console.warn('[Repeato] Failed to set notification handler:', error);
}

export async function setupNotificationCategories(isHi = false): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.setNotificationCategoryAsync('task-actions', [
      {
        identifier: 'MARK_DONE',
        buttonTitle: isHi ? 'पूरा करें (Mark Done)' : 'Mark Done',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'SNOOZE_2D',
        buttonTitle: isHi ? '2 दिन स्नूज़ (Snooze)' : 'Snooze 2 Days',
        options: { opensAppToForeground: false },
      },
    ]);
  } catch (error) {
    console.warn('[Repeato] Failed to set notification category:', error);
  }
}

export async function dismissNotification(identifier: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.dismissNotificationAsync(identifier);
  } catch {
    // ignore
  }
}

let permissionGranted = false;

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') {
    permissionGranted = true;
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  permissionGranted = status === 'granted';
  return permissionGranted;
}

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}

export async function cancelTaskReminder(taskId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const ids = [`task-${taskId}`];
    for (let i = 0; i < 5; i++) {
      ids.push(`task-${taskId}-${i}`);
    }
    await Promise.all(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
    );
  } catch {
    // ignore
  }
}

export async function scheduleTaskReminder(task: RepeatingTask): Promise<void> {
  if (Platform.OS === 'web') return;

  // Do not schedule reminders for archived tasks
  if (task.archived) return;

  // Query notification permission dynamically and auto-request if not yet determined
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const granted = await requestNotificationPermission();
    if (!granted) {
      console.warn(`[Repeato] Cannot schedule reminder for "${task.title}": notification permission not granted`);
      return;
    }
  }

  // Always cancel previous scheduled reminders for this task first
  await cancelTaskReminder(task.id);

  let hour = 9;
  let minute = 0;
  if (task.reminderTime) {
    const [h, m] = task.reminderTime.split(':').map(Number);
    hour = Number.isNaN(h) ? 9 : h;
    minute = Number.isNaN(m) ? 0 : m;
  }

  const content: Notifications.NotificationContentInput = {
    title: 'Repeto Reminder',
    body: `Reminder for "${task.title}"`,
    data: { taskId: task.id },
    categoryIdentifier: 'task-actions',
    sound: true,
  };

  // If task is currently snoozed, schedule directly for the snooze date
  if (task.snoozedUntil) {
    const snoozeDate = new Date(task.snoozedUntil);
    snoozeDate.setHours(hour, minute, 0, 0);
    if (snoozeDate.getTime() > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: snoozeDate,
          channelId: 'default',
        },
        identifier: `task-${task.id}`,
      });
    }
    return;
  }

  const recType = task.recurrence?.type;

  try {
    if (recType === 'daily') {
      // If task was already completed today, schedule for next due date to avoid duplicate alarm today
      if (hasCompletedToday(task)) {
        const nextDate = new Date(task.nextDueDate);
        nextDate.setHours(hour, minute, 0, 0);
        if (nextDate.getTime() > Date.now()) {
          await Notifications.scheduleNotificationAsync({
            content,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: nextDate,
              channelId: 'default',
            },
            identifier: `task-${task.id}`,
          });
        }
      } else {
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
            channelId: 'default',
          },
          identifier: `task-${task.id}`,
        });
      }
    } else if (recType === 'weekly') {
      const jsWeekday = task.recurrence.weekday ?? new Date(task.nextDueDate).getDay();
      const expoWeekday = jsWeekday + 1; // JS 0=Sun..6=Sat -> Expo 1=Sun..7=Sat
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: expoWeekday,
          hour,
          minute,
          channelId: 'default',
        },
        identifier: `task-${task.id}`,
      });
    } else if (recType === 'monthly') {
      const dayOfMonth = task.recurrence.dayOfMonth ?? new Date(task.nextDueDate).getDate();
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
          day: dayOfMonth,
          hour,
          minute,
          channelId: 'default',
        },
        identifier: `task-${task.id}`,
      });
    } else if (recType === 'yearly') {
      const dueDateObj = new Date(task.nextDueDate);
      const month = dueDateObj.getMonth() + 1;
      const day = dueDateObj.getDate();
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.YEARLY,
          month,
          day,
          hour,
          minute,
          channelId: 'default',
        },
        identifier: `task-${task.id}`,
      });
    } else {
      // Custom interval / monthDay / nthWeekday / single occurrence
      // Schedule up to 5 upcoming occurrences using DATE triggers
      let currentDueDate = new Date(task.nextDueDate);
      for (let i = 0; i < 5; i++) {
        const triggerDate = new Date(currentDueDate);
        triggerDate.setHours(hour, minute, 0, 0);

        if (triggerDate.getTime() > Date.now()) {
          await Notifications.scheduleNotificationAsync({
            content,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
              channelId: 'default',
            },
            identifier: `task-${task.id}-${i}`,
          });
        }

        // Calculate next occurrence date for buffer
        const nextIso = computeNextDueDate(task.recurrence, currentDueDate);
        currentDueDate = new Date(nextIso);
      }
    }
  } catch (error) {
    console.warn(`[Repeato] Failed to schedule reminder for task ${task.id}:`, error);
  }
}

/** Immediately schedule a test notification firing in 2 seconds */
export async function sendTestNotification(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Repeto Reminder 🔔',
        body: 'Notifications are working properly on your device!',
        categoryIdentifier: 'task-actions',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        channelId: 'default',
      },
    });
    return true;
  } catch (error) {
    console.warn('[Repeato] Failed to send test notification:', error);
    return false;
  }
}

/** Schedule a promotional campaign notification immediately */
export async function scheduleCampaignNotification(
  campaign: Recommendation,
  isHi = false
): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const granted = await requestNotificationPermission();
    if (!granted) return false;
  }

  const title = isHi ? `विशेष ऑफर: ${campaign.title}` : `Special Offer: ${campaign.title}`;
  const body = campaign.promoCode
    ? (isHi
        ? `${campaign.description} (कोड: ${campaign.promoCode})`
        : `${campaign.description} (Use code: ${campaign.promoCode})`)
    : campaign.description;

  const content: Notifications.NotificationContentInput = {
    title,
    body,
    data: {
      type: 'campaign',
      campaignId: campaign.id,
      redirectUrl: campaign.redirectUrl,
      promoCode: campaign.promoCode,
      imageUrl: campaign.imageUrl,
    },
    sound: true,
  };

  try {
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: Platform.OS === 'android' ? 'promotions' : 'default',
      },
      identifier: `campaign-${campaign.id}`,
    });
    return true;
  } catch (error) {
    console.warn(`[Repeato] Failed to schedule campaign notification for ${campaign.id}:`, error);
    return false;
  }
}

/** List all scheduled notifications */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  if (Platform.OS === 'web') return [];
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return [];
  }
}

/**
 * Request permission and obtain Expo Push Token for remote push notifications
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId ??
      'dc3bf5ae-77fe-4235-83b7-47a896e72430';

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResponse.data;
  } catch (error) {
    console.warn('[Repeato] Failed to get Expo push token:', error);
    return null;
  }
}

/**
 * Dispatch remote push notification directly via Expo Push API
 * Does not require any Node.js Firebase functions
 */
export async function sendRemotePushNotification(
  toToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  if (!toToken || !toToken.startsWith('ExponentPushToken')) {
    return false;
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: toToken,
        sound: 'default',
        title,
        body,
        data: data ?? {},
        channelId: Platform.OS === 'android' ? 'household' : 'default',
      }),
    });

    const resJson = await response.json();
    return resJson?.data?.status === 'ok';
  } catch (err) {
    console.warn('[Repeato] Error sending remote push notification:', err);
    return false;
  }
}

