import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HouseholdContext, Language, UserProfile } from '@/types';
import { userRepository } from '@/data/repositories/userRepository';
import { signInWithGoogle as authSignIn, signInWithEmail as authSignInWithEmail, signUpWithEmail as authSignUpWithEmail, profileFromFirebaseUser, profileFromSignedInUser, deleteAccountSoft } from '@/services/authService';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { initFirebase } from '@/services/firebase/app';
import { subscribeToAuth, configureGoogleSignIn, completeGoogleRedirectSignIn, signOutFirebase } from '@/services/firebase/auth';
import { normalizeHouseholdProfile, migrateLegacyHousehold, getActiveHousehold, createHouseholdContext, MAX_HOUSEHOLDS, removeMemberFromHousehold as removeMemberFromHouseholdDomain } from '@/domain/household';
import { onSnapshot, doc, collection, query, where } from 'firebase/firestore';
import { restoreUserRemote, purgeUserDataRemote } from '@/services/firebase/firestore';
import { getFirestoreDb, getFirebaseAuth } from '@/services/firebase/app';
import { useNetworkStatus } from './NetworkProvider';
import { cancelAllNotifications } from '@/services/notifications';

interface AuthContextValue {
  ready: boolean;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  language: Language;
  languageSelected: boolean;
  firebaseReady: boolean;
  /** The currently active household context (multi-household support) */
  activeHousehold: HouseholdContext | null;
  signInWithGoogle: (language: Language) => Promise<{ ok: boolean; user?: UserProfile; isDeleted?: boolean; error?: string; message?: string }>;
  signInWithEmail: (email: string, pass: string) => Promise<{ ok: boolean; user?: UserProfile; isDeleted?: boolean; error?: string; message?: string }>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<{ ok: boolean; user?: UserProfile; error?: string; message?: string }>;
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
  /** Soft-delete the current user account — stamps Firestore, clears local data, signs out */
  deleteAccount: (deletionReason?: string) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Set when a deleted account is detected on sign-in.
   * Contains {deletedAt, purgeAfter, userId} so the recovery screen can show the right UI.
   * Null when no deleted account is pending.
   */
  deletedAccountInfo: { deletedAt: string; purgeAfter: string | null; userId: string } | null;
  /** Restore a previously deleted account — clears the soft-delete stamp */
  restoreAccount: () => Promise<{ ok: boolean; error?: string }>;
  /** Permanently purge data and begin fresh onboarding */
  freshStartAccount: () => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [deletedAccountInfo, setDeletedAccountInfo] = useState<{ deletedAt: string; purgeAfter: string | null; userId: string } | null>(null);
  const [savedLanguage, setSavedLanguage] = useState<Language>('en');
  const [languageSelected, setLanguageSelected] = useState(false);
  const { isOnline } = useNetworkStatus();
  const firebaseReady = isFirebaseConfigured() && initFirebase();

  const isDeletingAccountRef = useRef(false);
  const unsubscribeProfileRef = useRef<(() => void) | null>(null);
  const unsubscribeHouseholdsRef = useRef<(() => void) | null>(null);

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

      // 2. Load local user from SQLite/AsyncStorage
      let localUser: UserProfile | null = null;
      try {
        localUser = await userRepository.load();
        if (!cancelled && localUser) {
          setUser(localUser);
        }
      } catch (err) {
        console.warn('[Repeato] Failed to load local user', err);
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }

