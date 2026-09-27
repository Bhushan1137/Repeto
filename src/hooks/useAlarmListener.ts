import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTasks } from '@/providers/TaskProvider';
import { getInitialAlarmAction, type AlarmActionPayload } from '@/services/alarmNative';

export interface ActiveAlarm {
  taskId: string;
  title: string;
}

export function useAlarmListener() {
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null);
  const { completeTask, snoozeTask } = useTasks();
  const processedColdStartRef = useRef(false);

  const handleAlarmAction = useCallback(
    async (action: 'MARK_DONE' | 'SNOOZE_2D', taskId: string) => {
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

  // 1. Cold-start check for alarm action intent
  useEffect(() => {
    if (Platform.OS !== 'android' || processedColdStartRef.current) return;
    processedColdStartRef.current = true;

    getInitialAlarmAction()
      .then((actionPayload: AlarmActionPayload | null) => {
        if (actionPayload?.action && actionPayload.taskId) {
          handleAlarmAction(actionPayload.action, actionPayload.taskId);
        }
      })
      .catch(() => {});
  }, [handleAlarmAction]);

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
