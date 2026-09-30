import { describe, expect, it } from 'vitest';
import {
  generateUserCode,
  generateHouseholdCode,
  memberColor,
  normalizeHouseholdProfile,
  inviteProfileFromUser,
  householdMemberFromInvite,
  pendingMemberFromCode,
  normalizeInviteCode,
  isValidInviteCode,
  addHouseholdMember,
  removeHouseholdMember,
  toSharedMember,
  inviteMessage,
  createHouseholdContext,
  migrateLegacyHousehold,
  getActiveHousehold,
  listHouseholds,
  setActiveHousehold,
  addMemberToHousehold,
  removeMemberFromHousehold,
} from '@/domain/household';
import type { UserProfile } from '@/types';

const mockUser: UserProfile = {
  id: 'usr-1',
  email: 'test@example.com',
  name: 'Test User',
  language: 'en',
  pushOptIn: true,
  profileComplete: true,
  onboardingComplete: true,
  plan: 'free',
};

describe('household domain module', () => {
  it('generates codes and member colors consistently', () => {
    const code = generateUserCode('usr-1');
    expect(code).toMatch(/^RPT-[A-Z0-9]{6}$/);

    const hhCode = generateHouseholdCode('seed');
    expect(hhCode).toMatch(/^RPT-[A-Z0-9]{6}$/);

    const color = memberColor('usr-1');
    expect(color).toBeDefined();
  });

  it('normalizes household profile and creates invite profile', () => {
    const normalized = normalizeHouseholdProfile(mockUser);
    expect(normalized.userCode).toBeDefined();
    expect(normalized.householdCode).toBeDefined();

    const invite = inviteProfileFromUser(mockUser);
    expect(invite.name).toBe('Test User');
    expect(invite.code).toBe(normalized.userCode);
  });

  it('normalizes invite codes cleanly', () => {
    expect(normalizeInviteCode('rpt123456')).toBe('RPT-123456');
    expect(normalizeInviteCode('RPT-ABCDEF')).toBe('RPT-ABCDEF');
  });

  it('validates invite code format', () => {
    expect(isValidInviteCode('RPT-123456')).toBe(true);
    expect(isValidInviteCode('RPT-ABCDEF')).toBe(true);
    expect(isValidInviteCode('123456')).toBe(true);
    expect(isValidInviteCode('ABCDEF')).toBe(true);
    expect(isValidInviteCode('rpt123456')).toBe(true);
    expect(isValidInviteCode('')).toBe(false);
    expect(isValidInviteCode('RPT-12')).toBe(false);
    expect(isValidInviteCode('12345')).toBe(false);
    expect(isValidInviteCode('1234567')).toBe(false);
    expect(isValidInviteCode('RPT-12345678')).toBe(false);
  });

  it('handles member creation from invite and pending code', () => {
    const member = householdMemberFromInvite({
      code: 'RPT-123456',
      userId: 'usr-2',
      name: 'Bob',
      color: '#FF0000',
    });
    expect(member.status).toBe('active');
    expect(member.name).toBe('Bob');

    const pending = pendingMemberFromCode('RPT-654321');
    expect(pending.status).toBe('pending');
  });

  it('adds and removes legacy household members', () => {
    const member = pendingMemberFromCode('RPT-999999');
    const added = addHouseholdMember(mockUser, member);
    expect(added.householdMembers).toHaveLength(1);

    const removed = removeHouseholdMember(added, 'RPT-999999');
    expect(removed.householdMembers).toHaveLength(0);

    const shared = toSharedMember(member);
    expect(shared.code).toBe('RPT-999999');

    const msg = inviteMessage(mockUser);
    expect(msg).toContain('RPT-');
  });

  it('handles multi-household contexts and legacy migration', () => {
    const hhContext = createHouseholdContext('Beach House', '🏖️', '#3E7C6A', mockUser);
    expect(hhContext.name).toBe('Beach House');
    expect(hhContext.members).toHaveLength(1);

    const migratedNew = migrateLegacyHousehold(mockUser);
    expect(migratedNew.households).toEqual([]);
    expect(getActiveHousehold(migratedNew)).toBeNull();

    const userWithLegacy: UserProfile = {
      ...mockUser,
      householdMembers: [householdMemberFromInvite({ code: 'RPT-111111', userId: 'u2', name: 'Sam', color: '#123' })],
    };
    const migratedLegacy = migrateLegacyHousehold(userWithLegacy);
    expect(migratedLegacy.households).toHaveLength(1);
    expect(getActiveHousehold(migratedLegacy)).not.toBeNull();
    expect(listHouseholds(migratedLegacy)).toHaveLength(1);

    const patch = setActiveHousehold(migratedLegacy, 'hh-test');
    expect(patch.activeHouseholdId).toBe('hh-test');

    const userWithHh: UserProfile = { ...mockUser, households: [hhContext] };
    const addPatch = addMemberToHousehold(userWithHh, hhContext.id, pendingMemberFromCode('RPT-888888'));
    expect(addPatch.households?.[0].members).toHaveLength(2);

    const removePatch = removeMemberFromHousehold(
      { ...userWithHh, households: addPatch.households },
      hhContext.id,
      'RPT-888888'
    );
    expect(removePatch.households?.[0].members).toHaveLength(1);
  });

  it('removes member case-insensitively, updates memberUids, and prunes legacy householdMembers', () => {
    const hhContext = createHouseholdContext('Home', '🏠', '#3E7C6A', mockUser);
    const member = householdMemberFromInvite({
      code: 'RPT-ABC123',
      userId: 'usr-target',
      name: 'Alice',
      color: '#FF0000',
    });
    const hhWithMember = {
      ...hhContext,
      members: [...hhContext.members, member],
      memberUids: [...hhContext.memberUids, 'usr-target'],
    };
    const userState: UserProfile = {
      ...mockUser,
      households: [hhWithMember],
      householdMembers: [member],
    };

    // Remove using unnormalized lowercase string without hyphen
    const patch = removeMemberFromHousehold(userState, hhContext.id, 'rptabc123');
    expect(patch.households?.[0].members.find(m => m.code === 'RPT-ABC123')).toBeUndefined();
    expect(patch.households?.[0].memberUids).not.toContain('usr-target');
    expect(patch.householdMembers?.find(m => m.code === 'RPT-ABC123')).toBeUndefined();
  });
});
