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

  const taskMap = new Map<string, RepeatingTask>();
  const unsubs: (() => void)[] = [];

  const notify = () => {
    onUpdate(Array.from(taskMap.values()));
  };

  // 1. Subscribe to User's Master Collection (/users/{userId}/tasks)
  const userColRef = collection(db, 'users', userId, 'tasks');
  unsubs.push(
    onSnapshot(
      userColRef,
      (snapshot) => {
        snapshot.docs.forEach((d) => {
          const task = d.data() as RepeatingTask;
          taskMap.set(task.id, task);
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
          snapshot.docs.forEach((d) => {
            const task = d.data() as RepeatingTask;
            taskMap.set(task.id, task);
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
