import type { HouseholdMemberProfile, SharedMember, UserProfile } from '@/types';

const COLORS = ['#3E7C6A', '#C1502E', '#E8A33D', '#363E71', '#2C5C4E'];

export interface HouseholdInviteProfile {
  code: string;
  userId: string;
  name: string;
  phone?: string;
  color: string;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function generateHouseholdCode(seed: string): string {
  const n = hashString(seed || `${Date.now()}`);
  return `RPT-${n.toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
}

export function memberColor(seed: string): string {
  return COLORS[hashString(seed) % COLORS.length];
}

export function normalizeHouseholdProfile(
  user: UserProfile
): UserProfile & { householdCode: string; householdMembers: HouseholdMemberProfile[]; householdMemberUids: string[] } {
  const householdCode = user.householdCode || generateHouseholdCode(user.id || user.email);
  const householdMembers = user.householdMembers ?? [];
  const householdMemberUids = householdMembers
    .map((m) => m.userId)
    .filter((id): id is string => !!id);
  return {
    ...user,
    householdCode,
    householdMembers,
    householdMemberUids,
  };
}

export function inviteProfileFromUser(user: UserProfile): HouseholdInviteProfile {
  const normalized = normalizeHouseholdProfile(user);
  return {
    code: normalized.householdCode,
    userId: normalized.id,
    name: normalized.name || normalized.email || 'Repeato member',
    phone: normalized.phone,
    color: memberColor(normalized.id || normalized.householdCode),
  };
}

export function householdMemberFromInvite(invite: HouseholdInviteProfile): HouseholdMemberProfile {
  return {
    code: invite.code.toUpperCase(),
    userId: invite.userId,
    name: invite.name,
    phone: invite.phone,
    color: invite.color || memberColor(invite.code),
    addedAt: new Date().toISOString(),
    status: 'active',
  };
}

export function pendingMemberFromCode(code: string): HouseholdMemberProfile {
  const normalized = normalizeInviteCode(code);
  return {
    code: normalized,
    name: `Member ${normalized.slice(-4)}`,
    color: memberColor(normalized),
    addedAt: new Date().toISOString(),
    status: 'pending',
  };
}

export function normalizeInviteCode(code: string): string {
  const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.startsWith('RPT')) return `RPT-${cleaned.slice(3, 9)}`;
  return cleaned.length > 3 ? `RPT-${cleaned.slice(0, 6)}` : cleaned;
}

export function addHouseholdMember(
  user: UserProfile,
  member: HouseholdMemberProfile
): UserProfile & { householdCode: string; householdMembers: HouseholdMemberProfile[] } {
  const normalized = normalizeHouseholdProfile(user);
  const code = normalizeInviteCode(member.code);
  if (!code || code === normalized.householdCode) return normalized;

  const existing = normalized.householdMembers.some((m) => normalizeInviteCode(m.code) === code);
  if (existing) return normalized;

  return {
    ...normalized,
    householdMembers: [{ ...member, code }, ...normalized.householdMembers],
  };
}

export function removeHouseholdMember(
  user: UserProfile,
  code: string
): UserProfile & { householdCode: string; householdMembers: HouseholdMemberProfile[] } {
  const normalized = normalizeHouseholdProfile(user);
  const target = normalizeInviteCode(code);
  return {
    ...normalized,
    householdMembers: normalized.householdMembers.filter((m) => normalizeInviteCode(m.code) !== target),
  };
}

export function toSharedMember(member: HouseholdMemberProfile): SharedMember {
  return {
    name: member.name,
    phone: member.phone ?? member.code,
    color: member.color,
    code: member.code,
    userId: member.userId,
  };
}

export function inviteMessage(user: UserProfile): string {
  const normalized = normalizeHouseholdProfile(user);
  return `Join my Repeato household with code ${normalized.householdCode}. Open Repeato, go to Household, and enter this code.`;
}
