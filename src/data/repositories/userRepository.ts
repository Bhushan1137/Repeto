import type { UserProfile } from '@/types';
import { loadUser, saveUser, clearUserData } from '@/data/sources/localSource';
import { saveUserRemote, loadUserRemote, loadHouseholdInviteRemote } from '@/services/firebase/firestore';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { initFirebase } from '@/services/firebase/app';
import { signOutFirebase } from '@/services/firebase/auth';
import { normalizeHouseholdProfile } from '@/domain/household';

function remoteEnabled(): boolean {
  return isFirebaseConfigured() && initFirebase();
}

async function syncRemote(user: UserProfile): Promise<void> {
  try {
    await saveUserRemote(normalizeHouseholdProfile(user));
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

  async resolveHouseholdInvite(code: string) {
    if (!remoteEnabled()) return null;
    try {
      return await loadHouseholdInviteRemote(code);
    } catch (cause) {
      console.warn('[Repeato] Household invite lookup failed:', cause);
      return null;
    }
  },
};
