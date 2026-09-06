import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userRepository } from '@/data/repositories/userRepository';
import * as localSource from '@/data/sources/localSource';
import * as firebaseConfig from '@/services/firebase/config';
import type { UserProfile } from '@/types';

vi.mock('@/data/sources/localSource');
vi.mock('@/services/firebase/config');
vi.mock('@/services/firebase/app');
vi.mock('@/services/firebase/auth');
vi.mock('@/services/firebase/firestore');

describe('data/repositories/userRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(firebaseConfig, 'isFirebaseConfigured').mockReturnValue(false);
  });

  const dummyUser: UserProfile = {
    id: 'u1',
    name: 'Malay',
    email: 'test@example.com',
    language: 'en',
    pushOptIn: true,
    profileComplete: true,
    onboardingComplete: true,
    plan: 'free',
  };

  it('load normalizes user profile from local source', async () => {
    vi.spyOn(localSource, 'loadUser').mockResolvedValue(dummyUser);
    const user = await userRepository.load();
    expect(user?.id).toBe('u1');
    expect(user?.householdMembers).toBeDefined();
  });

  it('saveLocal delegates to saveUser', async () => {
    await userRepository.saveLocal(dummyUser);
    expect(localSource.saveUser).toHaveBeenCalled();
  });

  it('clear delegates to clearUserData', async () => {
    await userRepository.clear('u1');
    expect(localSource.clearUserData).toHaveBeenCalledWith('u1');
  });

  it('listenNotifications returns noop cleanup when remote disabled', () => {
    const unsub = userRepository.listenNotifications('u1', () => {});
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });
});
