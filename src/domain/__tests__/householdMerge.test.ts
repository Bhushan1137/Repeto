import { describe, it, expect } from 'vitest';
import {
  detectHouseholdCollision,
  mergeHouseholds,
  getHouseholdDisplayName,
  createHouseholdContext,
} from '@/domain/household';
import type { RepeatingTask, UserProfile } from '@/types';

describe('Household Collision & Merge Engine', () => {
  const baseUser: UserProfile = {
    id: 'user-1',
    name: 'User One',
    email: 'user1@example.com',
    userCode: 'RPT-USR001',
    householdCode: 'RPT-USR001',
    households: [],
    profileComplete: true,
    language: 'en',
    pushOptIn: false,
    onboardingComplete: true,
    plan: 'free',
  };

  const starterHh = createHouseholdContext('Home', '🏠', '#3E7C6A', baseUser);
  starterHh.id = 'hh-starter';

  const userWithStarter: UserProfile = {
    ...baseUser,
    households: [starterHh],
    activeHouseholdId: 'hh-starter',
  };

  it('detects collision with empty starter household when joining new household with same name', () => {
    const remoteHh = createHouseholdContext('Home', '🏠', '#C1502E', {
      ...baseUser,
      id: 'user-2',
      userCode: 'RPT-USR002',
    });
    remoteHh.id = 'hh-remote';

    const collision = detectHouseholdCollision(userWithStarter, remoteHh, []);
    expect(collision.hasCollision).toBe(true);
    expect(collision.isStarterEmpty).toBe(true);
    expect(collision.collidingHousehold?.id).toBe('hh-starter');
  });

  it('detects collision with non-empty household (user has tasks in it)', () => {
    const remoteHh = createHouseholdContext('Home', '🏠', '#C1502E', {
      ...baseUser,
      id: 'user-2',
      userCode: 'RPT-USR002',
    });
    remoteHh.id = 'hh-remote';

    const tasks: RepeatingTask[] = [
      {
        id: 'task-1',
        title: 'Electricity Bill',
        category: 'bills',
        frequencyLabel: 'Monthly',
        finance: true,
        escalationCount: 0,
        recurrence: { type: 'monthly', dayOfMonth: 5 },
        startDate: '2026-09-01',
        nextDueDate: '2026-10-05',
        householdId: 'hh-starter',
        history: [],
        sharedWith: [],
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ];

    const collision = detectHouseholdCollision(userWithStarter, remoteHh, tasks);
    expect(collision.hasCollision).toBe(true);
    expect(collision.isStarterEmpty).toBe(false);
  });

  it('merges source household tasks into target household and removes source', () => {
    const remoteHh = createHouseholdContext('Home', '🏠', '#C1502E', {
      ...baseUser,
      id: 'user-2',
      name: 'User Two',
      userCode: 'RPT-USR002',
    });
    remoteHh.id = 'hh-remote';

    const userWithBoth: UserProfile = {
      ...baseUser,
      households: [starterHh, remoteHh],
      activeHouseholdId: 'hh-starter',
    };

    const tasks: RepeatingTask[] = [
      {
        id: 'task-1',
        title: 'Electricity Bill',
        category: 'bills',
        frequencyLabel: 'Monthly',
        finance: true,
        escalationCount: 0,
        recurrence: { type: 'monthly', dayOfMonth: 5 },
        startDate: '2026-09-01',
        nextDueDate: '2026-10-05',
        householdId: 'hh-starter',
        history: [],
        sharedWith: [],
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ];

    const { updatedUser, updatedTasks } = mergeHouseholds(
      userWithBoth,
      'hh-starter',
      'hh-remote',
      tasks
    );

    expect(updatedUser.households).toHaveLength(1);
    expect(updatedUser.households![0].id).toBe('hh-remote');
    expect(updatedUser.activeHouseholdId).toBe('hh-remote');

    expect(updatedTasks[0].householdId).toBe('hh-remote');
  });

  it('disambiguates household display names when duplicate names exist', () => {
    const hhA = { ...starterHh, id: 'hh-a', name: 'Home', ownerUid: 'user-1' };
    const hhB = {
      ...starterHh,
      id: 'hh-b',
      name: 'Home',
      ownerUid: 'user-2',
      members: [{ code: 'RPT-USR002', name: 'Rahul Sharma', color: '#123', addedAt: '', status: 'active' as const, userId: 'user-2' }],
    };

    const all = [hhA, hhB];
    expect(getHouseholdDisplayName(hhA, 'user-1', all)).toBe('Home (You)');
    expect(getHouseholdDisplayName(hhB, 'user-1', all)).toBe('Home (Rahul)');
  });
});
