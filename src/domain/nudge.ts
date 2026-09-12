import type { AppNotification } from '@/types/notification';

export const NUDGE_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Calculates how many milliseconds remain on the 4-hour cooldown for a task nudge.
 */
export function getRemainingNudgeCooldown(
  lastNudgedAt: number | null | undefined,
  now: number = Date.now()
): number {
  if (!lastNudgedAt || Number.isNaN(lastNudgedAt)) return 0;
  const elapsed = now - lastNudgedAt;
  if (elapsed < 0) return NUDGE_COOLDOWN_MS; // Clock skew protection
  return elapsed >= NUDGE_COOLDOWN_MS ? 0 : NUDGE_COOLDOWN_MS - elapsed;
}

/**
 * Checks whether a user is allowed to nudge right now.
 */
export function canNudge(
  lastNudgedAt: number | null | undefined,
  now: number = Date.now()
): boolean {
  return getRemainingNudgeCooldown(lastNudgedAt, now) === 0;
}

/**
 * Human-readable remaining cooldown string (e.g. "3h 45m" or "12m").
 */
export function formatRemainingCooldown(
  ms: number,
  language: 'en' | 'hi' = 'en'
): string {
  if (ms <= 0) return '';
  const totalMinutes = Math.max(1, Math.ceil(ms / (60 * 1000)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (language === 'hi') {
    if (hours > 0 && minutes > 0) return `${hours}घं ${minutes}मि`;
    if (hours > 0) return `${hours}घंटे`;
    return `${minutes} मिनट`;
  }

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

/**
 * Builds the standard AppNotification payload for a chore nudge.
 */
export function buildNudgeNotification(
  taskId: string,
  taskTitle: string,
  fromUser: { id: string; name: string }
): AppNotification {
  return {
    id: `nudge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: 'nudge',
    title: `👉 Chore Nudge: ${taskTitle}`,
    body: `${fromUser.name} poked you about "${taskTitle}".`,
    timestamp: new Date().toISOString(),
    read: false,
    metadata: {
      taskId,
      fromUserId: fromUser.id,
      fromUserName: fromUser.name,
    },
  };
}

/**
 * Resolves the Firestore userId of the assigned member, handling both code and direct userId.
 */
export function resolveAssigneeUserId(
  assignedTo: string | undefined | null,
  members: Array<{ userId?: string; code?: string }> = []
): string | null {
  if (!assignedTo) return null;
  const match = members.find((m) => m.userId === assignedTo || m.code === assignedTo);
  if (match?.userId) return match.userId;
  // If it's already a Firebase UID / alphanumeric ID longer than 15 chars and not a short code
  if (assignedTo.length >= 15 && !assignedTo.startsWith('#')) {
    return assignedTo;
  }
  return null;
}
