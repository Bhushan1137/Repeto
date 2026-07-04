import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirestoreDb, getFirebaseAuth } from './app';
import type { RepeatingTask, UserProfile } from '@/types';
import { inviteProfileFromUser, type HouseholdInviteProfile } from '@/domain/household';

/** Firestore rejects undefined field values */
function forFirestore<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as T;
}

/** Wait until Firebase Auth has a signed-in user (needed before Firestore writes). */
async function waitForAuthUid(timeoutMs = 8000): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  if (auth.currentUser?.uid) return auth.currentUser.uid;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (uid: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(uid);
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.uid) finish(user.uid);
    });

    const timer = setTimeout(() => finish(auth.currentUser?.uid ?? null), timeoutMs);
  });
}

export async function saveUserRemote(user: UserProfile): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const uid = await waitForAuthUid();
  if (!uid) throw new Error('not_authenticated');

  const payload = forFirestore({ ...user, id: uid } as unknown as Record<string, unknown>);
  await setDoc(doc(db, 'users', uid), payload, { merge: true });
  await saveHouseholdInviteRemote({ ...user, id: uid });
}

export async function loadUserRemote(userId: string): Promise<UserProfile | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  const uid = (await waitForAuthUid()) ?? userId;
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function saveTaskRemote(userId: string, task: RepeatingTask): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const uid = (await waitForAuthUid()) ?? userId;
  const payload = forFirestore(task as unknown as Record<string, unknown>);
  await setDoc(doc(db, 'users', uid, 'tasks', task.id), payload, { merge: true });
}

export async function loadTasksRemote(userId: string): Promise<RepeatingTask[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const uid = (await waitForAuthUid()) ?? userId;
  const snap = await getDocs(collection(db, 'users', uid, 'tasks'));
  return snap.docs.map((d) => d.data() as RepeatingTask);
}

export async function deleteTaskRemote(userId: string, taskId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const uid = (await waitForAuthUid()) ?? userId;
  await deleteDoc(doc(db, 'users', uid, 'tasks', taskId));
}

export async function saveHouseholdInviteRemote(user: UserProfile): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const uid = await waitForAuthUid();
  if (!uid) throw new Error('not_authenticated');

  const invite = inviteProfileFromUser({ ...user, id: uid });
  const payload = forFirestore(invite as unknown as Record<string, unknown>);
  await setDoc(doc(db, 'householdInvites', invite.code), payload, { merge: true });
}

export async function loadHouseholdInviteRemote(code: string): Promise<HouseholdInviteProfile | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  const uid = await waitForAuthUid();
  if (!uid) throw new Error('not_authenticated');

  const snap = await getDoc(doc(db, 'householdInvites', code));
  return snap.exists() ? (snap.data() as HouseholdInviteProfile) : null;
}
