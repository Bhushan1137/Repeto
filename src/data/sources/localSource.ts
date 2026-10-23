import type { RepeatingTask, UserProfile } from '@/types';
import {
  loadUserSqlite,
  saveUserSqlite,
  loadTasksSqlite,
  saveTasksSqlite,
  saveSingleTaskSqlite,
  deleteSingleTaskSqlite,
  deleteMultipleTasksSqlite,
  enqueueSyncSqlite,
  drainSyncQueueSqlite,
  clearAllSqliteData,
  type SyncOperation,
  type SyncOpType,
} from './sqliteSource';

export type { SyncOperation, SyncOpType };

export async function loadUser(): Promise<UserProfile | null> {
  return loadUserSqlite();
}

export async function saveUser(user: UserProfile | null): Promise<void> {
  return saveUserSqlite(user);
}

export async function loadTasksForUser(userId: string): Promise<RepeatingTask[]> {
  return loadTasksSqlite(userId);
}

export async function saveTasksForUser(userId: string, tasks: RepeatingTask[]): Promise<void> {
  return saveTasksSqlite(userId, tasks);
}

export async function saveSingleTaskLocal(userId: string, task: RepeatingTask): Promise<void> {
  return saveSingleTaskSqlite(userId, task);
}

export async function deleteSingleTaskLocal(userId: string, taskId: string): Promise<void> {
  return deleteSingleTaskSqlite(userId, taskId);
}

export async function deleteMultipleTasksLocal(userId: string, taskIds: string[]): Promise<void> {
  return deleteMultipleTasksSqlite(userId, taskIds);
}

export async function clearUserData(userId?: string): Promise<void> {
  return clearAllSqliteData(userId);
}

export async function enqueueSync(
  userId: string,
  op: Omit<SyncOperation, 'id' | 'timestamp'>
): Promise<void> {
  return enqueueSyncSqlite(userId, op);
}

export async function drainSyncQueue(userId: string): Promise<SyncOperation[]> {
  return drainSyncQueueSqlite(userId);
}

export async function requeueSyncOps(userId: string, ops: SyncOperation[]): Promise<void> {
  for (const op of ops) {
    await enqueueSyncSqlite(userId, op);
  }
}

/** @deprecated Use loadUser + loadTasksForUser */
export async function loadAppState(): Promise<{ user: UserProfile | null; tasks: RepeatingTask[] }> {
  const user = await loadUser();
  const tasks = user ? await loadTasksForUser(user.id) : [];
  return { user, tasks };
}
