import React, { useCallback } from 'react';
import type { Language, RepeatingTask } from '@/types';
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

  return (
    <SwipeableTaskItem
      language={language}
      enabled={!selectionMode}
      onComplete={canComplete && onComplete ? handleComplete : undefined}
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
        onCompletePress={!selectionMode && canComplete && onComplete ? handleComplete : undefined}
        testID={testID}
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
    prev.selected === next.selected &&
    prev.selectionMode === next.selectionMode &&
    prev.canComplete === next.canComplete &&
    prev.canSnooze === next.canSnooze &&
    prev.language === next.language &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress &&
    prev.onComplete === next.onComplete &&
    prev.onSnooze === next.onSnooze
  );
});
