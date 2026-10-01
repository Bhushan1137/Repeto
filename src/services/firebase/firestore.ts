import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, query, where, orderBy, limit, onSnapshot, updateDoc, increment } from 'firebase/firestore';
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
  if (!task.id) throw new Error('Task ID is required');

  await waitForAuthUid();
  const payload = forFirestore(task as unknown as Record<string, unknown>);
  await setDoc(doc(db, 'users', userId, 'tasks', task.id), payload, { merge: true });
}

export async function loadTasksRemote(userId: string, maxLimit = 100): Promise<RepeatingTask[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  try {
    await waitForAuthUid();
    const q = query(collection(db, 'users', userId, 'tasks'), limit(maxLimit));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as RepeatingTask);
  } catch (err) {
    console.warn('[Repeato] loadTasksRemote error:', err);
    return [];
  }
}

export async function deleteTaskRemote(userId: string, taskId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  await waitForAuthUid();
  await deleteDoc(doc(db, 'users', userId, 'tasks', taskId));
}

export async function saveUserCodeRemote(profile: {
  userCode: string;
  userId: string;
  name: string;
  color: string;
  photoUrl?: string;
  activeHouseholdCode?: string;
  activeHouseholdId?: string;
}): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  const uid = await waitForAuthUid();
  if (!uid) throw new Error('not_authenticated');
  const upperCode = profile.userCode.trim().toUpperCase();
  const payload = forFirestore({ ...profile, userCode: upperCode } as unknown as Record<string, unknown>);
  await setDoc(doc(db, 'userCodes', upperCode), payload, { merge: true });
}

export async function loadUserCodeRemote(code: string): Promise<{
  userCode: string;
  userId: string;
  name: string;
  color: string;
  photoUrl?: string;
  activeHouseholdCode?: string;
  activeHouseholdId?: string;
} | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  const uid = await waitForAuthUid();
  if (!uid) throw new Error('not_authenticated');
  const snap = await getDoc(doc(db, 'userCodes', code.toUpperCase()));
  return snap.exists() ? (snap.data() as {
    userCode: string;
    userId: string;
    name: string;
    color: string;
    photoUrl?: string;
    activeHouseholdCode?: string;
    activeHouseholdId?: string;
  }) : null;
}

export async function findHouseholdCodeByOwnerRemote(ownerUid: string): Promise<HouseholdCodeRecord | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  const uid = await waitForAuthUid();
  if (!uid) throw new Error('not_authenticated');
  try {
    const q = query(collection(db, 'householdCodes'), where('ownerUid', '==', ownerUid), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as HouseholdCodeRecord;
    }
  } catch (err) {
    console.warn('[Repeato] findHouseholdCodeByOwnerRemote failed:', err);
  }
  return null;
}

export interface HouseholdCodeRecord {
  code: string;
  householdId: string;
  name: string;
  icon: string;
  color: string;
  ownerUid: string;
  memberUids: string[];
  members?: import('@/types').HouseholdMemberProfile[];
  updatedAt: string;
}

export async function saveHouseholdCodeRemote(household: import('@/types').HouseholdContext): Promise<void> {
  const db = getFirestoreDb();
  if (!db || !household.code) return;
  const uid = await waitForAuthUid();
  if (!uid) return;
  const upperCode = household.code.trim().toUpperCase();
  const payload = forFirestore({
    code: upperCode,
    householdId: household.id,
    name: household.name,
    icon: household.icon || '🏠',
    color: household.color || '#363E71',
    ownerUid: household.ownerUid || uid,
    memberUids: household.memberUids || [uid],
    members: household.members || [],
    updatedAt: new Date().toISOString(),
  } as unknown as Record<string, unknown>);
  await setDoc(doc(db, 'householdCodes', upperCode), payload, { merge: true });
}

export async function deleteHouseholdCodeRemote(code: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db || !code) return;
  const uid = await waitForAuthUid();
  if (!uid) return;
  const upperCode = code.trim().toUpperCase();
  await deleteDoc(doc(db, 'householdCodes', upperCode));
}

export async function resolveHouseholdCodeRemote(code: string): Promise<HouseholdCodeRecord | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  const uid = await waitForAuthUid();
  if (!uid) throw new Error('not_authenticated');
  const upperCode = code.trim().toUpperCase();
  const snap = await getDoc(doc(db, 'householdCodes', upperCode));
  return snap.exists() ? (snap.data() as HouseholdCodeRecord) : null;
}

export async function saveHouseholdRemote(household: import('@/types').HouseholdContext): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  const uid = await waitForAuthUid();
  if (!uid) return;

  const ownerUid = household.ownerUid || uid;
  // If household.memberUids is explicitly provided, respect it (ensuring ownerUid is present).
  // Do NOT force current user `uid` into memberUids if the user is leaving or being removed!
  const memberUids = household.memberUids !== undefined
    ? Array.from(new Set([ownerUid, ...household.memberUids]))
    : Array.from(new Set([uid, ownerUid]));
  const payload = forFirestore({
    ...household,
    ownerUid,
    memberUids,
  } as unknown as Record<string, unknown>);

  await setDoc(doc(db, 'households', household.id), payload, { merge: true });

  if (household.code) {
    await saveHouseholdCodeRemote(household).catch(() => {});
  }
}

export async function deleteHouseholdRemote(householdId: string, code?: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await waitForAuthUid();
  await deleteDoc(doc(db, 'households', householdId));
  if (code) {
    await deleteHouseholdCodeRemote(code).catch(() => {});
  }
}

