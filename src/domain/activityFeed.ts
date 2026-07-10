import type { RepeatingTask, HouseholdMemberProfile } from '@/types';

export interface ActivityItem {
  id: string;
  taskTitle: string;
  completedByName: string;
  completedByColor: string;
  completedAt: string;
  status: 'on_time' | 'late' | 'skipped' | 'missed' | 'snoozed';
  note?: string;
}

export function buildActivityFeed(
  tasks: RepeatingTask[],
  members: HouseholdMemberProfile[],
  currentUserId: string | undefined,
  currentUserName: string
): ActivityItem[] {
  const feed: ActivityItem[] = [];

  tasks.forEach((task) => {
    task.history.forEach((h, idx) => {
      if (!h.completedAt) return;

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
        note: h.note,
      });
    });
  });

  // Sort newest first
  return feed.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
}
