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

// ─── SQLite Native Implementation (Android / iOS) ──────────────────────────

let nativeDb: any = null;

function getNativeDb() {
  if (!nativeDb) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const SQLite = require('expo-sqlite');
      nativeDb = SQLite.openDatabaseSync('repeto.db');
      
      // Initialize tables
      nativeDb.execSync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          profile_json TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          task_json TEXT,
          is_archived INTEGER DEFAULT 0,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          op_type TEXT,
          payload_json TEXT,
          created_at TEXT
        );
      `);
    } catch (err) {
      console.warn('[Repeato SQLite Native] Fallback to AsyncStorage:', err);
      nativeDb = null;
    }
  }
  return nativeDb;
}

// ─── Native Storage & SQLite Sync API ───────────────────────────────────────

export async function loadUserSqlite(): Promise<UserProfile | null> {
  const db = getNativeDb();
  if (db) {
    try {
      const row = db.getFirstSync('SELECT profile_json FROM users LIMIT 1');
      if (row && row.profile_json) {
        return safeJsonParse<UserProfile | null>(row.profile_json, null);
      }
    } catch (err) {
      console.warn('[Repeato SQLite Native] Error loading user:', err);
    }
  }
  return withError(async () => {
    const raw = await AsyncStorage.getItem(KEYS.user);
    return safeJsonParse<UserProfile | null>(raw, null);
  }, 'Failed to load user profile');
}

export async function saveUserSqlite(user: UserProfile | null): Promise<void> {
  const db = getNativeDb();
  if (user) {
    const json = JSON.stringify(user);
    if (db) {
      try {
        db.runSync(
          'INSERT INTO users (id, profile_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET profile_json=excluded.profile_json, updated_at=excluded.updated_at',
          [user.id, json, new Date().toISOString()]
        );
      } catch (err) {
        console.warn('[Repeato SQLite Native] Error saving user:', err);
      }
    }
    await AsyncStorage.setItem(KEYS.user, json);
  } else {
    if (db) {
      try {
        db.runSync('DELETE FROM users');
      } catch (err) {
        console.warn('[Repeato SQLite Native] Error deleting user:', err);
      }
    }
    await AsyncStorage.removeItem(KEYS.user);
  }
}

export async function loadTasksSqlite(userId: string): Promise<RepeatingTask[]> {
  if (!userId) return [];
  const db = getNativeDb();
  if (db) {
    try {
      const rows = db.getAllSync('SELECT task_json FROM tasks WHERE user_id = ?', [userId]);
      if (rows && Array.isArray(rows) && rows.length > 0) {
        return rows
          .map((r: any) => safeJsonParse<RepeatingTask | null>(r.task_json, null))
          .filter((t): t is RepeatingTask => t !== null);
      }
    } catch (err) {
      console.warn('[Repeato SQLite Native] Error loading tasks:', err);
    }
  }
  return withError(async () => {
    const raw = await AsyncStorage.getItem(tasksKey(userId));
    return safeJsonParse<RepeatingTask[]>(raw, []);
  }, 'Failed to load tasks');
}

export async function saveTasksSqlite(userId: string, tasks: RepeatingTask[]): Promise<void> {
  if (!userId) return;
  const db = getNativeDb();
  if (db) {
    try {
      db.execSync('BEGIN TRANSACTION');
      db.runSync('DELETE FROM tasks WHERE user_id = ?', [userId]);
      for (const t of tasks) {
        db.runSync(
          'INSERT INTO tasks (id, user_id, task_json, is_archived, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, task_json=excluded.task_json, is_archived=excluded.is_archived, updated_at=excluded.updated_at',
          [t.id, userId, JSON.stringify(t), t.archived ? 1 : 0, t.updatedAt || new Date().toISOString()]
        );
      }
      db.execSync('COMMIT');
      return;
    } catch (err) {
      try { db.execSync('ROLLBACK'); } catch { /* ignore rollback error */ }
      console.warn('[Repeto SQLite Native] Error saving tasks, falling back to AsyncStorage:', err);
    }
  }
  await AsyncStorage.setItem(tasksKey(userId), JSON.stringify(tasks));
}

export async function saveSingleTaskSqlite(userId: string, task: RepeatingTask): Promise<void> {
  if (!userId || !task) return;
  const db = getNativeDb();
  if (db) {
    try {
      db.runSync(
        'INSERT INTO tasks (id, user_id, task_json, is_archived, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET task_json=excluded.task_json, is_archived=excluded.is_archived, updated_at=excluded.updated_at',
        [task.id, userId, JSON.stringify(task), task.archived ? 1 : 0, task.updatedAt || new Date().toISOString()]
      );
      return;
    } catch (err) {
      console.warn('[Repeto SQLite Native] Error saving single task, falling back to AsyncStorage:', err);
    }
  }
  const current = await loadTasksSqlite(userId);
  const idx = current.findIndex((t) => t.id === task.id);
  const next = idx >= 0 ? current.map((t) => (t.id === task.id ? task : t)) : [task, ...current];
  await AsyncStorage.setItem(tasksKey(userId), JSON.stringify(next));
}

export async function deleteSingleTaskSqlite(userId: string, taskId: string): Promise<void> {
  if (!userId || !taskId) return;
  const db = getNativeDb();
  if (db) {
    try {
      db.runSync('DELETE FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
      return;
    } catch (err) {
      console.warn('[Repeto SQLite Native] Error deleting task, falling back to AsyncStorage:', err);
    }
  }
  const current = await loadTasksSqlite(userId);
  const next = current.filter((t) => t.id !== taskId);
  await AsyncStorage.setItem(tasksKey(userId), JSON.stringify(next));
}

export async function deleteMultipleTasksSqlite(userId: string, taskIds: string[]): Promise<void> {
  if (!userId || taskIds.length === 0) return;
  const db = getNativeDb();
  if (db) {
    try {
      db.execSync('BEGIN TRANSACTION');
      for (const taskId of taskIds) {
        db.runSync('DELETE FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
      }
      db.execSync('COMMIT');
      return;
    } catch (err) {
      try { db.execSync('ROLLBACK'); } catch { /* ignore rollback error */ }
      console.warn('[Repeto SQLite Native] Error deleting multiple tasks, falling back to AsyncStorage:', err);
    }
  }
  const idSet = new Set(taskIds);
  const current = await loadTasksSqlite(userId);
  const next = current.filter((t) => !idSet.has(t.id));
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

  const db = getNativeDb();
  if (db) {
    try {
      db.runSync(
        'INSERT INTO sync_queue (id, user_id, op_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
        [opId, userId, op.type, JSON.stringify(fullOp), timestamp]
      );
      return;
    } catch (err) {
      console.warn('[Repeato SQLite Native] Error queuing sync op, falling back to AsyncStorage:', err);
    }
  }

  const raw = await AsyncStorage.getItem(syncKey(userId));
  const queue = safeJsonParse<SyncOperation[]>(raw, []);
  const targetId = op.task?.id ?? op.taskId;
  const filtered = queue.filter((existing) => (existing.task?.id ?? existing.taskId) !== targetId);
  filtered.push(fullOp);
  await AsyncStorage.setItem(syncKey(userId), JSON.stringify(filtered));
}

export async function drainSyncQueueSqlite(userId: string): Promise<SyncOperation[]> {
  if (!userId) return [];
  const db = getNativeDb();
  let ops: SyncOperation[] = [];

  if (db) {
    try {
      const rows = db.getAllSync('SELECT payload_json FROM sync_queue WHERE user_id = ? ORDER BY created_at ASC', [userId]);
      if (rows && Array.isArray(rows)) {
        ops = rows
          .map((r: any) => safeJsonParse<SyncOperation | null>(r.payload_json, null))
          .filter((o): o is SyncOperation => o !== null);
      }
      db.runSync('DELETE FROM sync_queue WHERE user_id = ?', [userId]);
    } catch (err) {
      console.warn('[Repeato SQLite Native] Error draining sync queue:', err);
    }
  }

  if (ops.length === 0) {
    const raw = await AsyncStorage.getItem(syncKey(userId));
    ops = safeJsonParse<SyncOperation[]>(raw, []);
    await AsyncStorage.removeItem(syncKey(userId));
  } else {
    await AsyncStorage.removeItem(syncKey(userId));
  }

  return ops;
}

export async function clearAllSqliteData(userId?: string): Promise<void> {
  const db = getNativeDb();
  if (db) {
    try {
      if (userId) {
        db.runSync('DELETE FROM users WHERE id = ?', [userId]);
        db.runSync('DELETE FROM tasks WHERE userId = ?', [userId]);
        db.runSync('DELETE FROM sync_queue WHERE userId = ?', [userId]);
      } else {
        db.runSync('DELETE FROM users');
        db.runSync('DELETE FROM tasks');
        db.runSync('DELETE FROM sync_queue');
      }
    } catch (err) {
      console.warn('[Repeato SQLite Native] Error clearing data:', err);
    }
  }
  try {
    const keys = await AsyncStorage.getAllKeys();
    const storageKeys = keys.filter((k) =>
      k === KEYS.user ||
      (userId
        ? k === tasksKey(userId) || k === syncKey(userId)
        : k.startsWith(KEYS.tasksPrefix) || k.startsWith(KEYS.syncPrefix))
    );
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
