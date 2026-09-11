import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { RepeatingTask } from '@/types';
import { computeNextDueDate } from '@/domain/recurrence';

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

  // Query notification permission dynamically to handle restarts correctly
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  // Always cancel previous scheduled reminders for this task first
  await cancelTaskReminder(task.id);

  let hour = 9;
  let minute = 0;
  if (task.reminderTime) {
    const [h, m] = task.reminderTime.split(':').map(Number);
    hour = Number.isNaN(h) ? 9 : h;
    minute = Number.isNaN(m) ? 0 : m;
  }

  const content = {
    title: 'Repeato Reminder',
    body: `Reminder for "${task.title}"`,
    data: { taskId: task.id },
    categoryIdentifier: 'task-actions',
  };

  const recType = task.recurrence?.type;

  try {
    if (recType === 'daily') {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
        identifier: `task-${task.id}`,
      });
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

