import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RepeatingTask, UserProfile } from '@/types';
import { safeJsonParse, withError } from '@/utils/safeStorage';

const KEYS = {
  user: '@repeato/user',
  tasksPrefix: '@repeato/tasks:',
  syncPrefix: '@repeato/pending_sync:',
} as const;

function tasksKey(userId: string): string {
  return `${KEYS.tasksPrefix}${userId}`;
}

function syncKey(userId: string): string {
  return `${KEYS.syncPrefix}${userId}`;
}

export async function loadUser(): Promise<UserProfile | null> {
  return withError(async () => {
    const raw = await AsyncStorage.getItem(KEYS.user);
    return safeJsonParse<UserProfile | null>(raw, null);
  }, 'Failed to load user profile');
}

export async function loadTasksForUser(userId: string): Promise<RepeatingTask[]> {
  return withError(async () => {
    const raw = await AsyncStorage.getItem(tasksKey(userId));
    return safeJsonParse<RepeatingTask[]>(raw, []);
  }, 'Failed to load tasks');
}

export async function saveUser(user: UserProfile | null): Promise<void> {
  await withError(async () => {
    if (user) await AsyncStorage.setItem(KEYS.user, JSON.stringify(user));
    else await AsyncStorage.removeItem(KEYS.user);
  }, 'Failed to save user profile');
}

export async function saveTasksForUser(userId: string, tasks: RepeatingTask[]): Promise<void> {
  await withError(async () => {
    await AsyncStorage.setItem(tasksKey(userId), JSON.stringify(tasks));
  }, 'Failed to save tasks');
}

export async function clearUserData(userId?: string): Promise<void> {
  await withError(async () => {
    await AsyncStorage.removeItem(KEYS.user);
    if (userId) {
      await Promise.all([
        AsyncStorage.removeItem(tasksKey(userId)),
        AsyncStorage.removeItem(syncKey(userId)),
      ]);
    }
  }, 'Failed to clear local data');
}

/** @deprecated Use loadUser + loadTasksForUser */
export async function loadAppState(): Promise<{ user: UserProfile | null; tasks: RepeatingTask[] }> {
  const user = await loadUser();
  const tasks = user ? await loadTasksForUser(user.id) : [];
  return { user, tasks };
}

export type SyncOpType = 'create' | 'update' | 'delete';

export interface SyncOperation {
  id: string;
  type: SyncOpType;
  task?: RepeatingTask;
  taskId?: string;
  timestamp: string;
}

export async function enqueueSync(
  userId: string,
  op: Omit<SyncOperation, 'id' | 'timestamp'>
): Promise<void> {
  await withError(async () => {
    const raw = await AsyncStorage.getItem(syncKey(userId));
    const queue = safeJsonParse<SyncOperation[]>(raw, []);
    
    // Deduplicate: latest op per task ID wins
    const targetId = op.task?.id ?? op.taskId;
    const filtered = queue.filter((existing) => {
      const existingId = existing.task?.id ?? existing.taskId;
      return existingId !== targetId;
    });

    filtered.push({
      ...op,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString()
    });
    await AsyncStorage.setItem(syncKey(userId), JSON.stringify(filtered));
  }, 'Failed to queue sync operation');
}

export async function drainSyncQueue(userId: string): Promise<SyncOperation[]> {
  return withError(async () => {
    const raw = await AsyncStorage.getItem(syncKey(userId));
    const queue = safeJsonParse<SyncOperation[]>(raw, []);
    await AsyncStorage.removeItem(syncKey(userId));
    return queue;
  }, 'Failed to drain sync queue');
}

export async function requeueSyncOps(userId: string, ops: SyncOperation[]): Promise<void> {
  if (!ops.length) return;
  await withError(async () => {
    const raw = await AsyncStorage.getItem(syncKey(userId));
    const existing = safeJsonParse<SyncOperation[]>(raw, []);
    await AsyncStorage.setItem(syncKey(userId), JSON.stringify([...existing, ...ops]));
  }, 'Failed to requeue sync operations');
}
