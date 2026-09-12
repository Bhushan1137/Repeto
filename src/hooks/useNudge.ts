import { useCallback } from 'react';
import type { HouseholdMemberProfile, RepeatingTask } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { resolveAssigneeUserId, formatRemainingCooldown } from '@/domain/nudge';
import { sendTaskNudge } from '@/services/nudgeService';

export function useNudge() {
  const { user, activeHousehold } = useAuth();
  const { showToast } = useToast();
  const { language } = useTranslation();

  const handleNudge = useCallback(
    async (task: RepeatingTask, assigneeMember?: HouseholdMemberProfile): Promise<boolean> => {
      if (!user) return false;
      const allMembers = activeHousehold?.members ?? user.householdMembers ?? [];
      const targetUserId =
        resolveAssigneeUserId(task.assignedTo, allMembers) || assigneeMember?.userId;

      if (!targetUserId) {
        showToast(
          language === 'hi'
            ? 'सदस्य खाता कनेक्ट नहीं है'
            : 'Cannot nudge: member has no connected account'
        );
        return false;
      }

      if (targetUserId === user.id) {
        showToast(
          language === 'hi'
            ? 'आप स्वयं को नज़ नहीं कर सकते'
            : 'You cannot nudge yourself!'
        );
        return false;
      }

      const res = await sendTaskNudge({
        taskId: task.id,
        taskTitle: task.title,
        targetUserId,
        fromUser: { id: user.id, name: user.name },
      });

      if (res.success) {
        const targetName = assigneeMember?.name || 'Assignee';
        showToast(
          language === 'hi'
            ? `${targetName} को नज़ भेज दिया गया! 👉`
            : `Nudge sent to ${targetName}! 👉`
        );
        return true;
      }

      if (res.reason === 'cooldown' && res.remainingMs) {
        const timeStr = formatRemainingCooldown(res.remainingMs, language);
        showToast(
          language === 'hi'
            ? `हाल ही में नज़ भेजा गया। ${timeStr} बाद पुनः प्रयास करें`
            : `Already nudged! Try again in ${timeStr}`
        );
        return false;
      }

      showToast(
        language === 'hi' ? 'नज़ भेजने में विफल' : 'Failed to send nudge'
      );
      return false;
    },
    [user, activeHousehold, showToast, language]
  );

  return { handleNudge };
}
