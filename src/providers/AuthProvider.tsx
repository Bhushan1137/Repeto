import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HouseholdContext, Language, UserProfile } from '@/types';
import { userRepository } from '@/data/repositories/userRepository';
import { signInWithGoogle as authSignIn, profileFromFirebaseUser, profileFromSignedInUser } from '@/services/authService';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { initFirebase } from '@/services/firebase/app';
import { subscribeToAuth, configureGoogleSignIn, completeGoogleRedirectSignIn } from '@/services/firebase/auth';
import { normalizeHouseholdProfile, migrateLegacyHousehold, getActiveHousehold, createHouseholdContext, MAX_HOUSEHOLDS, removeMemberFromHousehold as removeMemberFromHouseholdDomain } from '@/domain/household';
import { onSnapshot, doc, collection, query, where } from 'firebase/firestore';
import { getFirestoreDb } from '@/services/firebase/app';

interface AuthContextValue {
  ready: boolean;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  language: Language;
  languageSelected: boolean;
  firebaseReady: boolean;
  /** The currently active household context (multi-household support) */
  activeHousehold: HouseholdContext | null;
  signInWithGoogle: (language: Language) => Promise<{ ok: boolean; user?: UserProfile; error?: string; message?: string }>;
  updateUser: (patch: Partial<UserProfile>) => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
  signOut: () => Promise<void>;
  /** Switches the active household by id */
  switchHousehold: (id: string) => Promise<void>;
  /** Creates a new household context and switches to it */
  createHousehold: (name: string, icon: string, color: string) => Promise<{ ok: boolean; error?: string }>;
  /** Owner deletes the household — removes it from all members and Firestore */
  deleteHousehold: (householdId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Member leaves a household they belong to */
  leaveHousehold: (householdId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Owner removes a specific member from the household */
  removeMemberFromHousehold: (householdId: string, memberCode: string, memberUserId?: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [savedLanguage, setSavedLanguage] = useState<Language>('en');
  const [languageSelected, setLanguageSelected] = useState(false);
  const firebaseReady = isFirebaseConfigured() && initFirebase();

  const language: Language = user?.language ?? savedLanguage;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Load saved language
      try {
        const val = await AsyncStorage.getItem('@repeato/selected_language');
        if (!cancelled && val) {
          setSavedLanguage(val as Language);
          setLanguageSelected(true);
        }
      } catch (err) {
        console.warn('[Repeato] Failed to load saved language', err);
      }

      // 2. Load local user
      try {
        const loaded = await userRepository.load();
        if (!cancelled && loaded) {
          setUser(loaded);
          setReady(true);
        }
      } catch (err) {
        console.warn('[Repeato] Failed to load local user', err);
      }

      if (!firebaseReady) {
        setReady(true);
        return;
      }

      configureGoogleSignIn();
      const redirectUser = await completeGoogleRedirectSignIn();
      if (cancelled) return;
      if (redirectUser) {
        try {
          const profile = await profileFromSignedInUser(redirectUser, language);
          setUser(profile);
          await userRepository.save(profile);
        } catch {
          // onAuthStateChanged will handle
        }
      }

      let unsubscribeProfile: (() => void) | null = null;
      let unsubscribeHouseholds: (() => void) | null = null;

      const unsubscribeAuth = subscribeToAuth((firebaseUser) => {
        if (cancelled) return;

        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        if (unsubscribeHouseholds) {
          unsubscribeHouseholds();
          unsubscribeHouseholds = null;
        }

        if (!firebaseUser) {
          setUser(null);
          setReady(true);
          return;
        }

        const db = getFirestoreDb();
        if (db) {
          unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snap) => {
            if (cancelled) return;

            try {
              const remote = snap.exists() ? (snap.data() as UserProfile) : null;
              const base = remote ?? profileFromFirebaseUser(firebaseUser, language);
              const normalized = normalizeHouseholdProfile({
                ...base,
                profileComplete: base.profileComplete ?? base.name.trim().length >= 2,
              });
              // Run migration from legacy single-household to multi-household (idempotent)
              const migrationNeeded = !normalized.households || normalized.households.length === 0;
              let profile: UserProfile = migrateLegacyHousehold(normalized);

              // Scan pending members and resolve them
              let changed = migrationNeeded; // force remote save if migration ran
              const updatedMembers = await Promise.all((profile.householdMembers ?? []).map(async (m) => {
                if (m.status === 'pending') {
                  const resolved = await userRepository.resolveHouseholdInvite(m.code);
                  if (resolved) {
                    changed = true;
                    return {
                      ...m,
                      userId: resolved.userId,
                      name: resolved.name,
                      color: resolved.color || m.color,
                      status: 'active' as const,
                    };
                  }
                }
                return m;
              }));

              if (changed) {
                profile = { ...profile, householdMembers: updatedMembers };
                await userRepository.save(profile);
              } else {
                await userRepository.saveLocal(profile);
              }

              // Ensure all user household contexts exist in remote /households collection
              if (profile.households && profile.households.length > 0) {
                for (const hh of profile.households) {
                  userRepository.saveHousehold(hh).catch(() => {});
                }
              }

              setUser(profile);
            } catch (err) {
              console.warn('[Repeato] Error loading snapshot profile data', err);
              setUser(normalizeHouseholdProfile(profileFromFirebaseUser(firebaseUser, language)));
            } finally {
              setReady(true);
            }
          }, (err) => {
            console.warn('[Repeato] Profile snapshot listener failed', err);
            setUser(normalizeHouseholdProfile(profileFromFirebaseUser(firebaseUser, language)));
            setReady(true);
          });

          // Subscribe to top-level /households where user is a member for instant real-time sync across devices
          const hhQuery = query(collection(db, 'households'), where('memberUids', 'array-contains', firebaseUser.uid));
          unsubscribeHouseholds = onSnapshot(hhQuery, (snap) => {
            if (cancelled) return;
            const remoteHhs = snap.docs.map((d) => d.data() as HouseholdContext);
            if (remoteHhs.length > 0) {
              setUser((prevUser) => {
                if (!prevUser) return null;
                const existingHhs = prevUser.households ?? [];
                const hhMap = new Map<string, HouseholdContext>();
                existingHhs.forEach((h) => hhMap.set(h.id, h));
                remoteHhs.forEach((h) => hhMap.set(h.id, h));
                const mergedHhs = Array.from(hhMap.values());
                const updated = {
                  ...prevUser,
                  households: mergedHhs,
                  activeHouseholdId: prevUser.activeHouseholdId || mergedHhs[0]?.id,
                };
                userRepository.saveLocal(updated).catch(() => {});
                return updated;
              });
            }
          }, (err) => {
            console.warn('[Repeato] Household query snapshot listener failed:', err);
          });
        } else {
          setUser(normalizeHouseholdProfile(profileFromFirebaseUser(firebaseUser, language)));
          setReady(true);
        }
      });

      return () => {
        if (unsubscribeAuth) unsubscribeAuth();
        if (unsubscribeProfile) unsubscribeProfile();
        if (unsubscribeHouseholds) unsubscribeHouseholds();
      };
    }

