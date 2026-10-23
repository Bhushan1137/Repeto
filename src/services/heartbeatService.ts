import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { APP_VERSION } from '@/utils/version';
import type { UserProfile } from '@/types';

export const STORAGE_KEY_LAST_HEARTBEAT_DATE = '@repeato/last_heartbeat_date';
export const STORAGE_KEY_LAST_HEARTBEAT_VERSION = '@repeato/last_heartbeat_version';

let inFlightHeartbeatPromise: Promise<boolean> | null = null;

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getCurrentDeviceInfo() {
  const rawPlatform = Platform.OS;
  const platform: 'ios' | 'android' | 'web' =
    rawPlatform === 'ios' ? 'ios' : rawPlatform === 'android' ? 'android' : 'web';

  return {
    platform,
    appVersion: APP_VERSION,
    osVersion: String(Platform.Version ?? ''),
  };
}

/**
 * Checks if the user needs a heartbeat ping and updates their profile if necessary.
 * Optimized for Firebase free tier:
 * - Only 1 write per day per active user.
 * - Skipped if already sent today with the current app version.
 * - Debounces concurrent invocations.
 */
export async function checkAndSendHeartbeat(
  user: UserProfile | null,
  updateUser: (patch: Partial<UserProfile>) => Promise<void>,
  options?: { force?: boolean }
): Promise<boolean> {
  if (!user || !user.id || user.isDeleted) {
    return false;
  }

  // Deduplicate concurrent calls in-flight
  if (inFlightHeartbeatPromise) {
    return inFlightHeartbeatPromise;
  }

  inFlightHeartbeatPromise = (async () => {
    try {
      const today = getTodayDateString();
      const currentDeviceInfo = getCurrentDeviceInfo();

      if (!options?.force) {
        const [lastDate, lastVersion] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_LAST_HEARTBEAT_DATE).catch(() => null),
          AsyncStorage.getItem(STORAGE_KEY_LAST_HEARTBEAT_VERSION).catch(() => null),
        ]);

        // If already sent today with current app version, skip Firestore write completely (0 cost)
        if (lastDate === today && lastVersion === APP_VERSION) {
          return false;
        }
      }

      const now = new Date().toISOString();
      await updateUser({
        lastActiveAt: now,
        deviceInfo: currentDeviceInfo,
      });

      // Cache the date and app version locally upon successful write
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_LAST_HEARTBEAT_DATE, today).catch(() => {}),
        AsyncStorage.setItem(STORAGE_KEY_LAST_HEARTBEAT_VERSION, APP_VERSION).catch(() => {}),
      ]);

      return true;
    } catch (err) {
      console.warn('[Repeato] Heartbeat check failed:', err);
      return false;
    } finally {
      inFlightHeartbeatPromise = null;
    }
  })();

  return inFlightHeartbeatPromise;
}

/**
 * Clears cached heartbeat markers in local storage.
 * Primarily used for testing or resetting state.
 */
export async function resetHeartbeatCache(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEY_LAST_HEARTBEAT_DATE).catch(() => {}),
    AsyncStorage.removeItem(STORAGE_KEY_LAST_HEARTBEAT_VERSION).catch(() => {}),
  ]);
}
