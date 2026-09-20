import { userRepository } from '@/data/repositories/userRepository';
import { sendRemotePushNotification } from './notifications';
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

export async function broadcastHouseholdTaskEvent({
  eventType,
  task,
  actorUser,
  targetUserIds,
  allMembers = [],
  nextAssigneeId,
}: BroadcastHouseholdTaskOptions): Promise<void> {
  if (!task.householdId) return;

  const actorName = actorUser.name || 'A household member';

  // Determine recipients (excluding actor)
  let recipients: string[] = [];

  if (targetUserIds && targetUserIds.length > 0) {
    recipients = targetUserIds.filter((uid) => uid && uid !== actorUser.id && uid !== actorUser.userCode);
  } else if (eventType === 'task_assigned' && task.assignedTo) {
    // If assigned, primary recipient is the assignee
    recipients = [task.assignedTo];
  } else if (eventType === 'task_completed_rotation' && nextAssigneeId) {
    // If rotated, primary recipient is the next assignee
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

  // Determine Title & Body
  let title = 'Repeto Household 🏠';
  let body = `${actorName} updated "${task.title}".`;

  switch (eventType) {
    case 'task_assigned':
      title = '📋 New Task Assigned';
      body = `${actorName} assigned "${task.title}" to you.`;
      break;
    case 'task_taken_over':
      title = '🤝 Task Taken Over';
      body = `${actorName} took over "${task.title}" for this turn.`;
      break;
    case 'task_completed_rotation':
      title = '🔄 It\'s Your Turn!';
      body = `${actorName} completed "${task.title}". You are up next!`;
      break;
    case 'task_completed':
      title = '✅ Task Completed';
      body = `${actorName} completed "${task.title}".`;
      break;
    case 'task_rescheduled':
      title = '📅 Task Rescheduled';
      body = `${actorName} updated the schedule for "${task.title}".`;
      break;
  }

  // Dispatch to each recipient concurrently (non-blocking)
  await Promise.allSettled(
    uniqueRecipients.map(async (recipientId) => {
      try {
        // 1. In-app notification in recipient's Firestore notifications subcollection
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

        // 2. Direct Expo push notification if target has push token registered
        const targetProfile = await userRepository.loadRemote(recipientId);
        if (targetProfile?.expoPushToken && targetProfile?.pushOptIn !== false) {
          await sendRemotePushNotification(
            targetProfile.expoPushToken,
            title,
            body,
            { taskId: task.id, householdId: task.householdId, type: 'household' }
          );
        }
      } catch (err) {
        console.warn(`[Repeato Broadcast] Failed to notify member ${recipientId}:`, err);
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

export async function broadcastMemberJoinedHousehold({
  householdId,
  householdName,
  newMember,
  actorUser,
  allMembers,
}: MemberJoinedHouseholdOptions): Promise<void> {
  const actorName = actorUser.name || 'A household member';
  const newMemberName = newMember.name || newMember.code;

  // 1. Notify the new member if they have an account (and are not the actor themselves)
  if (newMember.id && newMember.id !== actorUser.id) {
    const welcomeTitle = '🏠 Added to Household';
    const welcomeBody = `${actorName} added you to "${householdName}".`;

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

      const targetProfile = await userRepository.loadRemote(newMember.id);
      if (targetProfile?.expoPushToken && targetProfile?.pushOptIn !== false) {
        await sendRemotePushNotification(
          targetProfile.expoPushToken,
          welcomeTitle,
          welcomeBody,
          { householdId, type: 'household' }
        );
      }
    } catch (err) {
      console.warn(`[Repeato Broadcast] Failed to notify new member ${newMember.id}:`, err);
    }
  }

  // 2. Notify all other existing members (excluding actor and new member)
  const existingMemberIds = allMembers
    .map((m) => m.userId || m.code)
    .filter(
      (id): id is string =>
        Boolean(id) &&
        id !== actorUser.id &&
        id !== actorUser.userCode &&
        id !== newMember.id &&
        id !== newMember.code
    );

  const uniqueExisting = Array.from(new Set(existingMemberIds));
  if (uniqueExisting.length === 0) return;

  const joinTitle = '🏠 New Member Joined';
  const joinBody = `${newMemberName} has joined "${householdName}".`;

  await Promise.allSettled(
    uniqueExisting.map(async (recipientId) => {
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

        const targetProfile = await userRepository.loadRemote(recipientId);
        if (targetProfile?.expoPushToken && targetProfile?.pushOptIn !== false) {
          await sendRemotePushNotification(
            targetProfile.expoPushToken,
            joinTitle,
            joinBody,
            { householdId, type: 'household' }
          );
        }
      } catch (err) {
        console.warn(`[Repeato Broadcast] Failed to notify existing member ${recipientId}:`, err);
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
