import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, query, orderBy, limit, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirestoreDb, getFirebaseAuth } from './app';
import type { RepeatingTask, UserProfile } from '@/types';
import { inviteProfileFromUser, type HouseholdInviteProfile } from '@/domain/household';
import type { AppNotification } from '@/types/notification';
import type { Recommendation } from '@/types/recommendation';

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

  await waitForAuthUid();
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function saveTaskRemote(userId: string, task: RepeatingTask): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  await waitForAuthUid();
  const payload = forFirestore(task as unknown as Record<string, unknown>);
  await setDoc(doc(db, 'users', userId, 'tasks', task.id), payload, { merge: true });
}

export async function loadTasksRemote(userId: string): Promise<RepeatingTask[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  await waitForAuthUid();
  const snap = await getDocs(collection(db, 'users', userId, 'tasks'));
  return snap.docs.map((d) => d.data() as RepeatingTask);
}

export async function deleteTaskRemote(userId: string, taskId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  await waitForAuthUid();
  await deleteDoc(doc(db, 'users', userId, 'tasks', taskId));
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

export async function saveOtherUserRemote(userId: string, user: UserProfile): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  const payload = forFirestore(user as unknown as Record<string, unknown>);
  await setDoc(doc(db, 'users', userId), payload, { merge: true });
}

export async function saveNotificationRemote(userId: string, notif: AppNotification): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  const payload = forFirestore(notif as unknown as Record<string, unknown>);
  await setDoc(doc(db, 'users', userId, 'notifications', notif.id), payload, { merge: true });
}

export function listenNotificationsRemote(userId: string, callback: (notifs: AppNotification[]) => void): () => void {
  const db = getFirestoreDb();
  if (!db) return () => {};

  const colRef = collection(db, 'users', userId, 'notifications');
  const q = query(colRef, orderBy('timestamp', 'desc'), limit(50));

  return onSnapshot(q, (snap) => {
    const list: AppNotification[] = [];
    snap.forEach((doc) => {
      list.push(doc.data() as AppNotification);
    });
    callback(list);
  }, (err) => {
    console.warn('[Repeato] Notifications listener failed', err);
  });
}

export async function deleteNotificationRemote(userId: string, notifId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await deleteDoc(doc(db, 'users', userId, 'notifications', notifId));
}

export async function loadRecommendationsRemote(): Promise<Recommendation[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const snaps = await getDocs(collection(db, 'recommendations'));
    const recs: Recommendation[] = [];
    snaps.forEach((doc) => {
      const data = doc.data();
      if (data.active) {
        recs.push({ id: doc.id, ...data } as Recommendation);
      }
    });
    return recs;
  } catch (err) {
    console.warn('[Repeato] Failed to load recommendations:', err);
    return [];
  }
}

export async function logRecommendationImpressionRemote(recId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await updateDoc(doc(db, 'recommendations', recId), {
      impressions: increment(1),
    });
  } catch (err) {
    console.warn('[Repeato] Failed to log impression:', err);
  }
}

export async function logRecommendationClickRemote(recId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await updateDoc(doc(db, 'recommendations', recId), {
      clicks: increment(1),
    });
  } catch (err) {
    console.warn('[Repeato] Failed to log click:', err);
  }
}
