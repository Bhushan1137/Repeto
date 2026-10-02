import { userRepository } from '@/data/repositories/userRepository';
import { sendRemotePushNotification } from './notifications';
import { normalizeInviteCode } from '@/domain/household';
import type { RepeatingTask, UserProfile, HouseholdMemberProfile } from '@/types';
import type { AppNotification } from '@/types/notification';

export type HouseholdBroadcastEventType =
  | 'task_assigned'
  | 'task_taken_over'
  | 'task_completed_rotation'
  | 'task_completed'
  | 'task_rescheduled';

export interface BroadcastHouseholdTaskOptions {
  eventType: HouseholdBroadcastEventType;
  task: RepeatingTask;
  actorUser: Pick<UserProfile, 'id' | 'name' | 'userCode'>;
  targetUserIds?: string[];
  allMembers?: HouseholdMemberProfile[];
  previousAssigneeId?: string;
  nextAssigneeId?: string;
}

export async function resolveRecipientCanonicalUserId(
  rawRecipientId: string,
  allMembers: HouseholdMemberProfile[] = []
): Promise<string> {
  if (!rawRecipientId) return rawRecipientId;
  const trimmed = rawRecipientId.trim();

  // 1. Direct match with a member's userId
  const memberByUid = allMembers.find((m) => m.userId && m.userId.trim() === trimmed);
  if (memberByUid?.userId) return memberByUid.userId.trim();

  // 2. Direct match with a member's code that has a userId
  const memberByCode = allMembers.find(
    (m) => m.code && normalizeInviteCode(m.code) === normalizeInviteCode(trimmed)
  );
  if (memberByCode?.userId) return memberByCode.userId.trim();

  // 3. If trimmed looks like a userCode (e.g. starts with RPT- or REP-), resolve from userCodes index
  if (
    (trimmed.toUpperCase().startsWith('RPT-') || trimmed.toUpperCase().startsWith('REP-')) &&
    typeof userRepository.resolveUserCode === 'function'
  ) {
    try {
      const userCodeRecord = await userRepository.resolveUserCode(trimmed);
      if (userCodeRecord?.userId) return userCodeRecord.userId.trim();
    } catch {
      // Ignore resolution error
    }
  }

  // 4. Fallback to raw string (which is likely a Firebase Auth UID)
  return trimmed;
}

