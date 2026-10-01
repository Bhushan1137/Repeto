import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HouseholdContext, HouseholdMemberProfile, Language, UserProfile } from '@/types';
import { userRepository } from '@/data/repositories/userRepository';
import { signInWithGoogle as authSignIn, signInWithEmail as authSignInWithEmail, signUpWithEmail as authSignUpWithEmail, profileFromFirebaseUser, profileFromSignedInUser, deleteAccountSoft } from '@/services/authService';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { initFirebase } from '@/services/firebase/app';
import { subscribeToAuth, configureGoogleSignIn, completeGoogleRedirectSignIn, signOutFirebase } from '@/services/firebase/auth';
import { normalizeHouseholdProfile, migrateLegacyHousehold, getActiveHousehold, createHouseholdContext, MAX_HOUSEHOLDS, removeMemberFromHousehold as removeMemberFromHouseholdDomain, normalizeInviteCode, generateUserCode, memberColor } from '@/domain/household';
import { onSnapshot, doc, collection, query, where } from 'firebase/firestore';
import { restoreUserRemote, purgeUserDataRemote } from '@/services/firebase/firestore';
import { getFirestoreDb, getFirebaseAuth } from '@/services/firebase/app';
import { useNetworkStatus } from './NetworkProvider';
import { cancelAllNotifications, registerForPushNotificationsAsync } from '@/services/notifications';
import { notifyOwnerMemberLeftHousehold, broadcastMemberJoinedHousehold } from '@/services/householdBroadcastService';

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
  /** Join an existing household by its unique code */
  joinHouseholdByCode: (code: string) => Promise<{ ok: boolean; household?: HouseholdContext; alreadyMember?: boolean; error?: string }>;
  /** Owner deletes the household — removes it from all members and Firestore */
  deleteHousehold: (householdId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Member leaves a household they belong to */
  leaveHousehold: (householdId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Owner removes a specific member from the household */
  removeMemberFromHousehold: (householdId: string, memberCode: string, memberUserId?: string) => Promise<{ ok: boolean; error?: string }>;
  /** Soft-delete the current user account — stamps Firestore, clears local data, signs out */
  deleteAccount: (deletionReason?: string, onSoftDeleted?: () => Promise<void>) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Set when a deleted account is detected on sign-in.
   * Contains {deletedAt, purgeAfter, userId} so the recovery screen can show the right UI.
   * Null when no deleted account is pending.
   */
  deletedAccountInfo: { deletedAt: string; purgeAfter: string | null; userId: string; email?: string } | null;
  /** Restore a previously deleted account — clears the soft-delete stamp */
  restoreAccount: () => Promise<{ ok: boolean; error?: string }>;
  /** Permanently purge data and begin fresh onboarding */
  freshStartAccount: () => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [deletedAccountInfo, setDeletedAccountInfo] = useState<{ deletedAt: string; purgeAfter: string | null; userId: string; email?: string } | null>(null);

  const setDeletedAccountInfoPersisted = useCallback(
    (info: { deletedAt: string; purgeAfter: string | null; userId: string; email?: string } | null) => {
      setDeletedAccountInfo(info);
      if (info) {
        AsyncStorage.setItem('@repeato/deleted_account_info', JSON.stringify(info)).catch(() => {});
      } else {
        AsyncStorage.removeItem('@repeato/deleted_account_info').catch(() => {});
      }
    },
    []
  );

  const [savedLanguage, setSavedLanguage] = useState<Language>('en');
  const [languageSelected, setLanguageSelected] = useState(false);
  const { isOnline } = useNetworkStatus();
  const firebaseReady = isFirebaseConfigured() && initFirebase();

  const isDeletingAccountRef = useRef(false);
  const isAccountActionInProgressRef = useRef(false);
  const unsubscribeProfileRef = useRef<(() => void) | null>(null);
  const unsubscribeHouseholdsRef = useRef<(() => void) | null>(null);

  const language: Language = user?.language ?? savedLanguage;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      let initialAuthSettled = false;
      const settleReady = () => {
        if (!initialAuthSettled && !cancelled) {
          initialAuthSettled = true;
          setReady(true);
        }
      };

      // 0. Load saved deleted account info (if returning to recovery screen)
      try {
        const val = await AsyncStorage.getItem('@repeato/deleted_account_info');
        if (!cancelled && val) {
          setDeletedAccountInfo(JSON.parse(val));
        }
      } catch (err) {
        console.warn('[Repeato] Failed to load saved deleted account info', err);
      }

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
      }

      if (!firebaseReady) {
        settleReady();
        return;
      }

      // Safety timeout: if network or auth hangs on cold start, reveal app after 2.5s
      const authTimeout = setTimeout(settleReady, 2500);

      configureGoogleSignIn();
      const redirectUser = await completeGoogleRedirectSignIn();
      if (cancelled) {
        clearTimeout(authTimeout);
        return;
      }
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
        clearTimeout(authTimeout);
        if (cancelled) return;
        if (isDeletingAccountRef.current || isAccountActionInProgressRef.current) return;

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
            settleReady();
            return;
          }
          // Do NOT wipe the local SQLite database here!
          // userRepository.clear() should only be called on explicit signOut() or deleteAccount().
          localUser = null;
          setUser(null);
          // If there is no authenticated Firebase user, we cannot be in recovery mode.
          // Clear any stale deletedAccountInfo so user can authenticate cleanly.
          setDeletedAccountInfoPersisted(null);
          settleReady();
          return;
        }

        // Ensure cached local profile belongs to the currently signed-in Firebase account
        if (localUser && localUser.id !== firebaseUser.uid) {
          const staleId = localUser.id;
          localUser = null;
          userRepository.clear(staleId).catch(() => {});
        } else if (localUser && localUser.id === firebaseUser.uid) {
          // Local cached user matches! Settle ready immediately so dashboard loads with 0ms delay.
          setUser(localUser);
          settleReady();
        }

        if (!isOnline) {
          if (localUser && localUser.id === firebaseUser.uid) {
            setUser(localUser);
          } else {
            setUser(normalizeHouseholdProfile(profileFromFirebaseUser(firebaseUser, language)));
          }
          settleReady();
          return;
        }

        const db = getFirestoreDb();
        if (db) {
          unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snap) => {
            if (cancelled || isDeletingAccountRef.current || isAccountActionInProgressRef.current) return;

            try {
              const remote = snap.exists() ? (snap.data() as UserProfile) : null;

              // ── Re-entry guard: surface recovery UI if account was soft-deleted ──
              if (remote?.isDeleted === true) {
                if (isDeletingAccountRef.current) return;
                console.warn('[Repeato] Soft-deleted account detected — showing recovery screen.');

                // Clean up listeners immediately to avoid unauthorized listener errors
                if (unsubscribeHouseholds) {
                  unsubscribeHouseholds();
                  unsubscribeHouseholds = null;
                }
                if (unsubscribeProfile) {
                  unsubscribeProfile();
                  unsubscribeProfile = null;
                }
                unsubscribeHouseholdsRef.current = null;
                unsubscribeProfileRef.current = null;

                // Clear cached user so child providers unmount and don't render stale data
                setUser(null);
                userRepository.saveLocal(null).catch(() => {});

                setDeletedAccountInfoPersisted({
                  deletedAt: remote.deletedAt ?? new Date().toISOString(),
                  purgeAfter: remote.purgeAfter ?? null,
                  userId: firebaseUser.uid,
                  email: firebaseUser.email ?? remote.email ?? '',
                });
                settleReady();
                return;
              }

              const matchingLocal = localUser && localUser.id === firebaseUser.uid ? localUser : null;
              const fallback = matchingLocal ?? profileFromFirebaseUser(firebaseUser, language);
              const base = remote
                ? {
                    ...(matchingLocal ?? {}),
                    ...remote,
                    email: remote.email || firebaseUser.email || matchingLocal?.email || '',
                    languageSelected: remote.languageSelected ?? matchingLocal?.languageSelected ?? true,
                  }
                : {
                    ...fallback,
                    languageSelected: fallback.languageSelected ?? languageSelected,
                  };
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

              // Ensure user-owned household contexts exist in remote /households and /householdCodes collections
              if (profile.households && profile.households.length > 0) {
                for (const hh of profile.households) {
                  if (hh.ownerUid === profile.id || !hh.ownerUid) {
                    userRepository.saveHousehold(hh).catch(() => {});
                    if (hh.code) {
                      userRepository.saveHouseholdCode(hh).catch(() => {});
                    }
                  }
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
              settleReady();
            }
          }, (err) => {
            console.warn('[Repeato] Profile snapshot listener failed', err);
            // Handle session expiry / disabled user gracefully (VAL-066)
            if ((err as any)?.code === 'permission-denied') {
              console.warn('[Repeato] Permission denied or session expired. Resetting user session.');
              userRepository.clear(firebaseUser.uid).catch(() => {});
              setUser(null);
              settleReady();
              return;
            }
            if (localUser) {
              setUser(localUser);
            } else {
              setUser(normalizeHouseholdProfile(profileFromFirebaseUser(firebaseUser, language)));
            }
            settleReady();
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

              // Check existing local households: ONLY preserve local households owned by this user (e.g. pending offline sync)
              existingHhs.forEach((localHh) => {
                if (hhMap.has(localHh.id)) return;

                // If not owned by this user, the user left or was removed from this household — discard it!
                if (localHh.ownerUid !== prevUser.id) return;

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
          settleReady();
        }
      });

      return () => {
        clearTimeout(authTimeout);
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
    // Initialize auth subscription once when Firebase is ready; internal listeners handle auth & firestore updates dynamically
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseReady]);

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
        setDeletedAccountInfoPersisted(result.deletedAccountInfo);
        setUser(null);
        return { ok: true, isDeleted: true };
      }
      if (!result.user) {
        return { ok: false, error: 'failed' };
      }
      setDeletedAccountInfoPersisted(null);
      const finalUser: UserProfile = {
        ...result.user,
        termsAcceptedAt: result.user.termsAcceptedAt ?? new Date().toISOString(),
      };
      await persistUser(finalUser);
      return { ok: true, user: finalUser };
    },
    [persistUser, setDeletedAccountInfoPersisted]
  );

  const signInWithEmail = useCallback(
    async (email: string, pass: string): Promise<{ ok: boolean; user?: UserProfile; isDeleted?: boolean; error?: string; message?: string }> => {
      const result = await authSignInWithEmail(email, pass, language);
      if (!result.ok) {
        return { ok: false, error: result.error, message: result.message };
      }
      if (result.isDeleted && result.deletedAccountInfo) {
        setDeletedAccountInfoPersisted(result.deletedAccountInfo);
        setUser(null);
        return { ok: true, isDeleted: true };
      }
      if (!result.user) {
        return { ok: false, error: 'failed', message: result.message };
      }
      setDeletedAccountInfoPersisted(null);
      const finalUser: UserProfile = {
        ...result.user,
        termsAcceptedAt: result.user.termsAcceptedAt ?? new Date().toISOString(),
      };
      await persistUser(finalUser);
      return { ok: true, user: finalUser };
    },
    [language, persistUser, setDeletedAccountInfoPersisted]
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
      setDeletedAccountInfoPersisted(null);
      const finalUser: UserProfile = {
        ...result.user,
        termsAcceptedAt: new Date().toISOString(),
      };
      await persistUser(finalUser);
      return { ok: true, user: finalUser };
    },
    [language, persistUser, setDeletedAccountInfoPersisted]
  );

  const updateUser = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!user) return;
      const allowedPatch: Partial<UserProfile> = {};
      const allowedKeys: (keyof UserProfile)[] = [
        'name',
        'phone',
        'language',
        'languageSelected',
        'pushOptIn',
        'expoPushToken',
        'profileComplete',
        'onboardingComplete',
        'termsAcceptedAt',
        'activeHouseholdId',
        'householdMembers',
        'households',
        'householdCode',
        'lastActiveAt',
        'deviceInfo',
      ];
      for (const key of allowedKeys) {
        if (key in patch) {
          (allowedPatch as any)[key] = patch[key];
        }
      }
      await persistUser({ ...user, ...allowedPatch });
    },
    [user, persistUser]
  );

  // Register and sync Expo push token for remote push notifications
  useEffect(() => {
    if (!user?.id || user.pushOptIn === false) return;

    registerForPushNotificationsAsync()
      .then((token) => {
        if (token && token !== user.expoPushToken) {
          updateUser({ expoPushToken: token }).catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('[Repeato] Failed to sync push token:', err);
      });
  }, [user?.id, user?.pushOptIn, user?.expoPushToken, updateUser]);

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
    setDeletedAccountInfoPersisted(null);
    setUser(null);
    // Guard against undefined userId if both user and deletedAccountInfo are null (edge case)
    if (userId) await userRepository.clear(userId);
    await cancelAllNotifications();
    try {
      await signOutFirebase();
    } catch (err) {
      console.warn('[Repeato] Firebase sign out error:', err);
    }
  }, [user?.id, deletedAccountInfo?.userId, setDeletedAccountInfoPersisted]);

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

    // 2. Delete Firestore /households/{id} and /householdCodes/{code}
    await userRepository.deleteHousehold(householdId, hh.code);

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

  // ── Join Household by Unique Code ─────────────────────────────────────────
  const joinHouseholdByCode = useCallback(async (rawCode: string): Promise<{ ok: boolean; household?: HouseholdContext; alreadyMember?: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'not_signed_in' };
    if (!isOnline) return { ok: false, error: 'offline' };
    const code = normalizeInviteCode(rawCode);
    if (!code) return { ok: false, error: 'invalid_code' };

    const currentHouseholds = user.households ?? [];

    // 1. Check if already belonging to a household with this code
    const existing = currentHouseholds.find(h => normalizeInviteCode(h.code || '') === code);
    if (existing) {
      if (user.activeHouseholdId !== existing.id) {
        await persistUser({ ...user, activeHouseholdId: existing.id });
      }
      return { ok: true, household: existing, alreadyMember: true };
    }

    // 2. Check maximum household limit
    if (currentHouseholds.length >= MAX_HOUSEHOLDS) {
      return { ok: false, error: 'limit_reached' };
    }

    // 3. Resolve the household code from Firestore:
    // 3a. Direct household code lookup
    let hhRecord = await userRepository.resolveHouseholdCode(code);

    // 3b. If not found directly, check if the scanned code is a user's code
    if (!hhRecord) {
      const userCodeMatch = await userRepository.resolveUserCode(code);
      if (userCodeMatch) {
        if ((userCodeMatch as any).activeHouseholdCode) {
          hhRecord = await userRepository.resolveHouseholdCode((userCodeMatch as any).activeHouseholdCode);
        }
        if (!hhRecord && userCodeMatch.userId) {
          hhRecord = await userRepository.findHouseholdCodeByOwner(userCodeMatch.userId);
        }
      }
    }

    // 3c. If still not found, check legacy household invites
    if (!hhRecord) {
      const invite = await userRepository.resolveHouseholdInvite(code);
      if (invite && invite.userId) {
        hhRecord = await userRepository.findHouseholdCodeByOwner(invite.userId);
      }
    }

    if (!hhRecord) {
      return { ok: false, error: 'household_not_found' };
    }

    // 4. Check if already in user's households by ID
    const existingById = currentHouseholds.find(h => h.id === hhRecord.householdId);
    if (existingById) {
      if (user.activeHouseholdId !== existingById.id) {
        await persistUser({ ...user, activeHouseholdId: existingById.id });
      }
      return { ok: true, household: existingById, alreadyMember: true };
    }

    // 5. Construct membership for current user
    const userCode = user.userCode || generateUserCode(user.id || user.email);
    const myMember: HouseholdMemberProfile = {
      code: userCode,
      name: user.name || 'Member',
      color: memberColor(user.id || userCode),
      userId: user.id,
      phone: user.phone,
      addedAt: new Date().toISOString(),
      status: 'active',
    };

    // Load fresh household if possible, or fallback to record
    let remoteHh = await userRepository.loadHousehold(hhRecord.householdId).catch(() => null);
    const baseMembers = remoteHh?.members ?? hhRecord.members ?? [];
    const alreadyMemberInRemote = baseMembers.some(m => m.userId === user.id || normalizeInviteCode(m.code) === normalizeInviteCode(userCode));
    const finalMembers = alreadyMemberInRemote ? baseMembers : [...baseMembers, myMember];
    const finalMemberUids = Array.from(new Set([...(remoteHh?.memberUids ?? hhRecord.memberUids ?? []), user.id]));

    const joinedHh: HouseholdContext = {
      id: hhRecord.householdId,
      name: remoteHh?.name || hhRecord.name,
      icon: remoteHh?.icon || hhRecord.icon || '🏠',
      color: remoteHh?.color || hhRecord.color || '#363E71',
      ownerUid: remoteHh?.ownerUid || hhRecord.ownerUid,
      code: hhRecord.code,
      members: finalMembers,
      memberUids: finalMemberUids,
      createdAt: remoteHh?.createdAt || new Date().toISOString(),
    };

    // 6. Save joined household to Firestore (triggers self-join rule)
    await userRepository.saveHousehold(joinedHh);

    // 7. Update own profile with new household and set active
    const nextHouseholds = [...currentHouseholds, joinedHh];
    await persistUser({
      ...user,
      households: nextHouseholds,
      activeHouseholdId: joinedHh.id,
    });

    // 8. Notify household members
    broadcastMemberJoinedHousehold({
      householdId: joinedHh.id,
      householdName: joinedHh.name,
      newMember: { id: user.id, name: user.name || 'Member', code: userCode },
      actorUser: user,
      allMembers: finalMembers,
    }).catch(() => {});

    return { ok: true, household: joinedHh };
  }, [user, isOnline, persistUser]);

  // ── Member: Leave Household ──────────────────────────────────────────────
  const leaveHousehold = useCallback(async (householdId: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'not_signed_in' };
    const hh = (user.households ?? []).find(h => h.id === householdId);
    if (!hh) return { ok: false, error: 'not_found' };
    if (hh.ownerUid === user.id) {
      return { ok: false, error: 'owner_cannot_leave' };
    }

    // 1. Remove self from /households/{id} in Firestore
    try {
      const remoteHh = await userRepository.loadHousehold(householdId);
      if (remoteHh) {
        const userHouseholdCode = user.householdCode ? normalizeInviteCode(user.householdCode) : undefined;
        const updatedHh: HouseholdContext = {
          ...remoteHh,
          members: remoteHh.members.filter(m => {
            if (m.userId && m.userId === user.id) return false;
            if (userHouseholdCode && normalizeInviteCode(m.code) === userHouseholdCode) return false;
            return true;
          }),
          memberUids: (remoteHh.memberUids ?? []).filter(uid => uid !== user.id),
        };
        await userRepository.saveHousehold(updatedHh);
      }
    } catch (err) {
      console.warn('[Repeato] Failed to update household on leave:', err);
    }

    // 2. Notify owner with in-app notification + remote push notification
    if (hh.ownerUid && hh.ownerUid !== user.id) {
      notifyOwnerMemberLeftHousehold({
        householdId: hh.id,
        householdName: hh.name || 'Home',
        leavingUser: user,
        ownerUid: hh.ownerUid,
      }).catch((err) => {
        console.warn('[Repeato] Failed to notify owner on leave:', err);
      });
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
      if (!isOnline) return { ok: false, error: 'offline' };
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
          const targetCode = normalizeInviteCode(memberCode);
          const memberToRemove = remoteHh.members.find(
            (m) => normalizeInviteCode(m.code) === targetCode || (memberUserId && m.userId === memberUserId)
          );
          const targetUid = memberUserId || memberToRemove?.userId;
          const updatedHh: HouseholdContext = {
            ...remoteHh,
            members: remoteHh.members.filter(
              (m) => normalizeInviteCode(m.code) !== targetCode && (!targetUid || m.userId !== targetUid)
            ),
            memberUids: targetUid
              ? (remoteHh.memberUids ?? []).filter((uid) => uid !== targetUid)
              : (remoteHh.memberUids ?? []),
          };
          await userRepository.saveHousehold(updatedHh);
        }
      } catch (err) {
        console.warn('[Repeato] Failed to update household on member remove:', err);
      }

      // 3. Notify the removed member via in-app notification
      if (memberUserId) {
        try {
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
    [user, persistUser, isOnline]
  );

  // ── Delete Account (Soft Delete) ───────────────────────────────────────────
  const deleteAccount = useCallback(
    async (deletionReason = 'user_requested', onSoftDeleted?: () => Promise<void>): Promise<{ ok: boolean; error?: string }> => {
      if (!user) return { ok: false, error: 'not_signed_in' };
      const userId = user.id;
      // Capture a stable snapshot before any async mutations to avoid stale-closure
      // issues when leaveHousehold's persistUser callback fires after setUser(null)
      const userSnapshot = { ...user };
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

        // 2. Leave all households using the stable snapshot — avoids race with setUser(null)
        // Directly cleans up Firestore without calling persistUser (which depends on live `user`)
        const userHouseholds = userSnapshot.households ?? [];
        await Promise.allSettled(
          userHouseholds.map(async (hh) => {
            try {
              const remoteHh = await userRepository.loadHousehold(hh.id);
              if (remoteHh) {
                const userHouseholdCode = userSnapshot.householdCode
                  ? normalizeInviteCode(userSnapshot.householdCode)
                  : undefined;
                const updatedHh = {
                  ...remoteHh,
                  members: remoteHh.members.filter((m) => {
                    if (m.userId && m.userId === userSnapshot.id) return false;
                    if (userHouseholdCode && normalizeInviteCode(m.code) === userHouseholdCode) return false;
                    return true;
                  }),
                  memberUids: (remoteHh.memberUids ?? []).filter((uid) => uid !== userSnapshot.id),
                };
                await userRepository.saveHousehold(updatedHh);
              }
              // Notify owner that this member left (only if not the owner themselves)
              if (hh.ownerUid && hh.ownerUid !== userSnapshot.id) {
                notifyOwnerMemberLeftHousehold({
                  householdId: hh.id,
                  householdName: hh.name || 'Home',
                  leavingUser: userSnapshot,
                  ownerUid: hh.ownerUid,
                }).catch((err) => {
                  console.warn('[Repeato] deleteAccount: failed to notify owner on leave:', err);
                });
              }
            } catch (err) {
              console.warn('[Repeato] deleteAccount: failed to leave household', hh.id, err);
            }
          })
        );

        // 3. Stamp Firestore with soft-delete marker (does not sign out auth yet)
        const result = await deleteAccountSoft(userId, deletionReason);
        if (!result.ok) {
          // Non-blocking: still proceed with local cleanup even if remote stamp failed
          console.warn('[Repeato] Remote soft-delete stamp failed:', result.error);
        }

        // 4. If a UI hook was provided (e.g. 30-day recovery popup dialog), invoke it while screen is mounted
        if (onSoftDeleted) {
          try {
            await onSoftDeleted();
          } catch (hookErr) {
            console.warn('[Repeato] onSoftDeleted hook error:', hookErr);
          }
        }

        // 5. Clear local data and session BEFORE signing out Firebase Auth
        // Ensures child listeners unmount cleanly while auth credentials are still valid
        setUser(null);
        setDeletedAccountInfoPersisted(null);
        await userRepository.clear(userId).catch(() => {});
        await cancelAllNotifications().catch(() => {});

        // 6. Sign out Firebase Auth now that user acknowledged the recovery popup
        await signOutFirebase().catch(() => {});

        return { ok: true };
      } finally {
        setTimeout(() => {
          isDeletingAccountRef.current = false;
        }, 1500);
      }
    },
    [user, setDeletedAccountInfoPersisted]
  );

  // ── Restore Deleted Account ────────────────────────────────────────────────
  const restoreAccount = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!deletedAccountInfo) return { ok: false, error: 'no_deleted_account' };
    isAccountActionInProgressRef.current = true;
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
      setDeletedAccountInfoPersisted(null);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Repeato] restoreAccount failed:', msg);
      return { ok: false, error: msg };
    } finally {
      setTimeout(() => {
        isAccountActionInProgressRef.current = false;
      }, 1000);
    }
  }, [deletedAccountInfo, setDeletedAccountInfoPersisted]);

  // ── Fresh Start (Permanent Purge) ─────────────────────────────────────────
  const freshStartAccount = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!deletedAccountInfo) return { ok: false, error: 'no_deleted_account' };
    isAccountActionInProgressRef.current = true;
    try {
      const targetUid = deletedAccountInfo.userId;
      const auth = getFirebaseAuth();
      const fbUser = auth?.currentUser;
      const userEmail = fbUser?.email || deletedAccountInfo.email || '';

      // Build a clean fresh user profile: start fresh with language selection
      const baseProfile: UserProfile = fbUser
        ? {
            ...profileFromFirebaseUser(fbUser, savedLanguage),
            email: userEmail,
          }
        : normalizeHouseholdProfile({
            id: targetUid,
            name: '',
            email: userEmail,
            phone: '',
            language: savedLanguage,
            languageSelected: false,
            pushOptIn: true,
            profileComplete: false,
            onboardingComplete: false,
            plan: 'free',
          });

      const freshProfile = normalizeHouseholdProfile({
        ...baseProfile,
        email: userEmail,
        isDeleted: false,
        deletedAt: undefined,
        purgeAfter: undefined,
        deletionReason: undefined,
        languageSelected: false,
        profileComplete: false,
        onboardingComplete: false,
      });

      // Write authoritative clean profile directly to Firestore in one atomic operation
      await purgeUserDataRemote(targetUid, userEmail, freshProfile);

      // Clear local storage and cancel lingering notifications
      await userRepository.clear(targetUid).catch(() => {});
      await cancelAllNotifications().catch(() => {});

      await userRepository.save(freshProfile);
      setUser(freshProfile);
      setDeletedAccountInfoPersisted(null);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Repeato] freshStartAccount failed:', msg);
      return { ok: false, error: msg };
    } finally {
      setTimeout(() => {
        isAccountActionInProgressRef.current = false;
      }, 1000);
    }
  }, [deletedAccountInfo, savedLanguage, setDeletedAccountInfoPersisted]);

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
      joinHouseholdByCode,
      deleteHousehold,
      leaveHousehold,
      removeMemberFromHousehold,
      deleteAccount,
      deletedAccountInfo,
      restoreAccount,
      freshStartAccount,
    }),
    [ready, user, setUser, language, languageSelected, firebaseReady, activeHousehold, signInWithGoogle, signInWithEmail, signUpWithEmail, updateUser, setLanguage, signOut, switchHousehold, createHousehold, joinHouseholdByCode, deleteHousehold, leaveHousehold, removeMemberFromHousehold, deleteAccount, deletedAccountInfo, restoreAccount, freshStartAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
