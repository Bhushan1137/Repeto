import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { getFirestoreDb, getFirebaseAuth } from './firebase/app';
import { forFirestore } from './firebase/firestore';

export type HouseholdActivityAction =
  | 'task_created'
  | 'task_completed'
  | 'task_snoozed'
  | 'task_skipped'
  | 'task_taken_over'
  | 'task_assigned'
  | 'task_rescheduled'
  | 'task_deleted'
  | 'task_restored'
  | 'member_joined'
  | 'member_left'
  | 'member_removed';

export interface HouseholdActivityItem {
  id: string;
  householdId: string;
  action: HouseholdActivityAction;
  taskId?: string;
  taskTitle?: string;
  actorId: string;
  actorName: string;
  actorColor?: string;
  targetUserId?: string;
  targetUserName?: string;
  timestamp: string;
  note?: string;
  details?: string;
}

export interface RecordActivityInput {
  id?: string;
  householdId: string;
  action: HouseholdActivityAction;
  taskId?: string;
  taskTitle?: string;
  actorId?: string;
  actorName?: string;
  userId?: string;
  userName?: string;
  actorColor?: string;
  targetUserId?: string;
  targetUserName?: string;
  timestamp?: string;
  note?: string;
  details?: string;
}

const STORAGE_KEY_PREFIX = '@repeato/household_activities:';
const MAX_ACTIVITIES = 100;

function generateActivityId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function loadHouseholdActivitiesLocal(householdId: string): Promise<HouseholdActivityItem[]> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${householdId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HouseholdActivityItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveHouseholdActivitiesLocal(householdId: string, items: HouseholdActivityItem[]): Promise<void> {
  try {
    const trimmed = items.slice(0, MAX_ACTIVITIES);
    await AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${householdId}`, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[Repeato] Failed to save local household activities:', err);
  }
}

export async function recordHouseholdActivity(entry: RecordActivityInput): Promise<HouseholdActivityItem> {
  const auth = getFirebaseAuth();
  const currentUid = auth?.currentUser?.uid;
  const actorId = currentUid || entry.actorId || entry.userId || 'unknown';
  const actorName = entry.actorName || entry.userName || 'Member';
  const item: HouseholdActivityItem = {
    id: entry.id || generateActivityId(),
    householdId: entry.householdId,
    action: entry.action,
    taskId: entry.taskId,
    taskTitle: entry.taskTitle || '',
    actorId,
    actorName,
    actorColor: entry.actorColor,
    targetUserId: entry.targetUserId,
    targetUserName: entry.targetUserName,
    timestamp: entry.timestamp || new Date().toISOString(),
    note: entry.note,
    details: entry.details,
  };

  // 1. Immediately cache locally
  try {
    const local = await loadHouseholdActivitiesLocal(item.householdId);
    const updated = [item, ...local.filter((x) => x.id !== item.id)].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    await saveHouseholdActivitiesLocal(item.householdId, updated);
  } catch (err) {
    console.warn('[Repeato] Error caching household activity locally:', err);
  }

  // 2. Sync to Cloud Firestore if online
  const db = getFirestoreDb();
  if (db && item.householdId) {
    try {
      const payload = forFirestore(item as unknown as Record<string, unknown>);
      await setDoc(doc(db, 'households', item.householdId, 'activities', item.id), payload, { merge: true });
    } catch (err) {
      console.warn('[Repeato] Failed to write household activity to Firestore:', err);
    }
  }

  return item;
}

export function subscribeHouseholdActivities(
  householdId: string,
  onUpdate: (items: HouseholdActivityItem[]) => void
): () => void {
  if (!householdId) {
    onUpdate([]);
    return () => {};
  }

  // Load local cache immediately so UI shows instantly
  loadHouseholdActivitiesLocal(householdId).then((items) => {
    if (items.length > 0) {
      onUpdate(items);
    }
  });

  const db = getFirestoreDb();
  if (!db) return () => {};

  try {
    const colRef = collection(db, 'households', householdId, 'activities');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(MAX_ACTIVITIES));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: HouseholdActivityItem[] = [];
        snapshot.docs.forEach((d) => {
          const data = d.data() as HouseholdActivityItem;
          if (data && data.action) {
            items.push({ ...data, id: d.id });
          }
        });
        saveHouseholdActivitiesLocal(householdId, items).catch(() => {});
        onUpdate(items);
      },
      (error) => {
        console.warn('[Repeato] Household activities listener error:', householdId, error);
        loadHouseholdActivitiesLocal(householdId).then(onUpdate).catch(() => {});
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[Repeato] subscribeHouseholdActivities failed:', err);
    return () => {};
  }
}
