import type { UserProfile, HouseholdContext } from '@/types';
import { loadUser, saveUser, clearUserData } from '@/data/sources/localSource';
import {
  saveUserRemote,
  loadUserRemote,
  saveUserCodeRemote,
  loadUserCodeRemote,
  saveHouseholdRemote,
  deleteHouseholdRemote,
  loadHouseholdRemote,
  listenUserHouseholdsRemote,
  loadHouseholdInviteRemote,
  saveOtherUserRemote,
  saveNotificationRemote,
  listenNotificationsRemote,
  deleteNotificationRemote,
} from '@/services/firebase/firestore';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { initFirebase } from '@/services/firebase/app';
import { signOutFirebase } from '@/services/firebase/auth';
import { normalizeHouseholdProfile } from '@/domain/household';
import type { AppNotification } from '@/types/notification';

function remoteEnabled(): boolean {
  return isFirebaseConfigured() && initFirebase();
}

async function syncRemote(user: UserProfile): Promise<void> {
  try {
    const normalized = normalizeHouseholdProfile(user);
    await saveUserRemote(normalized);
    if (normalized.userCode && normalized.id) {
      await saveUserCodeRemote({
        userCode: normalized.userCode,
        userId: normalized.id,
        name: normalized.name || 'Repeato user',
        color: normalized.householdMembers?.[0]?.color || '#E8A33D',
        photoUrl: normalized.photoUrl,
      });
    }
  } catch (cause) {
    // Local save already succeeded — don't block the user for cloud sync issues
    console.warn('[Repeato] Profile cloud sync failed:', cause);
  }
}

export const userRepository = {
  async load(): Promise<UserProfile | null> {
    const user = await loadUser();
    return user ? normalizeHouseholdProfile(user) : null;
  },

  async saveLocal(user: UserProfile | null): Promise<void> {
    await saveUser(user ? normalizeHouseholdProfile(user) : null);
  },

  async save(user: UserProfile | null): Promise<void> {
    const normalized = user ? normalizeHouseholdProfile(user) : null;
    await saveUser(normalized);
    if (normalized && remoteEnabled()) {
      await syncRemote(normalized);
    }
  },

  async loadRemote(userId: string): Promise<UserProfile | null> {
    if (!remoteEnabled()) return null;
    try {
      const user = await loadUserRemote(userId);
      return user ? normalizeHouseholdProfile(user) : null;
    } catch (cause) {
      console.warn('[Repeato] Profile cloud load failed:', cause);
      return null;
    }
  },

  async clear(userId?: string): Promise<void> {
    if (remoteEnabled()) {
      try {
        await signOutFirebase();
      } catch {
        // Best-effort sign out
      }
    }
    await clearUserData(userId);
  },

  async resolveUserCode(code: string) {
    if (!remoteEnabled()) return null;
    try {
      return await loadUserCodeRemote(code);
    } catch (cause) {
      console.warn('[Repeato] User code lookup failed:', cause);
      return null;
    }
  },

  async saveHousehold(household: HouseholdContext): Promise<void> {
    if (remoteEnabled()) {
      try {
        await saveHouseholdRemote(household);
      } catch (err) {
        console.warn('[Repeato] saveHousehold failed:', err);
      }
    }
  },

  async deleteHousehold(householdId: string): Promise<void> {
    if (remoteEnabled()) {
      try {
        await deleteHouseholdRemote(householdId);
      } catch (err) {
        console.warn('[Repeato] deleteHousehold failed:', err);
      }
    }
  },

  async loadHousehold(householdId: string): Promise<HouseholdContext | null> {
    if (!remoteEnabled()) return null;
    try {
      return await loadHouseholdRemote(householdId);
    } catch (err) {
      console.warn('[Repeato] loadHousehold failed:', err);
      return null;
    }
  },

  listenHouseholds(userId: string, callback: (households: HouseholdContext[]) => void): () => void {
    if (!remoteEnabled()) return () => {};
    try {
      return listenUserHouseholdsRemote(userId, callback);
    } catch (err) {
      console.warn('[Repeato] listenHouseholds failed:', err);
      return () => {};
    }
  },

  async resolveHouseholdInvite(code: string) {
    if (!remoteEnabled()) return null;
    try {
      return await loadHouseholdInviteRemote(code);
    } catch (cause) {
      console.warn('[Repeato] Household invite lookup failed:', cause);
      return null;
    }
  },

  async saveOther(userId: string, user: UserProfile): Promise<void> {
    if (remoteEnabled()) {
      try {
        await saveOtherUserRemote(userId, normalizeHouseholdProfile(user));
      } catch (err) {
        console.warn('[Repeato] saveOther failed:', err);
      }
    }
  },

  async saveNotification(userId: string, notif: AppNotification): Promise<void> {
    if (remoteEnabled()) {
      try {
        await saveNotificationRemote(userId, notif);
      } catch (err) {
        console.warn('[Repeato] saveNotification failed:', err);
      }
    }
  },

  listenNotifications(userId: string, callback: (notifs: AppNotification[]) => void): () => void {
    if (remoteEnabled()) {
      return listenNotificationsRemote(userId, callback);
    }
    return () => {};
  },

  async deleteNotification(userId: string, notifId: string): Promise<void> {
    if (remoteEnabled()) {
      try {
        await deleteNotificationRemote(userId, notifId);
      } catch (err) {
        console.warn('[Repeato] deleteNotification failed:', err);
      }
    }
  },
};