export async function broadcastHouseholdTaskEvent({
  eventType,
  task,
  actorUser,
  targetUserIds,
  allMembers = [],
  previousAssigneeId,
  nextAssigneeId,
}: BroadcastHouseholdTaskOptions): Promise<void> {
  if (!task.householdId) return;

  const actorName = actorUser.name || 'A household member';

  // Determine recipients (excluding actor)
  let recipients: string[] = [];

  if (targetUserIds && targetUserIds.length > 0) {
    recipients = targetUserIds.filter((uid) => uid && uid !== actorUser.id && uid !== actorUser.userCode);
  } else if (
    eventType === 'task_assigned' &&
    task.assignedTo &&
    task.assignedTo !== actorUser.id &&
    task.assignedTo !== actorUser.userCode
  ) {
    // If assigned to another member, primary recipient is the assignee
    recipients = [task.assignedTo];
  } else if (
    eventType === 'task_completed_rotation' &&
    nextAssigneeId &&
    nextAssigneeId !== actorUser.id &&
    nextAssigneeId !== actorUser.userCode
  ) {
    // If rotated to another member, primary recipient is the next assignee
    recipients = [nextAssigneeId];
  } else {
    // Broadcast to all other members in the household
    recipients = allMembers
      .map((m) => m.userId || m.code)
      .filter((id): id is string => Boolean(id) && id !== actorUser.id && id !== actorUser.userCode);
  }

  // Deduplicate
  const uniqueRecipients = Array.from(new Set(recipients)).filter(
    (id) => id !== actorUser.id && id !== actorUser.userCode
  );

  if (uniqueRecipients.length === 0) return;

  // Find assignee name if task is assigned
  const assigneeMember = task.assignedTo
    ? allMembers.find(
        (m) =>
          (m.userId && m.userId.trim() === task.assignedTo?.trim()) ||
          (m.code && normalizeInviteCode(m.code) === normalizeInviteCode(task.assignedTo || ''))
      )
    : undefined;
  const assigneeName = assigneeMember?.name || 'a member';

  // Dispatch to each recipient concurrently (non-blocking)
  await Promise.allSettled(
    uniqueRecipients.map(async (rawRecipientId) => {
      try {
        const recipientId = await resolveRecipientCanonicalUserId(rawRecipientId, allMembers);

        // Determine if this recipient is the assigned user
        const isAssignee = Boolean(
          task.assignedTo &&
            (task.assignedTo === recipientId ||
              task.assignedTo === rawRecipientId ||
              (assigneeMember?.userId && assigneeMember.userId === recipientId))
        );

        const isPreviousAssignee = Boolean(
          previousAssigneeId &&
            (previousAssigneeId === recipientId || previousAssigneeId === rawRecipientId)
        );

        let title = 'Repeto Household 🏠';
        let body = `${actorName} updated "${task.title}".`;

        switch (eventType) {
          case 'task_assigned': {
            if (isAssignee) {
              title = '📋 New Task Assigned';
              body = `${actorName} assigned "${task.title}" to you.`;
            } else if (task.assignedTo) {
              title = '📋 New Household Task';
              body = `${actorName} added "${task.title}" (assigned to ${assigneeName}).`;
            } else {
              title = '📋 New Household Task';
              body = `${actorName} added "${task.title}" to the household.`;
            }
            break;
          }
          case 'task_taken_over': {
            title = '🤝 Task Taken Over';
            if (isPreviousAssignee) {
              body = `${actorName} took over your turn for "${task.title}".`;
            } else {
              body = `${actorName} took over "${task.title}" for this turn.`;
            }
            break;
          }
          case 'task_completed_rotation': {
            title = "🔄 It's Your Turn!";
            body = `${actorName} completed "${task.title}". You are up next!`;
            break;
          }
          case 'task_completed': {
            title = '✅ Task Completed';
            body = `${actorName} completed "${task.title}".`;
            break;
          }
          case 'task_rescheduled': {
            title = '📅 Task Rescheduled';
            body = `${actorName} updated the schedule for "${task.title}".`;
            break;
          }
        }

        // 1. In-app notification in recipient's Firestore notifications subcollection
        try {
          const notif: AppNotification = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: 'household',
            title,
            body,
            timestamp: new Date().toISOString(),
            read: false,
            metadata: {
              taskId: task.id,
              householdId: task.householdId ?? undefined,
            },
          };
          await userRepository.saveNotification(recipientId, notif);
        } catch (notifErr) {
          console.warn(`[Repeato Broadcast] Failed to save in-app notification for ${recipientId}:`, notifErr);
        }

        // 2. Direct Expo push notification if target has push token registered
        try {
          const targetProfile = await userRepository.loadRemote(recipientId);
          if (targetProfile?.expoPushToken && targetProfile?.pushOptIn !== false) {
            await sendRemotePushNotification(
              targetProfile.expoPushToken,
              title,
              body,
              { taskId: task.id, householdId: task.householdId, type: 'household' }
            );
          }
        } catch (pushErr) {
          console.warn(`[Repeato Broadcast] Failed to send push notification to ${recipientId}:`, pushErr);
        }
      } catch (err) {
        console.warn(`[Repeato Broadcast] Failed to notify member ${rawRecipientId}:`, err);
      }
    })
  );
}

export interface MemberJoinedHouseholdOptions {
  householdId: string;
  householdName: string;
  newMember: { id?: string; name?: string; code: string };
  actorUser: Pick<UserProfile, 'id' | 'name' | 'userCode'>;
  allMembers: HouseholdMemberProfile[];
}

const recentJoinBroadcasts = new Map<string, number>();
const JOIN_BROADCAST_DEDUPE_MS = 5000;

