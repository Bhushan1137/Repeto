import type { RepeatingTask } from '@/types';
import {
  loadTasksForUser,
  saveTasksForUser,
  saveSingleTaskLocal,
  deleteSingleTaskLocal,
  enqueueSync,
  drainSyncQueue,
  requeueSyncOps,
} from '@/data/sources/localSource';
import {
  saveTaskRemote,
  loadTasksRemote,
  deleteTaskRemote,
  saveHouseholdTaskRemote,
  deleteHouseholdTaskRemote,
} from '@/services/firebase/firestore';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { initFirebase } from '@/services/firebase/app';

function remoteEnabled(): boolean {
  return isFirebaseConfigured() && initFirebase();
}

export const taskRepository = {
  async load(userId: string | null, isOnline = true): Promise<RepeatingTask[]> {
    if (!userId) return [];

    const local = await loadTasksForUser(userId);

    if (!remoteEnabled() || !isOnline) {
      return local;
    }

    try {
      const remote = await Promise.race([
        loadTasksRemote(userId),
        new Promise<RepeatingTask[]>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1500))
      ]);
      if (remote && Array.isArray(remote) && remote.length > 0) {
        await saveTasksForUser(userId, remote);
        return remote;
      }
      return local;
    } catch {
      return local;
    }
  },

  async saveAll(tasks: RepeatingTask[], userId: string | null): Promise<void> {
    if (!userId) return;
    await saveTasksForUser(userId, tasks);
  },

  async saveOne(
    task: RepeatingTask,
    userId: string,
    op: 'create' | 'update' = 'update'
  ): Promise<void> {
    if (!userId || !task) return;
    await saveSingleTaskLocal(userId, task);
    if (remoteEnabled()) {
      try {
        await saveTaskRemote(userId, task);
      } catch {
        await enqueueSync(userId, { type: op, task });
      }
    } else {
      await enqueueSync(userId, { type: op, task });
    }
  },

  async saveOneHousehold(
    task: RepeatingTask,
    householdId: string,
    userId: string,
    op: 'create' | 'update' = 'update'
  ): Promise<void> {
    if (!userId || !task) return;
    await saveSingleTaskLocal(userId, task);
    if (remoteEnabled()) {
      try {
        await saveHouseholdTaskRemote(householdId, task);
      } catch {
        await enqueueSync(userId, { type: op, task, householdId });
      }
    } else {
      await enqueueSync(userId, { type: op, task, householdId });
    }
  },

  async deleteOne(taskId: string, userId: string): Promise<void> {
    if (!userId || !taskId) return;
    await deleteSingleTaskLocal(userId, taskId);
    if (remoteEnabled()) {
      try {
        await deleteTaskRemote(userId, taskId);
      } catch {
        await enqueueSync(userId, { type: 'delete', taskId });
      }
    } else {
      await enqueueSync(userId, { type: 'delete', taskId });
    }
  },

  async deleteOneHousehold(taskId: string, householdId: string, userId: string): Promise<void> {
    if (!userId || !taskId) return;
    await deleteSingleTaskLocal(userId, taskId);
    if (remoteEnabled()) {
      try {
        await deleteHouseholdTaskRemote(householdId, taskId);
      } catch {
        await enqueueSync(userId, { type: 'delete', taskId, householdId });
      }
    } else {
      await enqueueSync(userId, { type: 'delete', taskId, householdId });
    }
  },

  async replaceAll(tasks: RepeatingTask[], userId: string | null): Promise<void> {
    if (!userId) return;
    await saveTasksForUser(userId, tasks);
    if (remoteEnabled()) {
      try {
        await Promise.all(tasks.map((t) => saveTaskRemote(userId, t)));
      } catch (cause) {
        console.warn('[Repeato] Task cloud sync failed:', cause);
      }
    }
  },

  async flushSyncQueue(userId: string): Promise<void> {
    if (!remoteEnabled()) return;
    const ops = await drainSyncQueue(userId);
    const failed: typeof ops = [];

    for (const op of ops) {
      try {
        if (op.type === 'delete' && op.taskId) {
          if (op.householdId) {
            await deleteHouseholdTaskRemote(op.householdId, op.taskId);
          } else {
            await deleteTaskRemote(userId, op.taskId);
          }
        } else if (op.task) {
          const targetHhId = op.householdId || op.task.householdId;
          if (targetHhId) {
            await saveHouseholdTaskRemote(targetHhId, op.task);
          } else {
            await saveTaskRemote(userId, op.task);
          }
        }
      } catch {
        failed.push(op);
      }
    }

    if (failed.length) await requeueSyncOps(userId, failed);
  },
};
