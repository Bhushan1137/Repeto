import { collection, onSnapshot } from 'firebase/firestore';
import { getFirestoreDb } from './app';
import type { RepeatingTask } from '@/types';

export function subscribeToTasks(
  userId: string,
  onUpdate: (tasks: RepeatingTask[]) => void
): () => void {
  const db = getFirestoreDb();
  if (!db) return () => {};

  const colRef = collection(db, 'users', userId, 'tasks');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const tasks = snapshot.docs.map((doc) => doc.data() as RepeatingTask);
      onUpdate(tasks);
    },
    (error) => {
      console.warn('[Repeato] Task listener error:', error);
    }
  );
}