export async function broadcastMemberJoinedHousehold({
  householdId,
  householdName,
  newMember,
  actorUser,
  allMembers,
}: MemberJoinedHouseholdOptions): Promise<void> {
  const actorName = actorUser.name || 'A household member';
  const newMemberName = newMember.name || newMember.code;

  // Prevent duplicate join broadcasts within a short time window (e.g. from rapid scanner frames or double taps)
  const dedupeMemberKey = (newMember.id || newMember.code || '').trim().toLowerCase();
  const dedupeKey = `${householdId}:${dedupeMemberKey}`;
  const now = Date.now();
  const lastBroadcastTime = recentJoinBroadcasts.get(dedupeKey);
  if (lastBroadcastTime && now - lastBroadcastTime < JOIN_BROADCAST_DEDUPE_MS) {
    return;
  }
  recentJoinBroadcasts.set(dedupeKey, now);

  // Periodic cleanup of stale deduplication cache entries
  if (recentJoinBroadcasts.size > 200) {
    for (const [key, timestamp] of recentJoinBroadcasts.entries()) {
      if (now - timestamp >= JOIN_BROADCAST_DEDUPE_MS) {
        recentJoinBroadcasts.delete(key);
      }
    }
  }

  // 1. Notify the new member if they have an account (and are not the actor themselves)
  if (newMember.id && newMember.id !== actorUser.id) {
    const welcomeTitle = '🏠 Added to Household';
    const welcomeBody = `${actorName} added you to "${householdName}".`;

    try {
      try {
        const notif: AppNotification = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: 'household',
          title: welcomeTitle,
          body: welcomeBody,
          timestamp: new Date().toISOString(),
          read: false,
          metadata: { householdId },
        };
        await userRepository.saveNotification(newMember.id, notif);
      } catch (notifErr) {
        console.warn(`[Repeato Broadcast] Failed to save in-app welcome notification for ${newMember.id}:`, notifErr);
      }

      try {
        const targetProfile = await userRepository.loadRemote(newMember.id);
        if (targetProfile?.expoPushToken && targetProfile?.pushOptIn !== false) {
          await sendRemotePushNotification(
            targetProfile.expoPushToken,
            welcomeTitle,
            welcomeBody,
            { householdId, type: 'household' }
          );
        }
      } catch (pushErr) {
        console.warn(`[Repeato Broadcast] Failed to send welcome push to ${newMember.id}:`, pushErr);
      }
    } catch (err) {
      console.warn(`[Repeato Broadcast] Failed to notify new member ${newMember.id}:`, err);
    }
  }

  // 2. Notify all other existing members (excluding actor and new member)
  const normalizedActorId = actorUser.id ? actorUser.id.trim().toLowerCase() : '';
  const normalizedActorCode = actorUser.userCode ? normalizeInviteCode(actorUser.userCode) : '';
  const normalizedNewMemberId = newMember.id ? newMember.id.trim().toLowerCase() : '';
  const normalizedNewMemberCode = newMember.code ? normalizeInviteCode(newMember.code) : '';

  // Track known member code -> userId mappings to deduplicate members who have both code & userId records
  const codeToUserId = new Map<string, string>();
  for (const m of allMembers) {
    if (m.userId && m.code) {
      codeToUserId.set(normalizeInviteCode(m.code), m.userId.trim());
    }
  }

  // Extract unique recipient user identifiers (canonical userId preferred, fallback to code)
  const recipientMap = new Map<string, string>();

  for (const m of allMembers) {
    const mUserId = m.userId?.trim();
    const mCode = m.code ? normalizeInviteCode(m.code) : '';

    const isActor =
      (mUserId && mUserId.toLowerCase() === normalizedActorId) ||
      (mCode && mCode === normalizedActorCode);

    const isNewMember =
      (mUserId && mUserId.toLowerCase() === normalizedNewMemberId) ||
      (mCode && mCode === normalizedNewMemberCode);

    if (isActor || isNewMember) continue;

    // Resolve canonical user ID if possible
    const canonicalId = mUserId || (mCode ? codeToUserId.get(mCode) : undefined);
    if (canonicalId) {
      recipientMap.set(canonicalId.toLowerCase(), canonicalId);
    } else if (mCode) {
      recipientMap.set(mCode, mCode);
    }
  }

  const uniqueExisting = Array.from(recipientMap.values());
  if (uniqueExisting.length === 0) return;

  const joinTitle = '🏠 New Member Joined';
  const joinBody = `${newMemberName} has joined "${householdName}".`;

  await Promise.allSettled(
    uniqueExisting.map(async (rawRecipientId) => {
      try {
        const recipientId = await resolveRecipientCanonicalUserId(rawRecipientId, allMembers);
        try {
          const notif: AppNotification = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: 'household',
            title: joinTitle,
            body: joinBody,
            timestamp: new Date().toISOString(),
            read: false,
            metadata: { householdId },
          };
          await userRepository.saveNotification(recipientId, notif);
        } catch (notifErr) {
          console.warn(`[Repeato Broadcast] Failed to save in-app notification for ${recipientId}:`, notifErr);
        }

        try {
          const targetProfile = await userRepository.loadRemote(recipientId);
          if (targetProfile?.expoPushToken && targetProfile?.pushOptIn !== false) {
            await sendRemotePushNotification(
              targetProfile.expoPushToken,
              joinTitle,
              joinBody,
              { householdId, type: 'household' }
            );
          }
        } catch (pushErr) {
          console.warn(`[Repeato Broadcast] Failed to send push notification to ${recipientId}:`, pushErr);
        }
      } catch (err) {
        console.warn(`[Repeato Broadcast] Failed to notify existing member ${rawRecipientId}:`, err);
      }
    })
  );
}

export interface MemberLeftHouseholdOptions {
  householdId: string;
  householdName: string;
  leavingUser: Pick<UserProfile, 'id' | 'name' | 'userCode'>;
  ownerUid: string;
}