      if (!firebaseReady) {
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
        if (isDeletingAccountRef.current) return;

        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        if (unsubscribeHouseholds) {
          unsubscribeHouseholds();
          unsubscribeHouseholds = null;
        }
        unsubscribeProfileRef.current = null;
        unsubscribeHouseholdsRef.current = null;

        if (!firebaseUser) {
          // If offline and we have an existing local user session, retain it
          if (!isOnline && localUser) {
            setUser(localUser);
            setReady(true);
            return;
          }
          if (localUser) {
            localUser = null;
            userRepository.clear().catch(() => {});
          }
          setUser(null);
          setReady(true);
          return;
        }

        // Ensure cached local profile belongs to the currently signed-in Firebase account
        if (localUser && localUser.id !== firebaseUser.uid) {
          const staleId = localUser.id;
          localUser = null;
          userRepository.clear(staleId).catch(() => {});
        }

        if (!isOnline) {
          if (localUser && localUser.id === firebaseUser.uid) {
            setUser(localUser);
          } else {
            setUser(normalizeHouseholdProfile(profileFromFirebaseUser(firebaseUser, language)));
          }
          setReady(true);
          return;
        }

        const db = getFirestoreDb();
        if (db) {
          unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snap) => {
            if (cancelled || isDeletingAccountRef.current) return;

            try {
              const remote = snap.exists() ? (snap.data() as UserProfile) : null;

              // ── Re-entry guard: surface recovery UI if account was soft-deleted ──
              if (remote?.isDeleted === true) {
                if (isDeletingAccountRef.current) return;
                console.warn('[Repeato] Soft-deleted account detected — showing recovery screen.');
                setDeletedAccountInfo({
                  deletedAt: remote.deletedAt ?? new Date().toISOString(),
                  purgeAfter: remote.purgeAfter ?? null,
                  userId: firebaseUser.uid,
                });
                setUser(null);
                setReady(true);
                return;
              }

              const matchingLocal = localUser && localUser.id === firebaseUser.uid ? localUser : null;
              const base = remote
                ? (matchingLocal ? { ...matchingLocal, ...remote } : remote)
                : (matchingLocal ?? profileFromFirebaseUser(firebaseUser, language));
              const normalized = normalizeHouseholdProfile({
                ...base,
                profileComplete: base.profileComplete ?? ((base.name || '').trim().length >= 2),
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
              if (localUser) {
                setUser(localUser);
              } else {
                setUser(normalizeHouseholdProfile(profileFromFirebaseUser(firebaseUser, language)));
              }
            } finally {
              setReady(true);
            }
          }, (err) => {
            console.warn('[Repeato] Profile snapshot listener failed', err);
            if (localUser) {
              setUser(localUser);
            } else {
              setUser(normalizeHouseholdProfile(profileFromFirebaseUser(firebaseUser, language)));
            }
            setReady(true);
          });
          unsubscribeProfileRef.current = unsubscribeProfile;

          // Subscribe to top-level /households where user is a member for instant real-time sync across devices
          const hhQuery = query(collection(db, 'households'), where('memberUids', 'array-contains', firebaseUser.uid));
          unsubscribeHouseholds = onSnapshot(hhQuery, (snap) => {
            if (cancelled || isDeletingAccountRef.current) return;
            const remoteHhs = snap.docs.map((d) => d.data() as HouseholdContext);
            setUser((prevUser) => {
              if (!prevUser) return null;
              const existingHhs = prevUser.households ?? [];
              const hhMap = new Map<string, HouseholdContext>();

              // Add remote authoritative households first
              remoteHhs.forEach((h) => hhMap.set(h.id, h));

              // Check existing local households
              existingHhs.forEach((localHh) => {
                if (hhMap.has(localHh.id)) return;

                // Detect starter collision: empty local household with same name as a remote one
                const isDuplicateStarter =
                  (localHh.members?.length ?? 0) <= 1 &&
                  localHh.ownerUid === prevUser.id &&
                  remoteHhs.some((rh) => (rh.name || '').trim().toLowerCase() === (localHh.name || '').trim().toLowerCase());

                if (!isDuplicateStarter) {
                  hhMap.set(localHh.id, localHh);
                }
              });

              const mergedHhs = Array.from(hhMap.values());
              const updated = {
                ...prevUser,
                households: mergedHhs,
                activeHouseholdId: mergedHhs.some((h) => h.id === prevUser.activeHouseholdId)
                  ? prevUser.activeHouseholdId
                  : mergedHhs[0]?.id,
              };
              userRepository.saveLocal(updated).catch(() => {});
              return updated;
            });
          }, (err) => {
            console.warn('[Repeato] Household query snapshot listener failed:', err);
          });
          unsubscribeHouseholdsRef.current = unsubscribeHouseholds;
        } else {
          setUser(normalizeHouseholdProfile(profileFromFirebaseUser(firebaseUser, language)));
          setReady(true);
        }
      });

      return () => {
        if (unsubscribeAuth) unsubscribeAuth();
        if (unsubscribeProfile) unsubscribeProfile();
        if (unsubscribeHouseholds) unsubscribeHouseholds();
        unsubscribeProfileRef.current = null;
        unsubscribeHouseholdsRef.current = null;
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
  }, [firebaseReady, isOnline]);

  const persistUser = useCallback(async (next: UserProfile | null) => {
    const normalized = next ? normalizeHouseholdProfile(next) : null;
    setUser(normalized);
    await userRepository.save(normalized);
  }, []);

  const signInWithGoogle = useCallback(
    async (lang: Language): Promise<{ ok: boolean; user?: UserProfile; isDeleted?: boolean; error?: string; message?: string }> => {
      const result = await authSignIn(lang);
      if (!result.ok) {
        return { ok: false, error: result.error, message: result.message };
      }
      if (result.isDeleted && result.deletedAccountInfo) {
        setDeletedAccountInfo(result.deletedAccountInfo);
        setUser(null);
        return { ok: true, isDeleted: true };
      }
      if (!result.user) {
        return { ok: false, error: 'failed' };
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

  const signInWithEmail = useCallback(
    async (email: string, pass: string): Promise<{ ok: boolean; user?: UserProfile; isDeleted?: boolean; error?: string; message?: string }> => {
      const result = await authSignInWithEmail(email, pass, language);
      if (!result.ok) {
        return { ok: false, error: result.error, message: result.message };
      }
      if (result.isDeleted && result.deletedAccountInfo) {
        setDeletedAccountInfo(result.deletedAccountInfo);
        setUser(null);
        return { ok: true, isDeleted: true };
      }
      if (!result.user) {
        return { ok: false, error: 'failed', message: result.message };
      }
      const finalUser: UserProfile = {
        ...result.user,
        termsAcceptedAt: result.user.termsAcceptedAt ?? new Date().toISOString(),
      };
      await persistUser(finalUser);
      return { ok: true, user: finalUser };
    },
    [language, persistUser]
  );

  const signUpWithEmail = useCallback(
    async (email: string, pass: string, name?: string): Promise<{ ok: boolean; user?: UserProfile; error?: string; message?: string }> => {
      const result = await authSignUpWithEmail(email, pass, language, name);
      if (!result.ok) {
        return { ok: false, error: result.error, message: result.message };
      }
      if (!result.user) {
        return { ok: false, error: 'failed', message: result.message };
      }
      const finalUser: UserProfile = {
        ...result.user,
        termsAcceptedAt: new Date().toISOString(),
      };
      await persistUser(finalUser);
      return { ok: true, user: finalUser };
    },
    [language, persistUser]
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
    const userId = user?.id ?? deletedAccountInfo?.userId;
    setDeletedAccountInfo(null);
    setUser(null);
    await userRepository.clear(userId);
    await cancelAllNotifications();
    try {
      await signOutFirebase();
    } catch (err) {
      console.warn('[Repeato] Firebase sign out error:', err);
    }
  }, [user?.id, deletedAccountInfo?.userId]);

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

  // ── Delete Account (Soft Delete) ───────────────────────────────────────────
  const deleteAccount = useCallback(
    async (deletionReason = 'user_requested'): Promise<{ ok: boolean; error?: string }> => {
      if (!user) return { ok: false, error: 'not_signed_in' };
      const userId = user.id;
      isDeletingAccountRef.current = true;

      try {
        // 1. Immediately unsubscribe real-time Firestore listeners
        // This prevents the snapshot listener from firing on the soft-delete marker and flashing the recovery screen
        if (unsubscribeProfileRef.current) {
          unsubscribeProfileRef.current();
          unsubscribeProfileRef.current = null;
        }
        if (unsubscribeHouseholdsRef.current) {
          unsubscribeHouseholdsRef.current();
          unsubscribeHouseholdsRef.current = null;
        }

        // 2. Clear state and recovery info immediately so UI does not flash recovery screen
        setDeletedAccountInfo(null);

        // 3. Leave all households: removes self from member lists, notifies owners
        const userHouseholds = user.households ?? [];
        await Promise.allSettled(
          userHouseholds.map((hh) => leaveHousehold(hh.id))
        );

        // 4. Stamp Firestore with soft-delete marker and sign out Firebase Auth
        const result = await deleteAccountSoft(userId, deletionReason);
        if (!result.ok) {
          // Non-blocking: still proceed with local cleanup even if remote stamp failed
          console.warn('[Repeato] Remote soft-delete stamp failed:', result.error);
        }

        // 5. Clear local data and session
        setUser(null);
        setDeletedAccountInfo(null);
        await userRepository.clear(userId).catch(() => {});
        await cancelAllNotifications().catch(() => {});

        return { ok: true };
      } finally {
        setTimeout(() => {
          isDeletingAccountRef.current = false;
        }, 1500);
      }
    },
    [user, leaveHousehold]
  );

  // ── Restore Deleted Account ────────────────────────────────────────────────
  const restoreAccount = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!deletedAccountInfo) return { ok: false, error: 'no_deleted_account' };
    try {
      const targetUid = deletedAccountInfo.userId;
      await restoreUserRemote(targetUid);

      // Immediately reload and set active user so there is no intermediate null-user flicker
      const remote = await userRepository.loadRemote(targetUid);
      if (remote) {
        const profile = normalizeHouseholdProfile({
          ...remote,
          isDeleted: false,
          deletedAt: undefined,
          deletionReason: undefined,
          purgeAfter: undefined,
        });
        await userRepository.save(profile);
        setUser(profile);
      }
      setDeletedAccountInfo(null);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Repeato] restoreAccount failed:', msg);
      return { ok: false, error: msg };
    }
  }, [deletedAccountInfo]);

  // ── Fresh Start (Permanent Purge) ─────────────────────────────────────────
  const freshStartAccount = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!deletedAccountInfo) return { ok: false, error: 'no_deleted_account' };
    try {
      const targetUid = deletedAccountInfo.userId;
      await purgeUserDataRemote(targetUid);
      // Clear local data
      await userRepository.clear(targetUid).catch(() => {});
      await cancelAllNotifications().catch(() => {});

      // Build a clean fresh user profile so onboarding begins immediately
      const auth = getFirebaseAuth();
      const fbUser = auth?.currentUser;
      const baseProfile: UserProfile = fbUser
        ? profileFromFirebaseUser(fbUser, savedLanguage)
        : normalizeHouseholdProfile({
            id: targetUid,
            name: '',
            email: '',
            phone: '',
            language: savedLanguage,
            languageSelected: Boolean(languageSelected),
            pushOptIn: true,
            profileComplete: false,
            onboardingComplete: false,
            plan: 'free',
          });

      const freshProfile = normalizeHouseholdProfile({
        ...baseProfile,
        isDeleted: false,
        deletedAt: undefined,
        purgeAfter: undefined,
        deletionReason: undefined,
        languageSelected: Boolean(languageSelected),
        profileComplete: false,
        onboardingComplete: false,
      });

      await userRepository.save(freshProfile);
      setUser(freshProfile);
      setDeletedAccountInfo(null);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Repeato] freshStartAccount failed:', msg);
      return { ok: false, error: msg };
    }
  }, [deletedAccountInfo, savedLanguage, languageSelected]);

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
      signInWithEmail,
      signUpWithEmail,
      updateUser,
      setLanguage,
      signOut,
      switchHousehold,
      createHousehold,
      deleteHousehold,
      leaveHousehold,
      removeMemberFromHousehold,
      deleteAccount,
      deletedAccountInfo,
      restoreAccount,
      freshStartAccount,
    }),
    [ready, user, setUser, language, languageSelected, firebaseReady, activeHousehold, signInWithGoogle, signInWithEmail, signUpWithEmail, updateUser, setLanguage, signOut, switchHousehold, createHousehold, deleteHousehold, leaveHousehold, removeMemberFromHousehold, deleteAccount, deletedAccountInfo, restoreAccount, freshStartAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
