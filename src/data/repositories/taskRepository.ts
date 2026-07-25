import type { RepeatingTask } from '@/types';
import {
  loadTasksForUser,
  saveTasksForUser,
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
  async load(userId: string | null): Promise<RepeatingTask[]> {
    if (!userId) return [];

    if (!remoteEnabled()) {
      return loadTasksForUser(userId);
    }

    try {
      const remote = await loadTasksRemote(userId);
      await saveTasksForUser(userId, remote);
      return remote;
    } catch {
      return loadTasksForUser(userId);
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
    if (remoteEnabled()) {
      try {
        await saveHouseholdTaskRemote(householdId, task);
      } catch {
        await enqueueSync(userId, { type: op, task });
      }
    } else {
      await enqueueSync(userId, { type: op, task });
    }
  },

  async deleteOne(taskId: string, userId: string): Promise<void> {
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
    if (remoteEnabled()) {
      try {
        await deleteHouseholdTaskRemote(householdId, taskId);
      } catch {
        await enqueueSync(userId, { type: 'delete', taskId });
      }
    } else {
      await enqueueSync(userId, { type: 'delete', taskId });
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
          await deleteTaskRemote(userId, op.taskId);
        } else if (op.task) {
          if (op.task.householdId) {
            await saveHouseholdTaskRemote(op.task.householdId, op.task);
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
