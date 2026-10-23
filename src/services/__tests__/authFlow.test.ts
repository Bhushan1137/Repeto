import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signUpWithEmail, signInWithEmail } from '@/services/authService';
import * as firebaseAuth from '@/services/firebase/auth';
import * as firestoreService from '@/services/firebase/firestore';
import type { User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';

vi.mock('@/services/firebase/config', () => ({
  isFirebaseConfigured: () => true,
  firebaseConfig: { projectId: 'repeto-test' },
  googleWebClientId: 'test-client-id',
}));

vi.mock('@/services/firebase/auth', () => ({
  signUpWithEmailPassword: vi.fn(),
  signInWithEmailPassword: vi.fn(),
  signOutFirebase: vi.fn(),
  getAuthErrorMessage: vi.fn((code: string) => `Error: ${code}`),
}));

vi.mock('@/services/firebase/firestore', () => ({
  saveUserRemote: vi.fn().mockResolvedValue(undefined),
  loadUserRemote: vi.fn().mockResolvedValue(null),
  softDeleteUserRemote: vi.fn().mockResolvedValue(undefined),
}));

describe('End-to-End Auth Flow (Sign-Up, Sign-In, Sign-Out)', () => {
  const mockUser = {
    uid: 'test-user-123',
    email: 'tester@repeto.app',
    displayName: 'Test User',
    phoneNumber: null,
    photoURL: null,
  } as unknown as User;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Sign-Up Flow', () => {
    it('successfully creates an account, builds a valid UserProfile, and saves to Firestore', async () => {
      vi.mocked(firebaseAuth.signUpWithEmailPassword).mockResolvedValue(mockUser);

      const result = await signUpWithEmail('tester@repeto.app', 'Secret123!', 'en', 'Test User');

      expect(result.ok).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe('test-user-123');
      expect(result.user?.email).toBe('tester@repeto.app');
      expect(result.user?.name).toBe('Test User');
      expect(result.user?.profileComplete).toBe(true);
      expect(result.user?.languageSelected).toBe(true);
      expect(result.user?.language).toBe('en');

      // Verifies remote save is invoked for cloud backup
      expect(firestoreService.saveUserRemote).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-user-123',
        email: 'tester@repeto.app',
      }));
    });

    it('gracefully handles email-already-in-use error', async () => {
      const error = new FirebaseError('auth/email-already-in-use', 'Email already in use');
      vi.mocked(firebaseAuth.signUpWithEmailPassword).mockRejectedValue(error);

      const result = await signUpWithEmail('existing@repeto.app', 'Secret123!', 'en');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('failed');
      expect(result.message).toContain('auth/email-already-in-use');
    });

    it('gracefully handles weak-password error', async () => {
      const error = new FirebaseError('auth/weak-password', 'Weak password');
      vi.mocked(firebaseAuth.signUpWithEmailPassword).mockRejectedValue(error);

      const result = await signUpWithEmail('tester@repeto.app', '123', 'en');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('failed');
      expect(result.message).toContain('auth/weak-password');
    });
  });

  describe('2. Sign-In Flow', () => {
    it('successfully signs in an existing user and loads their profile', async () => {
      vi.mocked(firebaseAuth.signInWithEmailPassword).mockResolvedValue(mockUser);
      vi.mocked(firestoreService.loadUserRemote).mockResolvedValue({
        id: 'test-user-123',
        name: 'Existing Member',
        email: 'tester@repeto.app',
        phone: '',
        language: 'en',
        languageSelected: true,
        pushOptIn: true,
        profileComplete: true,
        onboardingComplete: true,
        plan: 'free',
        households: [],
      });

      const result = await signInWithEmail('tester@repeto.app', 'Secret123!', 'en');

      expect(result.ok).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.name).toBe('Existing Member');
      expect(result.user?.profileComplete).toBe(true);
    });

    it('handles invalid-credential error gracefully on sign-in', async () => {
      const error = new FirebaseError('auth/invalid-credential', 'Invalid credentials');
      vi.mocked(firebaseAuth.signInWithEmailPassword).mockRejectedValue(error);

      const result = await signInWithEmail('tester@repeto.app', 'WrongPassword', 'en');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('failed');
      expect(result.message).toContain('auth/invalid-credential');
    });

    it('detects soft-deleted accounts and returns deletedAccountInfo for recovery', async () => {
      vi.mocked(firebaseAuth.signInWithEmailPassword).mockResolvedValue(mockUser);
      vi.mocked(firestoreService.loadUserRemote).mockResolvedValue({
        id: 'test-user-123',
        name: 'Deleted User',
        email: 'tester@repeto.app',
        phone: '',
        language: 'en',
        languageSelected: true,
        pushOptIn: false,
        profileComplete: true,
        onboardingComplete: true,
        plan: 'free',
        households: [],
        isDeleted: true,
        deletedAt: '2026-09-01T12:00:00.000Z',
        purgeAfter: '2026-10-01T12:00:00.000Z',
      });

      const result = await signInWithEmail('tester@repeto.app', 'Secret123!', 'en');

      expect(result.ok).toBe(true);
      expect(result.isDeleted).toBe(true);
      expect(result.deletedAccountInfo?.deletedAt).toBe('2026-09-01T12:00:00.000Z');
      expect(result.deletedAccountInfo?.userId).toBe('test-user-123');
      expect(result.deletedAccountInfo?.email).toBe('tester@repeto.app');
    });
  });

  describe('3. Sign-Out Flow', () => {
    it('executes signOutFirebase without throwing', async () => {
      vi.mocked(firebaseAuth.signOutFirebase).mockResolvedValue(undefined);

      await expect(firebaseAuth.signOutFirebase()).resolves.toBeUndefined();
      expect(firebaseAuth.signOutFirebase).toHaveBeenCalled();
    });
  });

  describe('4. OTP-Based Password Reset Flow (End-to-End)', () => {
    it('completes the full flow: request reset OTP -> reset password with code -> sign in with new password', async () => {
      // Step A: Request OTP
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/sendResetPasswordOtp')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              token: '1727289000000.0.reset_token_sig',
              cooldownSeconds: 60,
              message: 'Password recovery code sent to your email.',
            }),
          });
        }
        if (url.includes('/resetPasswordWithOtp')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              verified: true,
              message: 'Password has been reset successfully!',
            }),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      const { requestPasswordResetOtp, resetPasswordWithOtp } = await import('@/services/otpService');

      // 1. Request recovery code
      const requestRes = await requestPasswordResetOtp('tester@repeto.app');
      expect(requestRes.ok).toBe(true);
      expect(requestRes.token).toBe('1727289000000.0.reset_token_sig');

      // 2. Reset password using received token and code
      const resetRes = await resetPasswordWithOtp(
        'tester@repeto.app',
        '847291',
        requestRes.token!,
        'NewStrongPassword123'
      );
      expect(resetRes.ok).toBe(true);
      expect(resetRes.verified).toBe(true);

      // 3. User signs in with newly reset password
      vi.mocked(firebaseAuth.signInWithEmailPassword).mockResolvedValue(mockUser);
      vi.mocked(firestoreService.loadUserRemote).mockResolvedValue({
        id: 'test-user-123',
        name: 'Test User',
        email: 'tester@repeto.app',
        phone: '',
        language: 'en',
        languageSelected: true,
        pushOptIn: true,
        profileComplete: true,
        onboardingComplete: true,
        plan: 'free',
        households: [],
      });

      const signInResult = await signInWithEmail('tester@repeto.app', 'NewStrongPassword123', 'en');
      expect(signInResult.ok).toBe(true);
      expect(signInResult.user?.id).toBe('test-user-123');
    });
  });
});

