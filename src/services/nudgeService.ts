import AsyncStorage from '@react-native-async-storage/async-storage';
import { userRepository } from '@/data/repositories/userRepository';
import {
  buildNudgeNotification,
  getRemainingNudgeCooldown,
} from '@/domain/nudge';
import { sendRemotePushNotification } from './notifications';

const STORAGE_PREFIX = '@repeato/nudge_cooldown_';

function getStorageKey(taskId: string, targetUserId: string): string {
  return `${STORAGE_PREFIX}${taskId}_${targetUserId}`;
}

export async function getLastNudgedTime(
  taskId: string,
  targetUserId: string
): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(taskId, targetUserId));
    if (!raw) return null;
    const time = Number.parseInt(raw, 10);
    return Number.isNaN(time) ? null : time;
  } catch {
    return null;
  }
}

export async function recordNudgeSent(
  taskId: string,
  targetUserId: string,
  timestamp: number = Date.now()
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      getStorageKey(taskId, targetUserId),
      String(timestamp)
    );
  } catch (err) {
    console.warn('[Repeato Nudge] Failed to record nudge timestamp:', err);
  }
}

export interface SendNudgeParams {
  taskId: string;
  taskTitle: string;
  targetUserId: string;
  fromUser: {
    id: string;
    name: string;
  };
}

export interface SendNudgeResult {
  success: boolean;
  reason?: 'cooldown' | 'no_target' | 'error';
  remainingMs?: number;
}

export async function sendTaskNudge({
  taskId,
  taskTitle,
  targetUserId,
  fromUser,
}: SendNudgeParams): Promise<SendNudgeResult> {
  if (!targetUserId || !taskId) {
    return { success: false, reason: 'no_target' };
  }

  const lastNudged = await getLastNudgedTime(taskId, targetUserId);
  const remainingMs = getRemainingNudgeCooldown(lastNudged);

  if (remainingMs > 0) {
    return { success: false, reason: 'cooldown', remainingMs };
  }

  try {
    const notif = buildNudgeNotification(taskId, taskTitle, fromUser);
    await userRepository.saveNotification(targetUserId, notif);
    await recordNudgeSent(taskId, targetUserId);

    // Also dispatch native push notification directly to recipient's device if push token exists
    try {
      const targetUser = await userRepository.loadRemote(targetUserId);
      if (targetUser?.expoPushToken && targetUser?.pushOptIn !== false) {
        await sendRemotePushNotification(
          targetUser.expoPushToken,
          'Repeto Nudge 👉',
          `${fromUser.name} nudged you to complete "${taskTitle}"!`,
          { taskId, type: 'nudge' }
        );
      }
    } catch (pushErr) {
      console.warn('[Repeato Nudge] Remote push delivery failed (non-blocking):', pushErr);
    }

    return { success: true };
  } catch (err) {
    console.warn('[Repeato Nudge] Failed to send nudge notification:', err);
    return { success: false, reason: 'error' };
  }
}
