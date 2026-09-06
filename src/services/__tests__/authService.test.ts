import { beforeEach, describe, expect, it, vi } from 'vitest';
import { profileFromFirebaseUser, signInWithEmail, signInWithGoogle } from '@/services/authService';
import * as firebaseConfig from '@/services/firebase/config';
import type { User } from 'firebase/auth';

vi.mock('@/services/firebase/config');
vi.mock('@/services/firebase/auth');
vi.mock('@/services/firebase/firestore');

describe('services/authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dummyFbUser = {
    uid: 'fb123',
    displayName: 'Malay Mahajan',
    email: 'malay@example.com',
    phoneNumber: '+919876543210',
    photoURL: 'https://example.com/photo.jpg',
  } as User;

  it('profileFromFirebaseUser maps firebase user attributes to UserProfile', () => {
    const profile = profileFromFirebaseUser(dummyFbUser, 'en');
    expect(profile.id).toBe('fb123');
    expect(profile.name).toBe('Malay Mahajan');
    expect(profile.email).toBe('malay@example.com');
    expect(profile.language).toBe('en');
  });

  it('signInWithGoogle returns auth_unavailable if firebase is not configured', async () => {
    vi.spyOn(firebaseConfig, 'isFirebaseConfigured').mockReturnValue(false);
    const result = await signInWithGoogle('en');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('auth_unavailable');
  });

  it('signInWithEmail returns failed result if auth errors out', async () => {
    const result = await signInWithEmail('test@example.com', 'wrongpass', 'en');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('failed');
  });
});
