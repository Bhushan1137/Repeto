import { describe, it, expect } from 'vitest';
import {
  createHouseholdContext,
  listHouseholds,
  getActiveHousehold,
  setActiveHousehold,
  addMemberToHousehold,
  removeMemberFromHousehold,
  normalizeInviteCode,
  householdMemberFromInvite,
  pendingMemberFromCode,
  toSharedMember,
} from '@/domain/household';
import {
  createTaskFromParsed,
  completeTaskInstance,
  undoCompleteTaskInstance,
  claimTaskInstance,
} from '@/domain/task';
import type { UserProfile, RepeatingTask } from '@/types';

describe('E2E Review & Flow Verification: Household System', () => {
  const userAlice: UserProfile = {
    id: 'user-alice-1',
    email: 'alice@example.com',
    name: 'Alice',
    language: 'en',
    pushOptIn: true,
    profileComplete: true,
    onboardingComplete: true,
    plan: 'free',
  };

  const userBob: UserProfile = {
    id: 'user-bob-2',
    email: 'bob@example.com',
    name: 'Bob',
    language: 'en',
    userCode: 'RPT-BOB123',
    pushOptIn: true,
    profileComplete: true,
    onboardingComplete: true,
    plan: 'free',
  };

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 1: Household Creation & Multi-Household Switching
  // ──────────────────────────────────────────────────────────────────────────
  describe('Flow 1: Household Creation & Context Switching', () => {
    it('creates an initial household and sets owner with active member status', () => {
      const homeHh = createHouseholdContext('Home', '🏠', '#0D9488', userAlice);

      expect(homeHh.id).toMatch(/^hh-/);
      expect(homeHh.name).toBe('Home');
      expect(homeHh.icon).toBe('🏠');
      expect(homeHh.color).toBe('#0D9488');
      expect(homeHh.ownerUid).toBe(userAlice.id);
      expect(homeHh.memberUids).toEqual([userAlice.id]);
      expect(homeHh.members).toHaveLength(1);
      expect(homeHh.members[0]).toMatchObject({
        userId: userAlice.id,
        name: 'Alice',
        status: 'active',
      });
    });

    it('supports multiple households and smooth active context switching', () => {
      const homeHh = createHouseholdContext('Home', '🏠', '#0D9488', userAlice);
      const cabinHh = createHouseholdContext('Beach Cabin', '🏖️', '#E8A33D', userAlice);

      let userState: UserProfile = {
        ...userAlice,
        households: [homeHh, cabinHh],
        activeHouseholdId: homeHh.id,
      };

      // 1. Verify listing
      const listed = listHouseholds(userState);
      expect(listed).toHaveLength(2);
      expect(listed.map((h) => h.name)).toEqual(['Home', 'Beach Cabin']);

      // 2. Initial active context
      expect(getActiveHousehold(userState)?.id).toBe(homeHh.id);
      expect(getActiveHousehold(userState)?.name).toBe('Home');

      // 3. Switch to Beach Cabin
      userState = { ...userState, ...setActiveHousehold(userState, cabinHh.id) };
      expect(userState.activeHouseholdId).toBe(cabinHh.id);
      expect(getActiveHousehold(userState)?.name).toBe('Beach Cabin');

      // 4. Switch back to Home
      userState = { ...userState, ...setActiveHousehold(userState, homeHh.id) };
      expect(userState.activeHouseholdId).toBe(homeHh.id);
      expect(getActiveHousehold(userState)?.name).toBe('Home');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 2: Member Addition, Code Resolution & Collision Handling
  // ──────────────────────────────────────────────────────────────────────────
  describe('Flow 2: Member Addition, Code Resolution & Collision Handling', () => {
    it('resolves invite code, normalizes casing/hyphens, and creates active member', () => {
      const rawCode = 'rptbob123';
      const normalized = normalizeInviteCode(rawCode);
      expect(normalized).toBe('RPT-BOB123');

      // Simulate resolve from UserRepository
      const member = householdMemberFromInvite({
        code: normalized,
        userId: userBob.id,
        name: userBob.name,
        color: '#2563EB',
      });

      expect(member.status).toBe('active');
      expect(member.userId).toBe(userBob.id);
      expect(member.name).toBe('Bob');
      expect(member.code).toBe('RPT-BOB123');
    });

    it('adds member to household, updates memberUids for remote listener, and preserves ownership', () => {
      const homeHh = createHouseholdContext('Home', '🏠', '#0D9488', userAlice);
      let userState: UserProfile = {
        ...userAlice,
        households: [homeHh],
        activeHouseholdId: homeHh.id,
      };

      const bobMember = householdMemberFromInvite({
        code: 'RPT-BOB123',
        userId: userBob.id,
        name: userBob.name,
        color: '#2563EB',
      });

      userState = { ...userState, ...addMemberToHousehold(userState, homeHh.id, bobMember) };
      const updatedHh = (userState.households ?? []).find((h) => h.id === homeHh.id);

      expect(updatedHh).toBeDefined();
      expect(updatedHh?.members).toHaveLength(2);
      expect(updatedHh?.memberUids).toContain(userAlice.id);
      expect(updatedHh?.memberUids).toContain(userBob.id);

      // Verify creator remains ownerUid
      expect(updatedHh?.ownerUid).toBe(userAlice.id);
    });

    it('prevents adding the same member twice', () => {
      const homeHh = createHouseholdContext('Home', '🏠', '#0D9488', userAlice);
      let userState: UserProfile = {
        ...userAlice,
        households: [homeHh],
      };

      const bobMember = householdMemberFromInvite({
        code: 'RPT-BOB123',
        userId: userBob.id,
        name: userBob.name,
        color: '#2563EB',
      });

      userState = { ...userState, ...addMemberToHousehold(userState, homeHh.id, bobMember) };
      expect(userState.households?.[0].members).toHaveLength(2);

      // Attempting to re-add Bob
      userState = { ...userState, ...addMemberToHousehold(userState, homeHh.id, bobMember) };
      expect(userState.households?.[0].members).toHaveLength(2);
    });

    it('supports pending member addition when 6-char code is entered before user creates account', () => {
      const pending = pendingMemberFromCode('RPT-NEWUSR');
      expect(pending.status).toBe('pending');
      expect(pending.code).toBe('RPT-NEWUSR');

      const homeHh = createHouseholdContext('Home', '🏠', '#0D9488', userAlice);
      const userState: UserProfile = { ...userAlice, households: [homeHh] };
      const patch = addMemberToHousehold(userState, homeHh.id, pending);
      expect(patch.households?.[0].members).toHaveLength(2);
      expect(patch.households?.[0].members[0].status).toBe('pending');
    });

    it('removes member cleanly and cleans up memberUids', () => {
      const homeHh = createHouseholdContext('Home', '🏠', '#0D9488', userAlice);
      const bobMember = householdMemberFromInvite({
        code: 'RPT-BOB123',
        userId: userBob.id,
        name: userBob.name,
        color: '#2563EB',
      });

      let userState: UserProfile = {
        ...userAlice,
        households: [homeHh],
      };
      userState = { ...userState, ...addMemberToHousehold(userState, homeHh.id, bobMember) };
      expect(userState.households?.[0].members).toHaveLength(2);

      const removalPatch = removeMemberFromHousehold(userState, homeHh.id, 'RPT-BOB123');
      userState = { ...userState, ...removalPatch };

      expect(userState.households?.[0].members).toHaveLength(1);
      expect(userState.households?.[0].memberUids).toEqual([userAlice.id]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 3: Household Chores Creation, Assignment & Round-Robin Rotation
  // ──────────────────────────────────────────────────────────────────────────
  describe('Flow 3: Household Chore Creation, Assignment & Rotation', () => {
    it('creates household chore with explicit householdId and shared members', () => {
      const bobMember = householdMemberFromInvite({
        code: 'RPT-BOB123',
        userId: userBob.id,
        name: userBob.name,
        color: '#2563EB',
      });
      const sharedBob = toSharedMember(bobMember);

      const chore = createTaskFromParsed(
        {
          title: 'Buy Groceries',
          category: 'home',
          frequencyLabel: 'Weekly',
          recurrence: { type: 'weekly' },
          assignedTo: userBob.id,
          isRotating: true,
          rotationMembers: [userAlice.id, userBob.id],
        },
        {
          finance: false,
          shared: [sharedBob],
          householdId: 'hh_main',
        },
        userAlice.name
      );

      expect(chore.householdId).toBe('hh_main');
      expect(chore.title).toBe('Buy Groceries');
      expect(chore.assignedTo).toBe(userBob.id);
      expect(chore.isRotating).toBe(true);
      expect(chore.rotationMembers).toEqual([userAlice.id, userBob.id]);
      expect(chore.sharedWith).toHaveLength(1);
      expect(chore.sharedWith[0].userId).toBe(userBob.id);
    });

    it('executes round-robin turn rotation upon chore completion', () => {
      const chore: RepeatingTask = {
        id: 'chore-trash',
        householdId: 'hh_main',
        title: 'Take Out Trash',
        category: 'home',
        frequencyLabel: 'Daily',
        recurrence: { type: 'daily' },
        nextDueDate: '2026-09-12T10:00:00.000Z',
        finance: false,
        sharedWith: [],
        assignedTo: userAlice.id,
        isRotating: true,
        rotationMembers: [userAlice.id, userBob.id],
        history: [],
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        escalationCount: 0,
      };

      // Alice completes chore -> advances turn to Bob
      const afterAlice = completeTaskInstance(chore, 'Emptied kitchen bin', userAlice.name);
      expect(afterAlice.assignedTo).toBe(userBob.id);
      expect(afterAlice.history).toHaveLength(1);
      expect(afterAlice.history[0].previousAssignee).toBe(userAlice.id);
      expect(afterAlice.history[0].rotatedTo).toBe(userBob.id);

      // Bob completes chore -> loops turn back to Alice
      const afterBob = completeTaskInstance(afterAlice, 'Emptied recycling', userBob.name);
      expect(afterBob.assignedTo).toBe(userAlice.id);
      expect(afterBob.history).toHaveLength(2);
      expect(afterBob.history[1].previousAssignee).toBe(userBob.id);
      expect(afterBob.history[1].rotatedTo).toBe(userAlice.id);
    });

    it('rolls back rotation turn when completion is undone', () => {
      const chore: RepeatingTask = {
        id: 'chore-plants',
        householdId: 'hh_main',
        title: 'Water Plants',
        category: 'home',
        frequencyLabel: 'Weekly',
        recurrence: { type: 'weekly' },
        nextDueDate: '2026-09-12T10:00:00.000Z',
        finance: false,
        sharedWith: [],
        assignedTo: userAlice.id,
        isRotating: true,
        rotationMembers: [userAlice.id, userBob.id],
        history: [],
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        escalationCount: 0,
      };

      const afterAlice = completeTaskInstance(chore, undefined, userAlice.name);
      expect(afterAlice.assignedTo).toBe(userBob.id);

      // Undo completion restores Alice as current assignee
      const rolledBack = undoCompleteTaskInstance(afterAlice);
      expect(rolledBack.assignedTo).toBe(userAlice.id);
      expect(rolledBack.history).toHaveLength(0);
    });

    it('allows claiming open / unassigned household chores', () => {
      const openChore: RepeatingTask = {
        id: 'chore-dishes',
        householdId: 'hh_main',
        title: 'Clean Oven',
        category: 'home',
        frequencyLabel: 'Monthly',
        recurrence: { type: 'monthly' },
        nextDueDate: '2026-09-15T10:00:00.000Z',
        finance: false,
        sharedWith: [],
        assignedTo: undefined,
        isRotating: false,
        history: [],
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        escalationCount: 0,
      };

      const claimed = claimTaskInstance(openChore, userBob.id);
      expect(claimed.assignedTo).toBe(userBob.id);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 4: Personal Task Creation & Strict Isolation
  // ──────────────────────────────────────────────────────────────────────────
  describe('Flow 4: Personal Task Creation & Isolation from Household', () => {
    it('creates normal personal task with null householdId', () => {
      const personalTask = createTaskFromParsed(
        {
          title: 'Take Blood Pressure Medication',
          category: 'health',
          frequencyLabel: 'Daily',
          recurrence: { type: 'daily' },
        },
        {
          finance: false,
          shared: [],
          householdId: null,
        },
        userAlice.name
      );

      expect(personalTask.householdId).toBeNull();
      expect(personalTask.sharedWith).toHaveLength(0);
      expect(personalTask.assignedTo).toBeUndefined();
    });

    it('strictly isolates personal tasks from household task lists', () => {
      const personalMed = createTaskFromParsed(
        {
          title: 'Thyroid Medication',
          category: 'health',
          frequencyLabel: 'Daily',
          recurrence: { type: 'daily' },
        },
        { finance: false, shared: [], householdId: null }
      );

      const personalCreditCard = createTaskFromParsed(
        {
          title: 'Pay HDFC Credit Card',
          category: 'bills',
          frequencyLabel: 'Monthly',
          recurrence: { type: 'monthly' },
          amount: 15000,
        },
        { finance: true, shared: [], householdId: null }
      );

      const householdChore = createTaskFromParsed(
        {
          title: 'Pay WiFi Bill',
          category: 'bills',
          frequencyLabel: 'Monthly',
          recurrence: { type: 'monthly' },
          amount: 999,
        },
        { finance: true, shared: [], householdId: 'hh_apt101' }
      );

      const otherHouseholdChore = createTaskFromParsed(
        {
          title: 'Mow Beach House Lawn',
          category: 'home',
          frequencyLabel: 'Weekly',
          recurrence: { type: 'weekly' },
        },
        { finance: false, shared: [], householdId: 'hh_beach' }
      );

      const allTasks = [personalMed, personalCreditCard, householdChore, otherHouseholdChore];

      // 1. Household Apt 101 scoping
      const apt101Tasks = allTasks.filter((t) => t.householdId === 'hh_apt101');
      expect(apt101Tasks).toHaveLength(1);
      expect(apt101Tasks[0].title).toBe('Pay WiFi Bill');
      // Personal tasks MUST NOT leak into Apt 101
      expect(apt101Tasks.some((t) => t.title.includes('Medication'))).toBe(false);
      expect(apt101Tasks.some((t) => t.title.includes('Credit Card'))).toBe(false);

      // 2. Household Beach House scoping
      const beachTasks = allTasks.filter((t) => t.householdId === 'hh_beach');
      expect(beachTasks).toHaveLength(1);
      expect(beachTasks[0].title).toBe('Mow Beach House Lawn');
      expect(beachTasks.some((t) => t.householdId !== 'hh_beach')).toBe(false);

      // 3. Home Screen "Personal Only" filter
      const personalOnlyTasks = allTasks.filter((t) => !t.householdId);
      expect(personalOnlyTasks).toHaveLength(2);
      expect(personalOnlyTasks.map((t) => t.title)).toEqual([
        'Thyroid Medication',
        'Pay HDFC Credit Card',
      ]);
    });
  });
});
