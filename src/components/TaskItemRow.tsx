import React, { useCallback } from 'react';
import type { Language, RepeatingTask, HouseholdMemberProfile } from '@/types';
import { TaskCard } from './TaskCard';
import { SwipeableTaskItem } from './SwipeableTaskItem';

export interface TaskItemRowProps {
  task: RepeatingTask;
  language: Language;
  selected?: boolean;
  selectionMode?: boolean;
  canComplete?: boolean;
  canSnooze?: boolean;
  onPress: (taskId: string) => void;
  onLongPress?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onSnooze?: (taskId: string, days?: number) => void;
  testID?: string;
  currentUserId?: string;
  currentUserCode?: string;
  householdMembers?: HouseholdMemberProfile[];
  onTakeOver?: (taskId: string) => void;
  onNudge?: (taskId: string) => void;
  isOverdue?: boolean;
}

function TaskItemRowComponent({
  task,
  language,
  selected = false,
  selectionMode = false,
  canComplete = true,
  canSnooze = true,
  onPress,
  onLongPress,
  onComplete,
  onSnooze,
  testID,
  currentUserId,
  currentUserCode,
  householdMembers,
  onTakeOver,
  onNudge,
  isOverdue = false,
}: TaskItemRowProps) {
  const taskId = task.id;

  const handlePress = useCallback(() => {
    onPress(taskId);
  }, [onPress, taskId]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(taskId);
  }, [onLongPress, taskId]);

  const handleComplete = useCallback(() => {
    onComplete?.(taskId);
  }, [onComplete, taskId]);

  const handleSnooze = useCallback(
    (days?: number) => {
      onSnooze?.(taskId, days);
    },
    [onSnooze, taskId]
  );

  const handleTakeOver = useCallback(() => {
    onTakeOver?.(taskId);
  }, [onTakeOver, taskId]);

  const handleNudge = useCallback(() => {
    onNudge?.(taskId);
  }, [onNudge, taskId]);

  const isAssignedToMe = (
    (Boolean(currentUserId) && task.assignedTo === currentUserId) ||
    (Boolean(currentUserCode) && task.assignedTo === currentUserCode)
  );
  const isAssignedToOther = Boolean(task.householdId && task.assignedTo && !isAssignedToMe);
  const effectiveCanComplete = canComplete && !isAssignedToOther;

  return (
    <SwipeableTaskItem
      language={language}
      enabled={!selectionMode && !isAssignedToOther}
      onComplete={effectiveCanComplete && onComplete ? handleComplete : undefined}
      onSnooze={canSnooze && onSnooze ? handleSnooze : undefined}
    >
      <TaskCard
        task={task}
        language={language}
        selected={selected}
        selectionMode={selectionMode}
        style={{ marginBottom: 0 }}
        onPress={handlePress}
        onLongPress={onLongPress ? handleLongPress : undefined}
        onCompletePress={!selectionMode && effectiveCanComplete && onComplete ? handleComplete : undefined}
        testID={testID}
        currentUserId={currentUserId}
        currentUserCode={currentUserCode}
        householdMembers={householdMembers}
        onTakeOver={onTakeOver ? handleTakeOver : undefined}
        onNudge={onNudge ? handleNudge : undefined}
        isOverdue={isOverdue}
      />
    </SwipeableTaskItem>
  );
}

export const TaskItemRow = React.memo(TaskItemRowComponent, (prev, next) => {
  return (
    prev.task.id === next.task.id &&
    prev.task.updatedAt === next.task.updatedAt &&
    prev.task.nextDueDate === next.task.nextDueDate &&
    prev.task.title === next.task.title &&
    prev.task.pinned === next.task.pinned &&
    prev.task.escalationCount === next.task.escalationCount &&
    prev.task.assignedTo === next.task.assignedTo &&
    prev.task.householdId === next.task.householdId &&
    prev.selected === next.selected &&
    prev.selectionMode === next.selectionMode &&
    prev.canComplete === next.canComplete &&
    prev.canSnooze === next.canSnooze &&
    prev.language === next.language &&
    prev.currentUserId === next.currentUserId &&
    prev.currentUserCode === next.currentUserCode &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress &&
    prev.onComplete === next.onComplete &&
    prev.onSnooze === next.onSnooze &&
    prev.onTakeOver === next.onTakeOver &&
    prev.onNudge === next.onNudge
  );
});
