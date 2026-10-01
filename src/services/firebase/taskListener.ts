import { collection, onSnapshot } from 'firebase/firestore';
import { getFirestoreDb } from './app';
import type { RepeatingTask } from '@/types';

export function subscribeToUserTasksAndHouseholds(
  userId: string,
  householdIds: string[],
  onUpdate: (tasks: RepeatingTask[]) => void,
  onError?: (error: Error) => void
): () => void {
  const db = getFirestoreDb();
  if (!db) return () => {};

  const userTasksMap = new Map<string, RepeatingTask>();
  const householdTasksMap = new Map<string, Map<string, RepeatingTask>>();
  const loadedHouseholds = new Set<string>();
  const unsubs: (() => void)[] = [];

  const notify = () => {
    const combined = new Map<string, RepeatingTask>();
    // Shared household tasks populate first
    householdTasksMap.forEach((hhMap) => {
      hhMap.forEach((task, id) => {
        combined.set(id, task);
      });
    });
    // Merge user's master tasks, keeping whichever is newer
    userTasksMap.forEach((userTask, id) => {
      // If task belongs to a subscribed household whose snapshot has loaded,
      // the household collection is authoritative. If missing there, it was deleted!
      if (userTask.householdId && loadedHouseholds.has(userTask.householdId)) {
        if (!combined.has(id)) {
          return;
        }
      }
      const hhTask = combined.get(id);
      if (!hhTask) {
        combined.set(id, userTask);
      } else {
        const hhTime = hhTask.updatedAt ? new Date(hhTask.updatedAt).getTime() : 0;
        const userTime = userTask.updatedAt ? new Date(userTask.updatedAt).getTime() : 0;
        if (userTime > hhTime) {
          combined.set(id, userTask);
        }
      }
    });
    onUpdate(Array.from(combined.values()));
  };

  // 1. Subscribe to User's Master Collection (/users/{userId}/tasks)
  const userColRef = collection(db, 'users', userId, 'tasks');
  unsubs.push(
    onSnapshot(
      userColRef,
      (snapshot) => {
        userTasksMap.clear();
        snapshot.docs.forEach((d) => {
          const task = d.data() as RepeatingTask;
          userTasksMap.set(task.id, task);
        });
        notify();
      },
      (error) => {
        console.warn('[Repeato] User task listener error:', error);
        if (onError) onError(error);
      }
    )
  );

  // 2. Subscribe to shared household contexts (/households/{hhId}/tasks)
  householdIds.forEach((hhId) => {
    if (!hhId) return;
    const hhColRef = collection(db, 'households', hhId, 'tasks');
    unsubs.push(
      onSnapshot(
        hhColRef,
        (snapshot) => {
          loadedHouseholds.add(hhId);
          let hhMap = householdTasksMap.get(hhId);
          if (!hhMap) {
            hhMap = new Map<string, RepeatingTask>();
            householdTasksMap.set(hhId, hhMap);
          }
          hhMap.clear();
          snapshot.docs.forEach((d) => {
            const task = d.data() as RepeatingTask;
            hhMap!.set(task.id, task);
          });
          notify();
        },
        (error) => {
          console.warn('[Repeato] Household task listener error:', hhId, error);
        }
      )
    );
  });

  return () => {
    unsubs.forEach((unsub) => unsub());
  };
}

/** Legacy single-collection listener — kept for backward compat */
export function subscribeToTasks(
  userId: string,
  onUpdate: (tasks: RepeatingTask[]) => void,
  householdId?: string,
  onError?: (error: Error) => void
): () => void {
  return subscribeToUserTasksAndHouseholds(userId, householdId ? [householdId] : [], onUpdate, onError);
}
