import type { HouseholdContext, HouseholdMemberProfile, RepeatingTask, SharedMember, UserProfile } from '@/types';


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

export function generateUserCode(seed: string): string {
  const n = hashString(seed || `${Date.now()}`);
  return `RPT-${n.toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
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
): UserProfile & { userCode: string; householdCode: string; householdMembers: HouseholdMemberProfile[]; householdMemberUids: string[] } {
  const userCode = user.userCode || generateUserCode(user.id || user.email);
  const householdCode = user.householdCode || userCode;
  const householdMembers = user.householdMembers ?? [];
  const householdMemberUids = householdMembers
    .map((m) => m.userId)
    .filter((id): id is string => !!id);
  return {
    ...user,
    userCode,
    householdCode,
    householdMembers,
    householdMemberUids,
  };
}

export function inviteProfileFromUser(user: UserProfile): HouseholdInviteProfile {
  const normalized = normalizeHouseholdProfile(user);
  return {
    code: normalized.userCode,
    userId: normalized.id,
    name: normalized.name || normalized.email || 'Repeato member',
    phone: normalized.phone,
    color: memberColor(normalized.id || normalized.userCode),
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

export function isValidInviteCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.startsWith('RPT')) {
    return cleaned.length === 9;
  }
  return cleaned.length === 6;
}

export function addHouseholdMember(
  user: UserProfile,
  member: HouseholdMemberProfile
): UserProfile & { householdCode: string; householdMembers: HouseholdMemberProfile[] } {
  const normalized = normalizeHouseholdProfile(user);
  const code = normalizeInviteCode(member.code);
  if (!code || code === normalized.userCode || (member.userId && member.userId === normalized.id)) return normalized;

  const existing = normalized.householdMembers.some(
    (m) => normalizeInviteCode(m.code) === code || (member.userId && m.userId === member.userId)
  );
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
  return `My Repeato user code is ${normalized.userCode}. Scan or enter this code in Repeato to add me to your household.`;
}

// ─── Multi-Household Context Functions ────────────────────────────────────

const HOUSEHOLD_ICONS = ['🏠', '🏢', '🏖️', '🏕️', '🏋️', '🎯', '🌿', '🏫', '🏡', '🌆'];
const HOUSEHOLD_COLORS = ['#363E71', '#3E7C6A', '#C1502E', '#E8A33D', '#2C5C4E', '#7C3E6A'];
export const MAX_HOUSEHOLDS = 5;
export { HOUSEHOLD_ICONS, HOUSEHOLD_COLORS };

function generateId(): string {
  return `hh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Creates a new HouseholdContext for a user */
export function createHouseholdContext(
  name: string,
  icon: string,
  color: string,
  user: UserProfile
): HouseholdContext {
  const id = generateId();
  const userCode = user.userCode || generateUserCode(user.id || user.email);
  const ownerMember: HouseholdMemberProfile = {
    code: userCode,
    name: user.name || 'Owner',
    color: memberColor(user.id || userCode),
    userId: user.id,
    phone: user.phone,
    addedAt: new Date().toISOString(),
    status: 'active',
  };

  return {
    id,
    name: name.trim(),
    icon,
    ownerUid: user.id,
    code: userCode,
    members: [ownerMember],
    memberUids: [user.id],
    createdAt: new Date().toISOString(),
    color,
  };
}

/**
 * Migrates the legacy single-household structure into the new multi-household array.
 * Safe to call multiple times. New users start with 0 households (households: []).
 */
export function migrateLegacyHousehold(user: UserProfile): UserProfile {
  const normalized = normalizeHouseholdProfile(user);

  // Already migrated or explicitly initialized
  if (normalized.households !== undefined) return normalized;

  // Only create a legacy household if user had pre-existing legacy householdMembers
  const existingMembers = (normalized.householdMembers ?? []).filter(
    (m) => m.userId !== normalized.id && m.code !== normalized.userCode
  );

  if (existingMembers.length > 0) {
    const homeContext = createHouseholdContext('Home', '🏠', HOUSEHOLD_COLORS[0], normalized);
    const mergedMembers = [...homeContext.members, ...existingMembers];
    const memberUids = Array.from(
      new Set([normalized.id, ...mergedMembers.map((m) => m.userId).filter((id): id is string => !!id)])
    );

    const updatedHomeContext: HouseholdContext = {
      ...homeContext,
      ownerUid: normalized.id,
      members: mergedMembers,
      memberUids,
    };

    return {
      ...normalized,
      households: [updatedHomeContext],
      activeHouseholdId: updatedHomeContext.id,
    };
  }

  // Default for new users: 0 households
  return {
    ...normalized,
    households: [],
    activeHouseholdId: undefined,
  };
}

/** Returns the currently active HouseholdContext, or null */
export function getActiveHousehold(user: UserProfile): HouseholdContext | null {
  const households = listHouseholds(user);
  if (households.length === 0) return null;
  if (user.activeHouseholdId) {
    return households.find((h) => h.id === user.activeHouseholdId) ?? households[0];
  }
  return households[0];
}

/** Returns all HouseholdContexts for the user, deduplicated by unique ID */
export function listHouseholds(user: UserProfile): HouseholdContext[] {
  if (!user.households) return [];
  const map = new Map<string, HouseholdContext>();
  user.households.forEach((h) => {
    if (h && h.id) map.set(h.id, h);
  });
  return Array.from(map.values());
}

/** Returns a UserProfile patch that switches the active household */
export function setActiveHousehold(user: UserProfile, id: string): Partial<UserProfile> {
  return { activeHouseholdId: id };
}

/**
 * Adds a member to a specific household context.
 * Returns a Partial<UserProfile> patch to be passed to updateUser().
 */
export function addMemberToHousehold(
  user: UserProfile,
  householdId: string,
  member: HouseholdMemberProfile
): Partial<UserProfile> {
  const normalized = normalizeHouseholdProfile(user);
  const userCode = normalizeInviteCode(normalized.userCode);
  const code = normalizeInviteCode(member.code);

  const households = (normalized.households ?? []).map(h => {
    if (h.id !== householdId) return h;
    // Prevent adding yourself to your own household member list
    if ((member.userId && member.userId === normalized.id) || (code && code === userCode)) return h;
    const exists = h.members.some(
      m => normalizeInviteCode(m.code) === code || (member.userId && m.userId === member.userId)
    );
    if (exists) return h;
    return {
      ...h,
      members: [{ ...member, code }, ...h.members],
      memberUids: member.userId && !h.memberUids.includes(member.userId)
        ? [...h.memberUids, member.userId]
        : h.memberUids,
    };
  });
  return { households };
}

/**
 * Removes a member from a specific household context.
 * Returns a Partial<UserProfile> patch to be passed to updateUser().
 */
export function removeMemberFromHousehold(
  user: UserProfile,
  householdId: string,
  memberCode: string
): Partial<UserProfile> {
  const target = normalizeInviteCode(memberCode);
  const households = (user.households ?? []).map(h => {
    if (h.id !== householdId) return h;
    const removedMember = h.members.find(m => normalizeInviteCode(m.code) === target);
    const targetUid = removedMember?.userId;
    return {
      ...h,
      members: h.members.filter(m =>
        normalizeInviteCode(m.code) !== target && (!targetUid || m.userId !== targetUid)
      ),
      memberUids: targetUid
        ? h.memberUids.filter(uid => uid !== targetUid)
        : h.memberUids,
    };
  });
  // Also prune from legacy user.householdMembers
  const householdMembers = (user.householdMembers ?? []).filter(
    m => normalizeInviteCode(m.code) !== target
  );
  return { households, householdMembers };
}

export interface CollisionResult {
  hasCollision: boolean;
  isStarterEmpty: boolean;
  collidingHousehold?: HouseholdContext;
}

/**
 * Detects if user already has a household with the same name,
 * and whether the existing one is an untouched starter (0 tasks and <= 1 member).
 */
export function detectHouseholdCollision(
  user: UserProfile,
  newHousehold: HouseholdContext,
  tasks: RepeatingTask[] = []
): CollisionResult {
  const existingList = listHouseholds(user);
  const normalizedNewName = newHousehold.name.trim().toLowerCase();
  const colliding = existingList.find(
    (h) => h.id !== newHousehold.id && h.name.trim().toLowerCase() === normalizedNewName
  );

  if (!colliding) {
    return { hasCollision: false, isStarterEmpty: false };
  }

  // Check if colliding is an untouched starter (0 tasks in this household, <= 1 member)
  const taskCount = tasks.filter((t) => t.householdId === colliding.id).length;
  const isStarterEmpty = taskCount === 0 && (colliding.members?.length ?? 0) <= 1;

  return {
    hasCollision: true,
    isStarterEmpty,
    collidingHousehold: colliding,
  };
}

/**
 * Merges sourceHousehold into targetHousehold.
 * Re-parents all tasks from source to target, removes sourceHousehold,
 * and sets activeHouseholdId to target.
 */
export function mergeHouseholds(
  user: UserProfile,
  sourceHhId: string,
  targetHhId: string,
  tasks: RepeatingTask[] = []
): { updatedUser: UserProfile; updatedTasks: RepeatingTask[] } {
  const currentHouseholds = listHouseholds(user);
  const targetHh = currentHouseholds.find((h) => h.id === targetHhId);
  const sourceHh = currentHouseholds.find((h) => h.id === sourceHhId);

  if (!sourceHh) {
    return { updatedUser: user, updatedTasks: tasks };
  }

  let updatedTargetHh = targetHh;
  if (updatedTargetHh && sourceHh.members) {
    const existingMemberUids = new Set(updatedTargetHh.memberUids ?? []);
    const mergedMembers = [...updatedTargetHh.members];
    sourceHh.members.forEach((sm) => {
      if (sm.userId && !existingMemberUids.has(sm.userId)) {
        mergedMembers.push(sm);
        existingMemberUids.add(sm.userId);
      }
    });
    updatedTargetHh = {
      ...updatedTargetHh,
      members: mergedMembers,
      memberUids: Array.from(existingMemberUids),
    };
  }

  const remainingHouseholds = currentHouseholds
    .filter((h) => h.id !== sourceHhId)
    .map((h) => (h.id === targetHhId && updatedTargetHh ? updatedTargetHh : h));

  const updatedUser: UserProfile = {
    ...user,
    households: remainingHouseholds,
    activeHouseholdId: targetHhId,
  };

  const updatedTasks = tasks.map((task) => {
    if (task.householdId === sourceHhId) {
      return {
        ...task,
        householdId: targetHhId,
        updatedAt: new Date().toISOString(),
      };
    }
    return task;
  });

  return { updatedUser, updatedTasks };
}

/**
 * Computes a user-friendly display name for a household.
 * Disambiguates if multiple households share the exact same name.
 */
export function getHouseholdDisplayName(
  hh: HouseholdContext,
  currentUserId?: string,
  allHouseholds: HouseholdContext[] = []
): string {
  if (!hh) return '';
  const trimmedName = hh.name?.trim() || 'Household';
  const sameNameCount = allHouseholds.filter(
    (h) => h.name?.trim().toLowerCase() === trimmedName.toLowerCase()
  ).length;

  if (sameNameCount <= 1) {
    return trimmedName;
  }

  if (currentUserId && hh.ownerUid === currentUserId) {
    return `${trimmedName} (You)`;
  }
  const ownerMember = hh.members?.find((m) => m.userId === hh.ownerUid);
  const ownerFirstName = ownerMember?.name?.split(' ')[0] || 'Shared';
  return `${trimmedName} (${ownerFirstName})`;
}

