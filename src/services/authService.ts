import type { Language, UserProfile } from '@/types';
import type { User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { signInWithGoogleNative, getAuthErrorMessage } from '@/services/firebase/auth';
import { loadUserRemote, softDeleteUserRemote } from '@/services/firebase/firestore';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { normalizeHouseholdProfile } from '@/domain/household';

export interface SignInResult {
  ok: boolean;
  user?: UserProfile;
  isDeleted?: boolean;
  deletedAccountInfo?: { deletedAt: string; purgeAfter: string | null; userId: string; email?: string };
  error?: 'auth_unavailable' | 'cancelled' | 'failed' | 'redirect_pending';
  message?: string;
}

export function profileFromFirebaseUser(fbUser: User, language: Language): UserProfile {
  return normalizeHouseholdProfile({
    id: fbUser.uid,
    name: fbUser.displayName?.trim() ?? '',
    email: (fbUser.email ?? '').trim().toLowerCase(),
    phone: fbUser.phoneNumber ?? '',
    photoUrl: fbUser.photoURL ?? undefined,
    language,
    languageSelected: false,
    pushOptIn: true,
    profileComplete: false,
    onboardingComplete: false,
    plan: 'free',
  });
}

async function buildProfile(fbUser: User, language: Language): Promise<UserProfile> {
  const remote = await loadUserRemote(fbUser.uid);
  const base = profileFromFirebaseUser(fbUser, language);

  if (remote) {
    return normalizeHouseholdProfile({
      ...remote,
      email: remote.email || base.email,
      photoUrl: remote.photoUrl || base.photoUrl,
      language: remote.language || language,
      languageSelected: remote.languageSelected ?? true,
      profileComplete: remote.profileComplete ?? ((remote.name || '').trim().length >= 2),
    });
  }

  return normalizeHouseholdProfile(base);
}

export async function signInWithGoogle(language: Language): Promise<SignInResult> {
  if (!isFirebaseConfigured()) {
    return { ok: false, error: 'auth_unavailable', message: 'Firebase is not configured.' };
  }

  try {
    const fbUser = await signInWithGoogleNative();
    const remote = await loadUserRemote(fbUser.uid);
    if (remote?.isDeleted === true) {
      return {
        ok: true,
        isDeleted: true,
        deletedAccountInfo: {
          deletedAt: remote.deletedAt ?? new Date().toISOString(),
          purgeAfter: remote.purgeAfter ?? null,
          userId: fbUser.uid,
          email: fbUser.email ?? remote.email ?? '',
        },
      };
    }
    const user = await buildProfile(fbUser, language);
    return { ok: true, user };
  } catch (err: unknown) {
    const code =
      err instanceof Error && 'code' in err
        ? String((err as { code: string }).code)
        : err instanceof FirebaseError
          ? err.code
          : '';

    if (code === 'cancelled' || code.includes('SIGN_IN_CANCELLED')) {
      return { ok: false, error: 'cancelled' };
    }
    if (code === 'redirect_pending') {
      return { ok: false, error: 'redirect_pending', message: 'Redirecting to Google…' };
    }

    const message =
      err instanceof FirebaseError
        ? getAuthErrorMessage(err.code)
        : 'Sign-in failed. Please check your connection and try again.';

    return { ok: false, error: 'failed', message };
  }
}

export async function profileFromSignedInUser(fbUser: User, language: Language): Promise<UserProfile> {
  return buildProfile(fbUser, language);
}

export async function signInWithEmail(
  email: string,
  pass: string,
  language: Language
): Promise<SignInResult> {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const { signInWithEmailPassword } = await import('@/services/firebase/auth');
    const fbUser = await signInWithEmailPassword(normalizedEmail, pass);
    const remote = await loadUserRemote(fbUser.uid);
    if (remote?.isDeleted === true) {
      return {
        ok: true,
        isDeleted: true,
        deletedAccountInfo: {
          deletedAt: remote.deletedAt ?? new Date().toISOString(),
          purgeAfter: remote.purgeAfter ?? null,
          userId: fbUser.uid,
          email: fbUser.email ?? remote.email ?? normalizedEmail,
        },
      };
    }
    const user = await buildProfile(fbUser, language);
    return { ok: true, user };
  } catch (err: unknown) {
    const message =
      err instanceof FirebaseError
        ? getAuthErrorMessage(err.code)
        : 'Sign-in failed. Please check your connection and try again.';
    return { ok: false, error: 'failed', message };
  }
}

export async function signUpWithEmail(
  email: string,
  pass: string,
  language: Language,
  name?: string
): Promise<SignInResult> {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const { signUpWithEmailPassword } = await import('@/services/firebase/auth');
    const { saveUserRemote } = await import('@/services/firebase/firestore');
    const fbUser = await signUpWithEmailPassword(normalizedEmail, pass);
    const base = profileFromFirebaseUser(fbUser, language);
    const user: UserProfile = {
      ...base,
      name: name?.trim() || base.name || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      profileComplete: Boolean(name && name.trim().length >= 2),
    };
    try {
      await saveUserRemote(user);
    } catch {
      // Non-blocking if remote save fails temporarily
    }
    return { ok: true, user };
  } catch (err: unknown) {
    const message =
      err instanceof FirebaseError
        ? getAuthErrorMessage(err.code)
        : 'Sign-up failed. Please check your connection and try again.';
    return { ok: false, error: 'failed', message };
  }
}

/**
 * Soft-delete a user account.
 * Stamps the Firestore user document as deleted, then signs out.
 * The Firebase Auth account is NOT deleted — admins can recover it.
 */
export async function deleteAccountSoft(
  userId: string,
  deletionReason = 'user_requested'
): Promise<{ ok: boolean; error?: string }> {
  if (!isFirebaseConfigured()) {
    // Offline / no Firebase — just return ok so local cleanup can proceed
    return { ok: true };
  }
  try {
    await softDeleteUserRemote(userId, deletionReason);
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[Repeato] Soft-delete account failed:', message);
    return { ok: false, error: message };
  }
}