    const unsubPromise = init();

    return () => {
      cancelled = true;
      unsubPromise.then((unsub) => {
        if (typeof unsub === 'function') {
          unsub();
        }
      });
    };
  }, [firebaseReady]);

  const persistUser = useCallback(async (next: UserProfile | null) => {
    const normalized = next ? normalizeHouseholdProfile(next) : null;
    setUser(normalized);
    await userRepository.save(normalized);
  }, []);

  const signInWithGoogle = useCallback(
    async (lang: Language): Promise<{ ok: boolean; user?: UserProfile; error?: string; message?: string }> => {
      const result = await authSignIn(lang);
      if (!result.ok || !result.user) {
        return { ok: false, error: result.error, message: result.message };
      }
      const finalUser: UserProfile = {
        ...result.user,
        termsAcceptedAt: result.user.termsAcceptedAt ?? new Date().toISOString(),
      };
      await persistUser(finalUser);
      return { ok: true, user: finalUser };
    },
    [persistUser]
  );

  const updateUser = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!user) return;
      await persistUser({ ...user, ...patch });
    },
    [user, persistUser]
  );

  const setLanguage = useCallback(
    async (lang: Language) => {
      try {
        await AsyncStorage.setItem('@repeato/selected_language', lang);
        setSavedLanguage(lang);
        setLanguageSelected(true);
      } catch (err) {
        console.warn('[Repeato] Failed to save language selection', err);
      }
      if (user) await persistUser({ ...user, language: lang, languageSelected: true });
    },
    [user, persistUser]
  );

  const signOut = useCallback(async () => {
    const userId = user?.id;
    await userRepository.clear(userId);
    setUser(null);
  }, [user?.id]);

  const activeHousehold = useMemo(() => {
    if (!user) return null;
    return getActiveHousehold(user);
  }, [user]);

  const switchHousehold = useCallback(async (id: string) => {
    if (!user) return;
    await persistUser({ ...user, activeHouseholdId: id });
  }, [user, persistUser]);

  const createHousehold = useCallback(async (name: string, icon: string, color: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Not signed in' };
    const existing = user.households ?? [];
    if (existing.length >= MAX_HOUSEHOLDS) {
      return { ok: false, error: 'limit_reached' };
    }
    const nameNorm = name.trim().toLowerCase();
    if (existing.some(h => h.name.trim().toLowerCase() === nameNorm)) {
      return { ok: false, error: 'name_exists' };
    }
    if (name.trim().length < 2 || name.trim().length > 30) {
      return { ok: false, error: 'invalid_name' };
    }
    const newHousehold = createHouseholdContext(name, icon, color, user);
    await userRepository.saveHousehold(newHousehold);
    await persistUser({
      ...user,
      households: [...existing, newHousehold],
      activeHouseholdId: newHousehold.id,
    });
    return { ok: true };
  }, [user, persistUser]);

  // ── Owner: Delete Household ──────────────────────────────────────────────
  const deleteHousehold = useCallback(async (householdId: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'not_signed_in' };
    const hh = (user.households ?? []).find(h => h.id === householdId);
    if (!hh) return { ok: false, error: 'not_found' };
    if (hh.ownerUid !== user.id) return { ok: false, error: 'not_owner' };

    // 1. Remove household from ALL members' profiles in Firestore
    const otherMemberUids = (hh.memberUids ?? []).filter(uid => uid !== user.id);
    await Promise.allSettled(
      otherMemberUids.map(async (uid) => {
        try {
          const remote = await userRepository.loadRemote(uid);
          if (remote) {
            const updatedHouseholds = (remote.households ?? []).filter(h => h.id !== householdId);
            const nextActiveId = updatedHouseholds[0]?.id ?? undefined;
            await userRepository.saveOther(uid, {
              ...remote,
              households: updatedHouseholds,
              activeHouseholdId: nextActiveId,
              removedBy: user.name || 'Owner',
            });
          }
        } catch (err) {
          console.warn('[Repeato] Failed to update member on household delete:', err);
        }
      })
    );

    // 2. Delete Firestore /households/{id}
    await userRepository.deleteHousehold(householdId);

    // 3. Remove household from own profile
    const remainingHouseholds = (user.households ?? []).filter(h => h.id !== householdId);
    const nextActiveId = remainingHouseholds.length > 0
      ? (user.activeHouseholdId !== householdId ? user.activeHouseholdId : remainingHouseholds[0].id)
      : undefined;
    await persistUser({
      ...user,
      households: remainingHouseholds,
      activeHouseholdId: nextActiveId,
    });
    return { ok: true };
  }, [user, persistUser]);

  // ── Member: Leave Household ──────────────────────────────────────────────
  const leaveHousehold = useCallback(async (householdId: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'not_signed_in' };
    const hh = (user.households ?? []).find(h => h.id === householdId);
    if (!hh) return { ok: false, error: 'not_found' };

    // 1. Remove self from /households/{id} in Firestore
    try {
      const remoteHh = await userRepository.loadHousehold(householdId);
      if (remoteHh) {
        const updatedHh: HouseholdContext = {
          ...remoteHh,
          members: remoteHh.members.filter(m => m.userId !== user.id),
          memberUids: (remoteHh.memberUids ?? []).filter(uid => uid !== user.id),
        };
        await userRepository.saveHousehold(updatedHh);
      }
    } catch (err) {
      console.warn('[Repeato] Failed to update household on leave:', err);
    }

    // 2. Notify owner
    if (hh.ownerUid && hh.ownerUid !== user.id) {
      try {
        await userRepository.saveNotification(hh.ownerUid, {
          id: `${Date.now()}-leave`,
          type: 'household',
          title: 'Member Left Household',
          body: `${user.name || 'A member'} left "${hh.name}".`,
          timestamp: new Date().toISOString(),
          read: false,
        });
      } catch (err) {
        console.warn('[Repeato] Failed to notify owner on leave:', err);
      }
    }

    // 3. Remove household from own profile
    const remainingHouseholds = (user.households ?? []).filter(h => h.id !== householdId);
    const nextActiveId = remainingHouseholds.length > 0
      ? (user.activeHouseholdId !== householdId ? user.activeHouseholdId : remainingHouseholds[0].id)
      : undefined;
    await persistUser({
      ...user,
      households: remainingHouseholds,
      activeHouseholdId: nextActiveId,
    });
    return { ok: true };
  }, [user, persistUser]);

  // ── Owner: Remove a Member ───────────────────────────────────────────────
  const removeMemberFromHousehold = useCallback(
    async (householdId: string, memberCode: string, memberUserId?: string): Promise<{ ok: boolean; error?: string }> => {
      if (!user) return { ok: false, error: 'not_signed_in' };
      const hh = (user.households ?? []).find(h => h.id === householdId);
      if (!hh) return { ok: false, error: 'not_found' };
      if (hh.ownerUid !== user.id) return { ok: false, error: 'not_owner' };

      // 1. Remove member from this user's household list
      const patch = removeMemberFromHouseholdDomain(user, householdId, memberCode);
      await persistUser({ ...user, ...patch });

      // 2. Update /households/{id} in Firestore
      try {
        const remoteHh = await userRepository.loadHousehold(householdId);
        if (remoteHh) {
          const updatedHh: HouseholdContext = {
            ...remoteHh,
            members: remoteHh.members.filter(m => m.code !== memberCode),
            memberUids: memberUserId
              ? (remoteHh.memberUids ?? []).filter(uid => uid !== memberUserId)
              : remoteHh.memberUids,
          };
          await userRepository.saveHousehold(updatedHh);
        }
      } catch (err) {
        console.warn('[Repeato] Failed to update household on member remove:', err);
      }

      // 3. Remove household from the removed member's profile + notify them
      if (memberUserId) {
        try {
          const remoteB = await userRepository.loadRemote(memberUserId);
          if (remoteB) {
            const updatedHouseholds = (remoteB.households ?? []).filter(h => h.id !== householdId);
            const nextActiveId = updatedHouseholds[0]?.id ?? undefined;
            await userRepository.saveOther(memberUserId, {
              ...remoteB,
              households: updatedHouseholds,
              activeHouseholdId: nextActiveId,
              removedBy: user.name || 'Owner',
            });
          }
          await userRepository.saveNotification(memberUserId, {
            id: `${Date.now()}-removed`,
            type: 'household',
            title: 'Removed from Household',
            body: `${user.name || 'Owner'} removed you from "${hh.name}".`,
            timestamp: new Date().toISOString(),
            read: false,
          });
        } catch (err) {
          console.warn('[Repeato] Failed to notify removed member:', err);
        }
      }
      return { ok: true };
    },
    [user, persistUser]
  );

  const value = useMemo(
    () => ({
      ready,
      user,
      setUser,
      language,
      languageSelected,
      firebaseReady,
      activeHousehold,
      signInWithGoogle,
      updateUser,
      setLanguage,
      signOut,
      switchHousehold,
      createHousehold,
      deleteHousehold,
      leaveHousehold,
      removeMemberFromHousehold,
    }),
    [ready, user, setUser, language, languageSelected, firebaseReady, activeHousehold, signInWithGoogle, updateUser, setLanguage, signOut, switchHousehold, createHousehold, deleteHousehold, leaveHousehold, removeMemberFromHousehold]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
