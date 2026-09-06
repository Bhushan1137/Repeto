import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearUserData,
  drainSyncQueue,
  enqueueSync,
  loadTasksForUser,
  loadUser,
  requeueSyncOps,
  saveTasksForUser,
  saveUser,
} from '@/data/sources/localSource';
import type { RepeatingTask, UserProfile } from '@/types';

vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(async () => store.clear()),
    },
  };
});

describe('data/sources/localSource', () => {
  const dummyUser: UserProfile = {
    id: 'u123',
    name: 'Malay',
    email: 'test@example.com',
    language: 'en',
    pushOptIn: true,
    profileComplete: true,
    onboardingComplete: true,
    plan: 'free',
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    vi.clearAllMocks();
  });

  it('saves and loads user profile', async () => {
    await saveUser(dummyUser);
    const loaded = await loadUser();
    expect(loaded).toEqual(dummyUser);

    await saveUser(null);
    const cleared = await loadUser();
    expect(cleared).toBeNull();
  });

  it('saves and loads tasks for user', async () => {
    const dummyTask: RepeatingTask = {
      id: 't1',
      title: 'Task 1',
      category: 'bills',
      recurrence: { type: 'monthly' },
      frequencyLabel: 'Monthly',
      nextDueDate: '2026-09-10T00:00:00.000Z',
      finance: false,
      history: [],
      createdAt: 'iso',
      updatedAt: 'iso',
      escalationCount: 0,
      sharedWith: [],
    };

    await saveTasksForUser('u123', [dummyTask]);
    const loaded = await loadTasksForUser('u123');
    expect(loaded).toEqual([dummyTask]);
  });

  it('handles sync queue operations: enqueue, drain, requeue', async () => {
    await enqueueSync('u123', { type: 'create', taskId: 't1' });
    await enqueueSync('u123', { type: 'update', taskId: 't1' }); // replaces previous for t1

    const ops = await drainSyncQueue('u123');
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('update');

    const emptyAfterDrain = await drainSyncQueue('u123');
    expect(emptyAfterDrain).toHaveLength(0);

    await requeueSyncOps('u123', ops);
    const requeued = await drainSyncQueue('u123');
    expect(requeued).toHaveLength(1);
  });

  it('clears user data and tasks', async () => {
    await saveUser(dummyUser);
    await saveTasksForUser('u123', []);
    await clearUserData('u123');

    expect(await loadUser()).toBeNull();
    expect(await loadTasksForUser('u123')).toEqual([]);
  });
});
