import { describe, it, expect } from 'vitest';
import { completeTaskInstance, undoCompleteTaskInstance, claimTaskInstance } from '@/domain/task';
import type { RepeatingTask } from '@/types';

describe('Chore Rotation (Round-Robin) & Task Claiming', () => {
  const rotatingTask: RepeatingTask = {
    id: 'task-rot-1',
    householdId: 'hh-1',
    title: 'Order 20L Water Can',
    category: 'home',
    recurrence: { type: 'daily' },
    frequencyLabel: 'Daily',
    nextDueDate: '2026-09-12T10:00:00.000Z',
    finance: false,
    sharedWith: [],
    assignedTo: 'user-alice',
    isRotating: true,
    rotationMembers: ['user-alice', 'user-bob', 'user-charlie'],
    history: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    escalationCount: 0,
  };

  it('rotates assignedTo to the next member in sequence upon completion', () => {
    // 1st completion: Alice -> Bob
    const afterAlice = completeTaskInstance(rotatingTask, undefined, 'Alice');
    expect(afterAlice.assignedTo).toBe('user-bob');
    expect(afterAlice.history).toHaveLength(1);
    expect(afterAlice.history[0].previousAssignee).toBe('user-alice');
    expect(afterAlice.history[0].rotatedTo).toBe('user-bob');

    // 2nd completion: Bob -> Charlie
    const afterBob = completeTaskInstance(afterAlice, undefined, 'Bob');
    expect(afterBob.assignedTo).toBe('user-charlie');
    expect(afterBob.history).toHaveLength(2);
    expect(afterBob.history[1].previousAssignee).toBe('user-bob');
    expect(afterBob.history[1].rotatedTo).toBe('user-charlie');

    // 3rd completion: Charlie -> Alice (loops back)
    const afterCharlie = completeTaskInstance(afterBob, undefined, 'Charlie');
    expect(afterCharlie.assignedTo).toBe('user-alice');
    expect(afterCharlie.history).toHaveLength(3);
    expect(afterCharlie.history[2].previousAssignee).toBe('user-charlie');
    expect(afterCharlie.history[2].rotatedTo).toBe('user-alice');
  });

  it('rolls back assignedTo to previous assignee when completion is undone', () => {
    const afterAlice = completeTaskInstance(rotatingTask, undefined, 'Alice');
    expect(afterAlice.assignedTo).toBe('user-bob');

    const undone = undoCompleteTaskInstance(afterAlice);
    expect(undone.assignedTo).toBe('user-alice');
    expect(undone.history).toHaveLength(0);
  });

  it('allows a member to claim an unassigned task', () => {
    const unassignedTask: RepeatingTask = {
      ...rotatingTask,
      assignedTo: undefined,
      isRotating: false,
    };

    const claimed = claimTaskInstance(unassignedTask, 'user-bob');
    expect(claimed.assignedTo).toBe('user-bob');
  });
});