export async function notifyOwnerMemberLeftHousehold({
  householdId,
  householdName,
  leavingUser,
  ownerUid,
}: MemberLeftHouseholdOptions): Promise<void> {
  // Only notify owner if owner is not the one leaving
  if (!ownerUid || ownerUid === leavingUser.id) return;

  const leavingUserName = leavingUser.name || 'A member';
  const title = '🚪 Member Left Household';
  const body = `${leavingUserName} left "${householdName}".`;

  try {
    // 1. In-app notification for owner
    const notif: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'household',
      title,
      body,
      timestamp: new Date().toISOString(),
      read: false,
      metadata: { householdId },
    };
    await userRepository.saveNotification(ownerUid, notif);

    // 2. Remote push notification for owner
    const ownerProfile = await userRepository.loadRemote(ownerUid);
    if (ownerProfile?.expoPushToken && ownerProfile?.pushOptIn !== false) {
      await sendRemotePushNotification(
        ownerProfile.expoPushToken,
        title,
        body,
        { householdId, type: 'household' }
      );
    }
  } catch (err) {
    console.warn(`[Repeato Broadcast] Failed to notify owner ${ownerUid} on member leave:`, err);
  }
}

export interface BroadcastMemberLeftOptions {
  householdId: string;
  householdName: string;
  leavingUser: Pick<UserProfile, 'id' | 'name' | 'userCode'>;
  allMembers: HouseholdMemberProfile[];
  ownerUid?: string;
}

export async function broadcastMemberLeftHousehold({
  householdId,
  householdName,
  leavingUser,
  allMembers,
  ownerUid,
}: BroadcastMemberLeftOptions): Promise<void> {
  const leavingUserName = leavingUser.name || 'A member';
  const title = '🚪 Member Left Household';
  const body = `${leavingUserName} left "${householdName}".`;

  const recipientIds = new Set<string>();
  if (ownerUid && ownerUid !== leavingUser.id) {
    recipientIds.add(ownerUid);
  }
  (allMembers || []).forEach((m) => {
    const id = m.userId || m.code;
    if (id && id !== leavingUser.id && id !== leavingUser.userCode) {
      recipientIds.add(m.userId || id);
    }
  });

  await Promise.allSettled(
    Array.from(recipientIds).map(async (rawRecipientId) => {
      try {
        const recipientId = await resolveRecipientCanonicalUserId(rawRecipientId, allMembers);
        const notif: AppNotification = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: 'household',
          title,
          body,
          timestamp: new Date().toISOString(),
          read: false,
          metadata: { householdId },
        };
        await userRepository.saveNotification(recipientId, notif);

        const targetProfile = await userRepository.loadRemote(recipientId);
        if (targetProfile?.expoPushToken && targetProfile?.pushOptIn !== false) {
          await sendRemotePushNotification(
            targetProfile.expoPushToken,
            title,
            body,
            { householdId, type: 'household' }
          );
        }
      } catch (err) {
        console.warn(`[Repeato Broadcast] Failed to notify member ${rawRecipientId} on leave:`, err);
      }
    })
  );
}

export interface BroadcastHouseholdDisbandedOptions {
  householdId: string;
  householdName: string;
  ownerName?: string;
  ownerUid?: string;
  members: HouseholdMemberProfile[];
}

export async function broadcastHouseholdDisbanded({
  householdId,
  householdName,
  ownerName,
  ownerUid,
  members,
}: BroadcastHouseholdDisbandedOptions): Promise<void> {
  const title = '🏠 Household Disbanded';
  const body = `"${householdName}" was disbanded by ${ownerName || 'the owner'}.`;

  const recipientIds = new Set<string>();
  (members || []).forEach((m) => {
    const id = m.userId || m.code;
    if (id && (!ownerUid || (m.userId !== ownerUid && m.code !== ownerUid))) {
      recipientIds.add(m.userId || id);
    }
  });

  await Promise.allSettled(
    Array.from(recipientIds).map(async (rawRecipientId) => {
      try {
        const recipientId = await resolveRecipientCanonicalUserId(rawRecipientId, members);
        const notif: AppNotification = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: 'household',
          title,
          body,
          timestamp: new Date().toISOString(),
          read: false,
          metadata: { householdId },
        };
        await userRepository.saveNotification(recipientId, notif);

        const targetProfile = await userRepository.loadRemote(recipientId);
        if (targetProfile?.expoPushToken && targetProfile?.pushOptIn !== false) {
          await sendRemotePushNotification(
            targetProfile.expoPushToken,
            title,
            body,
            { householdId, type: 'household' }
          );
        }
      } catch (err) {
        console.warn(`[Repeato Broadcast] Failed to notify member ${rawRecipientId} on disband:`, err);
      }
    })
  );
}
