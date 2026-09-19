import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { RepeatingTask } from '@/types';
import type { Recommendation } from '@/types/recommendation';
import { computeNextDueDate } from '@/domain/recurrence';
import { hasCompletedToday, getTodayDoseProgress, normalizeReminderTimes } from '@/domain/task';

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
    for (let i = 0; i < 10; i++) {
      ids.push(`task-${taskId}-${i}`);
      ids.push(`task-${taskId}-dose-${i}`);
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

  const isMulti = Boolean(task.timesPerDay && task.timesPerDay > 1);

  if (isMulti) {
    const progress = getTodayDoseProgress(task);
    const times = normalizeReminderTimes(task.timesPerDay, task.reminderTimes);

    for (let i = 0; i < times.length; i++) {
      const [h, m] = times[i].split(':').map(Number);
      const doseHour = Number.isNaN(h) ? 9 : h;
      const doseMinute = Number.isNaN(m) ? 0 : m;

      const doseContent: Notifications.NotificationContentInput = {
        title: 'Repeto Reminder',
        body: `Reminder: ${task.title} (${i + 1}/${times.length})`,
        data: { taskId: task.id, doseIndex: i },
        categoryIdentifier: 'task-actions',
        sound: true,
      };

      const isDoseDoneToday = progress.completedIndices.includes(i);

      if (isDoseDoneToday) {
        // Schedule for tomorrow or future next due date
        const nextDate = new Date(task.nextDueDate);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (nextDate.getTime() < tomorrow.getTime()) {
          nextDate.setTime(tomorrow.getTime());
        }
        nextDate.setHours(doseHour, doseMinute, 0, 0);
        if (nextDate.getTime() > Date.now()) {
          await Notifications.scheduleNotificationAsync({
            content: doseContent,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: nextDate,
              channelId: 'default',
            },
            identifier: `task-${task.id}-dose-${i}`,
          });
        }
      } else {
        if (task.recurrence?.type === 'daily') {
          await Notifications.scheduleNotificationAsync({
            content: doseContent,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: doseHour,
              minute: doseMinute,
              channelId: 'default',
            },
            identifier: `task-${task.id}-dose-${i}`,
          });
        } else {
          const triggerDate = new Date(task.nextDueDate);
          triggerDate.setHours(doseHour, doseMinute, 0, 0);
          if (triggerDate.getTime() > Date.now()) {
            await Notifications.scheduleNotificationAsync({
              content: doseContent,
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: triggerDate,
                channelId: 'default',
              },
              identifier: `task-${task.id}-dose-${i}`,
            });
          }
        }
      }
    }
    return;
  }

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


// ─── Overdue Reminder Helpers ──────────────────────────────────────────────

/**
 * Cancel the 2-day follow-up overdue reminders for a specific task.
 * Call this when the task is completed, snoozed, skipped, or updated.
 */
export async function cancelOverdueReminders(taskId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Promise.all([
      Notifications.cancelScheduledNotificationAsync(`overdue-${taskId}-d1`).catch(() => {}),
      Notifications.cancelScheduledNotificationAsync(`overdue-${taskId}-d2`).catch(() => {}),
    ]);
  } catch {
    // ignore
  }
}

/**
 * Schedule 2 one-shot push notifications for an overdue task — one per day
 * for the next 2 calendar days — at the task's reminderTime (default 09:00).
 *
 * Only schedules if:
 * - Platform is not web
 * - Task is not archived
 * - Task is not snoozed (snoozedUntil is set)
 * - Notification permission is granted
 */
export async function scheduleOverdueReminders(task: RepeatingTask): Promise<void> {
  if (Platform.OS === 'web') return;
  if (task.archived) return;
  if (task.snoozedUntil) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const granted = await requestNotificationPermission();
    if (!granted) return;
  }

  // Cancel any previously scheduled overdue reminders first
  await cancelOverdueReminders(task.id);

  let hour = 9;
  let minute = 0;
  if (task.reminderTime) {
    const [h, m] = task.reminderTime.split(':').map(Number);
    hour = Number.isNaN(h) ? 9 : h;
    minute = Number.isNaN(m) ? 0 : m;
  }

  const content: Notifications.NotificationContentInput = {
    title: '⚠️ Overdue Reminder',
    body: `"${task.title}" is still pending!`,
    data: { taskId: task.id, type: 'overdue' },
    categoryIdentifier: 'task-actions',
    sound: true,
  };

  const now = new Date();

  for (let dayOffset = 1; dayOffset <= 2; dayOffset++) {
    const triggerDate = new Date(now);
    triggerDate.setDate(triggerDate.getDate() + dayOffset);
    triggerDate.setHours(hour, minute, 0, 0);

    if (triggerDate.getTime() > Date.now()) {
      try {
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId: 'default',
          },
          identifier: `overdue-${task.id}-d${dayOffset}`,
        });
      } catch (err) {
        console.warn(`[Repeato] Failed to schedule overdue reminder d${dayOffset} for ${task.id}:`, err);
      }
    }
  }
}

/**
 * Evaluate all tasks and ensure overdue reminders are in sync:
 * - Tasks that are past their due date (daysUntilDue < 0), not archived, not snoozed,
 *   and not yet completed → schedule overdue reminders (d1, d2).
 * - All other tasks → cancel overdue reminders (in case they were previously set).
 *
 * Call this on app startup and after a batch refresh.
 */
export async function syncOverdueNotifications(tasks: RepeatingTask[]): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  await Promise.all(
    tasks.map(async (task) => {
      const dueDate = new Date(task.nextDueDate);
      const startOfDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const isActuallyOverdue = startOfDue.getTime() < startOfToday.getTime();

      if (
        isActuallyOverdue &&
        !task.archived &&
        !task.snoozedUntil
      ) {
        // Schedule overdue follow-up reminders
        await scheduleOverdueReminders(task);
      } else {
        // Ensure no stale overdue reminders exist for this task
        await cancelOverdueReminders(task.id);
      }
    })
  );
}
