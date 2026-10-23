import type { RepeatingTask, HouseholdMemberProfile } from '@/types';
import type { HouseholdActivityItem, HouseholdActivityAction } from '@/services/householdActivityService';

export type ActivityActionType = HouseholdActivityAction;

export interface ActivityItem {
  id: string;
  taskTitle: string;
  completedByName: string;
  completedByColor: string;
  completedAt: string;
  status: 'on_time' | 'late' | 'skipped' | 'missed' | 'snoozed';
  action?: ActivityActionType;
  targetUserName?: string;
  note?: string;
}

export function buildActivityFeed(
  tasks: RepeatingTask[],
  members: HouseholdMemberProfile[],
  currentUserId: string | undefined,
  currentUserName: string,
  explicitActivities?: HouseholdActivityItem[]
): ActivityItem[] {
  const feed: ActivityItem[] = [];
  const seenIds = new Set<string>();

  // 1. Process explicit household activity logs first (authoritative real-time events)
  if (explicitActivities && explicitActivities.length > 0) {
    explicitActivities.forEach((act) => {
      let actorName = act.actorName || 'Household member';
      let actorColor = act.actorColor || '#363E71';

      if (act.actorId === currentUserId) {
        actorName = currentUserName;
        actorColor = '#E8A33D';
      } else {
        const match = members.find((m) => m.userId === act.actorId || m.code === act.actorId);
        if (match) {
          actorName = match.name;
          actorColor = match.color;
        }
      }

      let status: ActivityItem['status'] = 'on_time';
      if (act.action === 'task_snoozed') status = 'snoozed';
      else if (act.action === 'task_skipped') status = 'skipped';
      else if (act.action === 'task_deleted' || act.action === 'member_removed') status = 'missed';

      const key = `${act.taskId || act.taskTitle}-${act.action}-${act.timestamp.slice(0, 16)}`;
      seenIds.add(key);

      feed.push({
        id: act.id,
        taskTitle: act.taskTitle || '',
        completedByName: actorName,
        completedByColor: actorColor,
        completedAt: act.timestamp,
        status,
        action: act.action,
        targetUserName: act.targetUserName,
        note: act.note,
      });
    });
  }

  // 2. Supplement with completions from task history that might precede explicit activity collection
  tasks.forEach((task) => {
    task.history.forEach((h, idx) => {
      if (!h.completedAt) return;

      const actType: ActivityActionType =
        h.status === 'snoozed' ? 'task_snoozed' : h.status === 'skipped' ? 'task_skipped' : 'task_completed';
      const key = `${task.id}-${actType}-${h.completedAt.slice(0, 16)}`;
      if (seenIds.has(key)) return;

      // Find who completed / acted on it
      let completedByName = currentUserName;
      let completedByColor = '#E8A33D'; // You color

      if (h.completedBy) {
        if (h.completedBy !== currentUserId) {
          const match = members.find((m) => m.userId === h.completedBy || m.code === h.completedBy);
          if (match) {
            completedByName = match.name;
            completedByColor = match.color;
          } else {
            completedByName = 'Household member';
            completedByColor = '#363E71';
          }
        }
      } else {
        // Fallback: if task is not shared, it's You. If shared, we default to You or the assignee.
        if (task.sharedWith.length > 0 && task.assignedTo) {
          const match = members.find((m) => m.userId === task.assignedTo || m.code === task.assignedTo);
          if (match) {
            completedByName = match.name;
            completedByColor = match.color;
          }
        }
      }

      feed.push({
        id: `${task.id}-history-${idx}-${h.completedAt}`,
        taskTitle: task.title,
        completedByName,
        completedByColor,
        completedAt: h.completedAt,
        status: h.status,
        action: actType,
        note: h.note,
      });
    });
  });

  // Sort newest first
  return feed.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
}
