import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform, DeviceEventEmitter, AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTasks } from '@/providers/TaskProvider';
import {
  getInitialAlarmAction,
  getPendingAlarmActions,
} from '@/services/alarmNative';

export interface ActiveAlarm {
  taskId: string;
  title: string;
}

export function useAlarmListener() {
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null);
  const { completeTask, snoozeTask } = useTasks();
  const recentActionsRef = useRef<Map<string, number>>(new Map());

  const handleAlarmAction = useCallback(
    async (action: 'MARK_DONE' | 'SNOOZE_2D', taskId: string) => {
      if (!taskId) return;

      // Debounce duplicate events for same task & action within 3 seconds
      const now = Date.now();
      const dedupKey = `${action}:${taskId}`;
      const lastRan = recentActionsRef.current.get(dedupKey) || 0;
      if (now - lastRan < 3000) {
        return;
      }
      recentActionsRef.current.set(dedupKey, now);

      // Clean up map entries older than 10s
      for (const [key, ts] of recentActionsRef.current.entries()) {
        if (now - ts > 10000) {
          recentActionsRef.current.delete(key);
        }
      }

      setActiveAlarm((prev) => (prev?.taskId === taskId ? null : prev));
      try {
        if (action === 'MARK_DONE') {
          await completeTask(taskId, undefined, { maxEarlyDays: 1 });
        } else if (action === 'SNOOZE_2D') {
          await snoozeTask(taskId, 2);
        }
      } catch (err) {
        console.warn('[useAlarmListener] Error performing alarm action:', err);
      }
    },
    [completeTask, snoozeTask]
  );

  const dismissAlarm = useCallback(() => {
    setActiveAlarm(null);
  }, []);

  const drainPendingActions = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      // 1. Drain the persistent multi-action queue from SharedPreferences
      const pending = await getPendingAlarmActions();
      if (pending && pending.length > 0) {
        for (const item of pending) {
          if (item?.action && item?.taskId) {
            await handleAlarmAction(item.action, item.taskId);
          }
        }
      }

      // 2. Check legacy initial intent action (if any)
      const initial = await getInitialAlarmAction();
      if (initial?.action && initial?.taskId) {
        await handleAlarmAction(initial.action, initial.taskId);
      }
    } catch (err) {
      console.warn('[useAlarmListener] Error draining pending alarm actions:', err);
    }
  }, [handleAlarmAction]);

  // 1. Cold-start and AppState resume check for alarm actions
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // Drain on mount
    drainPendingActions();

    // Drain when returning to foreground (e.g., after AlarmActivity finishes)
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        drainPendingActions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [drainPendingActions]);

  // 2. Native module event listeners (when app is in foreground/running)
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subTrigger = DeviceEventEmitter.addListener(
      'onAlarmTriggered',
      (data: { taskId?: string; title?: string }) => {
        if (data?.taskId) {
          setActiveAlarm({
            taskId: data.taskId,
            title: data.title || 'Task Reminder',
          });
        }
      }
    );

    const subAction = DeviceEventEmitter.addListener(
      'onAlarmAction',
      (data: { action?: 'MARK_DONE' | 'SNOOZE_2D'; taskId?: string }) => {
        if (data?.taskId && data.action) {
          handleAlarmAction(data.action, data.taskId);
        }
      }
    );

    return () => {
      subTrigger.remove();
      subAction.remove();
    };
  }, [handleAlarmAction]);

  // 3. Foreground Expo Notification listener
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const trigger = notification.request.trigger as { channelId?: string } | null;
      const channelId = trigger?.channelId;
      const data = notification.request.content.data as
        | { taskId?: string; isAlarm?: boolean; title?: string }
        | undefined;

      if (channelId === 'alarm' || data?.isAlarm || notification.request.content.categoryIdentifier === 'task-actions') {
        const taskId = (data?.taskId as string) || '';
        const title =
          notification.request.content.title ||
          (data?.title as string) ||
          notification.request.content.body ||
          'Task Reminder';

        if (taskId) {
          setActiveAlarm({ taskId, title });
        }
      }
    });

    return () => sub.remove();
  }, []);

  return {
    activeAlarm,
    dismissAlarm,
    handleAlarmAction,
  };
}
