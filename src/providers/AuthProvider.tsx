import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Language, UserProfile } from '@/types';
import { userRepository } from '@/data/repositories/userRepository';
import { signInWithGoogle as authSignIn, profileFromFirebaseUser } from '@/services/authService';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { initFirebase } from '@/services/firebase/app';
import { subscribeToAuth, configureGoogleSignIn, completeGoogleRedirectSignIn } from '@/services/firebase/auth';
import { profileFromSignedInUser } from '@/services/authService';
import { loadUserRemote } from '@/services/firebase/firestore';
import { normalizeHouseholdProfile } from '@/domain/household';

interface AuthContextValue {
  ready: boolean;
  user: UserProfile | null;
  language: Language;
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
  const firebaseReady = isFirebaseConfigured() && initFirebase();

  const language: Language = user?.language ?? 'en';

  useEffect(() => {
    if (!firebaseReady) {
      userRepository.load().then((loaded) => {
        setUser(loaded);
        setReady(true);
      });
      return;
    }

    configureGoogleSignIn();
    let cancelled = false;

    (async () => {
      const redirectUser = await completeGoogleRedirectSignIn();
      if (cancelled) return;
      if (redirectUser) {
        try {
          const profile = await profileFromSignedInUser(redirectUser, 'en');
          setUser(profile);
          await userRepository.save(profile);
        } catch {
          // onAuthStateChanged will handle
        }
      }
    })();

    const unsubscribe = subscribeToAuth(async (firebaseUser) => {
      if (cancelled) return;

      if (!firebaseUser) {
        setUser(null);
        setReady(true);
        return;
      }

      try {
        const remote = await loadUserRemote(firebaseUser.uid);
        const base = remote ?? profileFromFirebaseUser(firebaseUser, 'en');
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
      } catch {
        setUser(normalizeHouseholdProfile(profileFromFirebaseUser(firebaseUser, 'en')));
      } finally {
        if (!cancelled) setReady(true);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
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
      if (user) await persistUser({ ...user, language: lang });
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
      firebaseReady,
      signInWithGoogle,
      updateUser,
      setLanguage,
      signOut,
    }),
    [ready, user, language, firebaseReady, signInWithGoogle, updateUser, setLanguage, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
