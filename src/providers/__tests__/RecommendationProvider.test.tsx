import { describe, expect, it, vi } from 'vitest';

(globalThis as any).__DEV__ = true;

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn().mockResolvedValue(true),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: vi.fn().mockResolvedValue('notif-id'),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
  AndroidImportance: { HIGH: 4 },
}));

vi.mock('@/services/firebase/app', () => ({
  getFirestoreDb: vi.fn(() => null),
}));

vi.mock('@/services/firebase/firestore', () => ({
  logRecommendationImpressionRemote: vi.fn(),
  logRecommendationClickRemote: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}));

import { RecommendationProvider, useRecommendations } from '@/providers/RecommendationProvider';

describe('providers/RecommendationProvider', () => {
  it('exports RecommendationProvider component and useRecommendations hook', () => {
    expect(typeof RecommendationProvider).toBe('function');
    expect(typeof useRecommendations).toBe('function');
  });
});

