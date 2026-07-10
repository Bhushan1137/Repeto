import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { RepeatingTask } from '@/types';
import { daysUntilDue } from '@/domain/recurrence';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS !== 'web') {
    Notifications.setNotificationCategoryAsync('task-actions', [
      {
        identifier: 'MARK_DONE',
        buttonTitle: 'Mark Done',
        options: { opensAppToForeground: false }
      },
      {
        identifier: 'SNOOZE_2D',
        buttonTitle: 'Snooze 2 Days',
        options: { opensAppToForeground: false }
      }
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

export async function scheduleTaskReminder(task: RepeatingTask): Promise<void> {
  if (Platform.OS === 'web') return;

  // Query notification permission dynamically to handle restarts correctly
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const days = daysUntilDue(task.nextDueDate);
  if (days < 0) return;

  const triggerDate = new Date(task.nextDueDate);
  if (task.reminderTime) {
    const [h, m] = task.reminderTime.split(':').map(Number);
    triggerDate.setHours(h || 9, m || 0, 0, 0);
  } else {
    triggerDate.setHours(9, 0, 0, 0);
  }
  if (triggerDate.getTime() <= Date.now()) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Repeato reminder',
        body: `${task.title} is due ${days === 0 ? 'today' : `in ${days} day(s)`}`,
        data: { taskId: task.id },
        categoryIdentifier: 'task-actions',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
      identifier: `task-${task.id}`,
    });
  } catch {
    // Non-fatal — reminders are best-effort
  }
}

export async function cancelTaskReminder(taskId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`task-${taskId}`);
  } catch {
    // ignore
  }
}
