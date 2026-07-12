import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language, UserProfile } from '@/types';
import { userRepository } from '@/data/repositories/userRepository';
import { signInWithGoogle as authSignIn, profileFromFirebaseUser } from '@/services/authService';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { initFirebase } from '@/services/firebase/app';
import { subscribeToAuth, configureGoogleSignIn, completeGoogleRedirectSignIn } from '@/services/firebase/auth';
import { profileFromSignedInUser } from '@/services/authService';
import { loadUserRemote } from '@/services/firebase/firestore';
import { normalizeHouseholdProfile } from '@/domain/household';
import { onSnapshot, doc } from 'firebase/firestore';
import { getFirestoreDb } from '@/services/firebase/app';

interface AuthContextValue {
  ready: boolean;
  user: UserProfile | null;
  language: Language;
  languageSelected: boolean;
  firebaseReady: boolean;
  signInWithGoogle: (language: Language) => Promise<{ ok: boolean; user?: UserProfile; error?: string; message?: string }>;
  updateUser: (patch: Partial<UserProfile>) => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
  signOut: () => Promise<void>;
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

      const unsubscribeAuth = subscribeToAuth((firebaseUser) => {
        if (cancelled) return;

        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
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
              let profile: UserProfile = normalizeHouseholdProfile({
                ...base,
                profileComplete: base.profileComplete ?? base.name.trim().length >= 2,
              });

              // Scan pending members and resolve them
              let changed = false;
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
        } else {
          setUser(normalizeHouseholdProfile(profileFromFirebaseUser(firebaseUser, language)));
          setReady(true);
        }
      });

      return () => {
        if (unsubscribeAuth) unsubscribeAuth();
        if (unsubscribeProfile) unsubscribeProfile();
      };
    }

    let unsubPromise = init();

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
      await persistUser(result.user);
      return { ok: true, user: result.user };
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

  const value = useMemo(
    () => ({
      ready,
      user,
      language,
      languageSelected,
      firebaseReady,
      signInWithGoogle,
      updateUser,
      setLanguage,
      signOut,
    }),
    [ready, user, language, languageSelected, firebaseReady, signInWithGoogle, updateUser, setLanguage, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
