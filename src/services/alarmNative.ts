import { NativeModules, Platform, DeviceEventEmitter, type EmitterSubscription } from 'react-native';

export interface AlarmActionPayload {
  action: 'MARK_DONE' | 'SNOOZE_2D' | 'SNOOZE_10M';
  taskId: string;
}

export interface AlarmTriggerPayload {
  taskId: string;
  title: string;
}

const getAlarmNative = () => NativeModules.AlarmModule;

/**
 * Schedule an exact native alarm on Android.
 * When the alarm fires, AlarmReceiver posts a high-priority notification
 * with Full-Screen Intent launching AlarmActivity even over the lock screen.
 */
export async function scheduleNativeAlarm(
  taskId: string,
  title: string,
  triggerAtMillis: number
): Promise<boolean> {
  const native = getAlarmNative();
  if (Platform.OS !== 'android' || !native?.scheduleAlarm) {
    return false;
  }
  try {
    return await native.scheduleAlarm(taskId, title, triggerAtMillis);
  } catch (err) {
    console.warn('[AlarmNative] Failed to schedule native alarm:', err);
    return false;
  }
}

/**
 * Cancel a scheduled native alarm by task ID.
 */
export async function cancelNativeAlarm(taskId: string): Promise<boolean> {
  const native = getAlarmNative();
  if (Platform.OS !== 'android' || !native?.cancelAlarm) {
    return false;
  }
  try {
    return await native.cancelAlarm(taskId);
  } catch (err) {
    console.warn('[AlarmNative] Failed to cancel native alarm:', err);
    return false;
  }
}

/**
 * Cancel all scheduled native alarms.
 */
export async function cancelAllNativeAlarms(): Promise<boolean> {
  const native = getAlarmNative();
  if (Platform.OS !== 'android' || !native?.cancelAllAlarms) {
    return false;
  }
  try {
    return await native.cancelAllAlarms();
  } catch (err) {
    console.warn('[AlarmNative] Failed to cancel all alarms:', err);
    return false;
  }
}

/**
 * Trigger a test alarm firing in `seconds` seconds (default 2s).
 */
export async function triggerTestAlarm(seconds = 2, title = 'Test Task Reminder'): Promise<boolean> {
  const native = getAlarmNative();
  if (Platform.OS !== 'android' || !native?.triggerTestAlarm) {
    return false;
  }
  try {
    return await native.triggerTestAlarm(seconds, title);
  } catch (err) {
    console.warn('[AlarmNative] Failed to trigger test alarm:', err);
    return false;
  }
}

/**
 * Read and drain all pending alarm actions recorded while the app was
 * in background or cold-started, handling multi-alarm batches and individual actions.
 */
export async function getPendingAlarmActions(): Promise<AlarmActionPayload[]> {
  const native = getAlarmNative();
  if (Platform.OS !== 'android' || !native?.getPendingAlarmActions) {
    return [];
  }
  try {
    const list = await native.getPendingAlarmActions();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Read any initial alarm action if the app was launched by tapping Mark Done or Snooze
 * from the native AlarmActivity or notification.
 */
export async function getInitialAlarmAction(): Promise<AlarmActionPayload | null> {
  const native = getAlarmNative();
  if (Platform.OS !== 'android' || !native?.getInitialAlarmAction) {
    return null;
  }
  try {
    return await native.getInitialAlarmAction();
  } catch {
    return null;
  }
}

/**
 * Subscribe to native alarm events.
 */
export function addAlarmEventListener(
  event: 'onAlarmTriggered' | 'onAlarmAction',
  listener: (data: unknown) => void
): EmitterSubscription {
  return DeviceEventEmitter.addListener(event, listener);
}
