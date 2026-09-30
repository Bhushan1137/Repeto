import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  checkAndSendHeartbeat,
  resetHeartbeatCache,
  getTodayDateString,
  STORAGE_KEY_LAST_HEARTBEAT_DATE,
  STORAGE_KEY_LAST_HEARTBEAT_VERSION,
} from '@/services/heartbeatService';
import { APP_VERSION } from '@/utils/version';
import type { UserProfile } from '@/types';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '17.4',
  },
}));

describe('services/heartbeatService', () => {
  const mockUser: UserProfile = {
    id: 'user_123',
    name: 'Test User',
    email: 'test@example.com',
    language: 'en',
    pushOptIn: true,
    profileComplete: true,
    onboardingComplete: true,
    plan: 'free',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('skips heartbeat if user is null or invalid', async () => {
    const updateUser = vi.fn();
    const res1 = await checkAndSendHeartbeat(null, updateUser);
    expect(res1).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();

    const res2 = await checkAndSendHeartbeat({ ...mockUser, id: '' }, updateUser);
    expect(res2).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();

    const res3 = await checkAndSendHeartbeat({ ...mockUser, isDeleted: true }, updateUser);
    expect(res3).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('sends heartbeat on first check and records date & version in AsyncStorage', async () => {
    const updateUser = vi.fn().mockResolvedValue(undefined);
    const result = await checkAndSendHeartbeat(mockUser, updateUser);

    expect(result).toBe(true);
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        lastActiveAt: expect.any(String),
        deviceInfo: {
          platform: 'ios',
          appVersion: APP_VERSION,
          osVersion: '17.4',
        },
      })
    );

    const savedDate = await AsyncStorage.getItem(STORAGE_KEY_LAST_HEARTBEAT_DATE);
    const savedVersion = await AsyncStorage.getItem(STORAGE_KEY_LAST_HEARTBEAT_VERSION);
    expect(savedDate).toBe(getTodayDateString());
    expect(savedVersion).toBe(APP_VERSION);
  });

  it('skips heartbeat on subsequent checks on the same day with same version (0 write cost)', async () => {
    const updateUser = vi.fn().mockResolvedValue(undefined);

    // First time
    const res1 = await checkAndSendHeartbeat(mockUser, updateUser);
    expect(res1).toBe(true);
    expect(updateUser).toHaveBeenCalledTimes(1);

    // Second time within same day
    const res2 = await checkAndSendHeartbeat(mockUser, updateUser);
    expect(res2).toBe(false);
    expect(updateUser).toHaveBeenCalledTimes(1); // Not called again!
  });

  it('sends heartbeat if app version has changed even on the same day', async () => {
    const today = getTodayDateString();
    await AsyncStorage.setItem(STORAGE_KEY_LAST_HEARTBEAT_DATE, today);
    await AsyncStorage.setItem(STORAGE_KEY_LAST_HEARTBEAT_VERSION, '0.9.0'); // older version

    const updateUser = vi.fn().mockResolvedValue(undefined);
    const result = await checkAndSendHeartbeat(mockUser, updateUser);

    expect(result).toBe(true);
    expect(updateUser).toHaveBeenCalledTimes(1);

    const savedVersion = await AsyncStorage.getItem(STORAGE_KEY_LAST_HEARTBEAT_VERSION);
    expect(savedVersion).toBe(APP_VERSION);
  });

  it('forces heartbeat if options.force is true', async () => {
    const today = getTodayDateString();
    await AsyncStorage.setItem(STORAGE_KEY_LAST_HEARTBEAT_DATE, today);
    await AsyncStorage.setItem(STORAGE_KEY_LAST_HEARTBEAT_VERSION, APP_VERSION);

    const updateUser = vi.fn().mockResolvedValue(undefined);
    const result = await checkAndSendHeartbeat(mockUser, updateUser, { force: true });

    expect(result).toBe(true);
    expect(updateUser).toHaveBeenCalledTimes(1);
  });

  it('handles updateUser errors gracefully without throwing', async () => {
    const updateUser = vi.fn().mockRejectedValue(new Error('Network offline'));
    const result = await checkAndSendHeartbeat(mockUser, updateUser);

    expect(result).toBe(false);
  });

  it('resetHeartbeatCache removes both date and version keys', async () => {
    await AsyncStorage.setItem(STORAGE_KEY_LAST_HEARTBEAT_DATE, '2026-01-01');
    await AsyncStorage.setItem(STORAGE_KEY_LAST_HEARTBEAT_VERSION, '1.0.0');

    await resetHeartbeatCache();

    expect(await AsyncStorage.getItem(STORAGE_KEY_LAST_HEARTBEAT_DATE)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEY_LAST_HEARTBEAT_VERSION)).toBeNull();
  });
});
