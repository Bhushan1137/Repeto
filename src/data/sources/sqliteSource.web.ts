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

export type SyncOpType = 'create' | 'update' | 'delete';

export interface SyncOperation {
  id: string;
  type: SyncOpType;
  task?: RepeatingTask;
  taskId?: string;
  householdId?: string;
  timestamp: string;
}

// ─── Web Implementation (AsyncStorage Fallback / No expo-sqlite dependency) ───

export async function loadUserSqlite(): Promise<UserProfile | null> {
  return withError(async () => {
    const raw = await AsyncStorage.getItem(KEYS.user);
    return safeJsonParse<UserProfile | null>(raw, null);
  }, 'Failed to load user profile');
}

export async function saveUserSqlite(user: UserProfile | null): Promise<void> {
  if (user) {
    await AsyncStorage.setItem(KEYS.user, JSON.stringify(user));
  } else {
    await AsyncStorage.removeItem(KEYS.user);
  }
}

export async function loadTasksSqlite(userId: string): Promise<RepeatingTask[]> {
  if (!userId) return [];
  return withError(async () => {
    const raw = await AsyncStorage.getItem(tasksKey(userId));
    return safeJsonParse<RepeatingTask[]>(raw, []);
  }, 'Failed to load tasks');
}

export async function saveTasksSqlite(userId: string, tasks: RepeatingTask[]): Promise<void> {
  if (!userId) return;
  await AsyncStorage.setItem(tasksKey(userId), JSON.stringify(tasks));
}

export async function saveSingleTaskSqlite(userId: string, task: RepeatingTask): Promise<void> {
  if (!userId || !task) return;
  const current = await loadTasksSqlite(userId);
  const idx = current.findIndex((t) => t.id === task.id);
  const next = idx >= 0 ? current.map((t) => (t.id === task.id ? task : t)) : [task, ...current];
  await AsyncStorage.setItem(tasksKey(userId), JSON.stringify(next));
}

export async function deleteSingleTaskSqlite(userId: string, taskId: string): Promise<void> {
  if (!userId || !taskId) return;
  const current = await loadTasksSqlite(userId);
  const next = current.filter((t) => t.id !== taskId);
  await AsyncStorage.setItem(tasksKey(userId), JSON.stringify(next));
}

export async function enqueueSyncSqlite(
  userId: string,
  op: Omit<SyncOperation, 'id' | 'timestamp'>
): Promise<void> {
  if (!userId) return;
  const opId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const timestamp = new Date().toISOString();
  const fullOp: SyncOperation = { ...op, id: opId, timestamp };

  const raw = await AsyncStorage.getItem(syncKey(userId));
  const queue = safeJsonParse<SyncOperation[]>(raw, []);
  const targetId = op.task?.id ?? op.taskId;
  const filtered = queue.filter((existing) => (existing.task?.id ?? existing.taskId) !== targetId);
  filtered.push(fullOp);
  await AsyncStorage.setItem(syncKey(userId), JSON.stringify(filtered));
}

export async function drainSyncQueueSqlite(userId: string): Promise<SyncOperation[]> {
  if (!userId) return [];
  const raw = await AsyncStorage.getItem(syncKey(userId));
  const ops = safeJsonParse<SyncOperation[]>(raw, []);
  await AsyncStorage.removeItem(syncKey(userId));
  return ops;
}

export async function clearAllSqliteData(userId?: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const storageKeys = keys.filter((k) => k.startsWith('@repeato/') || k.startsWith('@repeto/'));
    if (storageKeys.length > 0) {
      await Promise.all(storageKeys.map((k) => AsyncStorage.removeItem(k)));
    }
  } catch {
    await AsyncStorage.removeItem(KEYS.user);
    if (userId) {
      await AsyncStorage.removeItem(tasksKey(userId));
      await AsyncStorage.removeItem(syncKey(userId));
    }
  }
}