export async function loadHouseholdRemote(householdId: string): Promise<import('@/types').HouseholdContext | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  await waitForAuthUid();
  const snap = await getDoc(doc(db, 'households', householdId));
  return snap.exists() ? (snap.data() as import('@/types').HouseholdContext) : null;
}

export function listenUserHouseholdsRemote(
  userId: string,
  callback: (households: import('@/types').HouseholdContext[]) => void
): () => void {
  const db = getFirestoreDb();
  if (!db || !userId) return () => {};

  const colRef = collection(db, 'households');
  const q = query(colRef, where('memberUids', 'array-contains', userId));

  return onSnapshot(
    q,
    (snap) => {
      const list: import('@/types').HouseholdContext[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as import('@/types').HouseholdContext);
      });
      callback(list);
    },
    (err) => {
      console.warn('[Repeato] Households query listener failed', err);
    }
  );
}

export async function saveHouseholdTaskRemote(householdId: string, task: RepeatingTask): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await waitForAuthUid();
  const payload = forFirestore({ ...task, householdId } as unknown as Record<string, unknown>);
  await setDoc(doc(db, 'households', householdId, 'tasks', task.id), payload, { merge: true });
}

export async function loadHouseholdTasksRemote(householdId: string): Promise<RepeatingTask[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    await waitForAuthUid();
    const snap = await getDocs(collection(db, 'households', householdId, 'tasks'));
    return snap.docs.map((d) => d.data() as RepeatingTask);
  } catch (err) {
    console.warn('[Repeato] loadHouseholdTasksRemote error:', err);
    return [];
  }
}

export async function deleteHouseholdTaskRemote(householdId: string, taskId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await waitForAuthUid();
  await deleteDoc(doc(db, 'households', householdId, 'tasks', taskId));
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

/**
 * Soft-delete a user account in Firestore.
 * Stamps the user document with isDeleted=true, deletedAt, deletionReason, and purgeAfter.
 * The Firebase Auth account is NOT deleted — it can be recovered by an admin.
 */
export async function softDeleteUserRemote(
  userId: string,
  deletionReason = 'user_requested'
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const uid = await waitForAuthUid();
  if (!uid) throw new Error('not_authenticated');
  if (uid !== userId) throw new Error('not_authorized_delete');

  // purgeAfter = 30 days from now (informational, no auto-purge Cloud Function yet)
  const purgeAfterDate = new Date();
  purgeAfterDate.setDate(purgeAfterDate.getDate() + 30);

  await updateDoc(doc(db, 'users', userId), {
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    deletionReason,
    purgeAfter: purgeAfterDate.toISOString(),
    // Clear push notification token so no further push messages are sent
    pushOptIn: false,
  });
}

/**
 * Restore a soft-deleted account.
 * Clears all deletion stamp fields so the user can sign in and use the app normally.
 */
export async function restoreUserRemote(userId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  const uid = await waitForAuthUid();
  if (!uid) throw new Error('not_authenticated');
  if (uid !== userId) throw new Error('not_authorized_restore');

  await updateDoc(doc(db, 'users', userId), {
    isDeleted: false,
    deletedAt: null,
    deletionReason: null,
    purgeAfter: null,
    pushOptIn: true,
  });
}

/**
 * Permanently purge a user's data for a fresh start.
 * Deletes all sub-collections (tasks, notifications) and overwrites the user doc
 * with a clean slate preserving id and email. The Firebase Auth account is kept.
 */
export async function purgeUserDataRemote(userId: string, email?: string, initialProfile?: Partial<UserProfile>): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  // Ensure Firebase auth token is valid before making writes that require authentication
  const uid = await waitForAuthUid();
  if (!uid) throw new Error('not_authenticated');
  if (uid !== userId) throw new Error('not_authorized_purge');

  // Delete all personal tasks
  try {
    const tasksSnap = await getDocs(collection(db, 'users', userId, 'tasks'));
    await Promise.all(tasksSnap.docs.map((d) => deleteDoc(d.ref)));
  } catch (err) {
    console.warn('[Repeato] purge: failed to delete tasks sub-collection', err);
  }

  // Delete all notifications
  try {
    const notifsSnap = await getDocs(collection(db, 'users', userId, 'notifications'));
    await Promise.all(notifsSnap.docs.map((d) => deleteDoc(d.ref)));
  } catch (err) {
    console.warn('[Repeato] purge: failed to delete notifications sub-collection', err);
  }

  // Remove user from any households they were member of
  try {
    const hhSnap = await getDocs(
      query(collection(db, 'households'), where('memberUids', 'array-contains', userId))
    );
    await Promise.all(
      hhSnap.docs.map(async (d) => {
        const hhData = d.data();
        if (hhData.ownerUid === userId) {
          await deleteDoc(d.ref);
        } else {
          const updatedMemberUids = (hhData.memberUids || []).filter((id: string) => id !== userId);
          const updatedMembers = (hhData.members || []).filter((m: any) => m.userId !== userId);
          await updateDoc(d.ref, { memberUids: updatedMemberUids, members: updatedMembers });
        }
      })
    );
  } catch (err) {
    console.warn('[Repeato] purge: failed to clean up household memberships', err);
  }

  // Overwrite the user doc with a clean slate (id and email preserved)
  const cleanDoc = forFirestore({
    id: userId,
    email: email || '',
    isDeleted: false,
    purgedAt: new Date().toISOString(),
    name: initialProfile?.name ?? '',
    language: initialProfile?.language ?? 'en',
    languageSelected: initialProfile?.languageSelected ?? false,
    profileComplete: false,
    onboardingComplete: false,
    plan: 'free',
    pushOptIn: true,
    ...(initialProfile ?? {}),
  });

  await setDoc(doc(db, 'users', userId), cleanDoc);
}
