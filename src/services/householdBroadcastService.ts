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
