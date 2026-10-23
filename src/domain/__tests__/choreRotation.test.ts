import { describe, it, expect } from 'vitest';
import { completeTaskInstance, undoCompleteTaskInstance, claimTaskInstance, cleanupHouseholdTasksForMember } from '@/domain/task';
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

  describe('cleanupHouseholdTasksForMember', () => {
    it('unassigns non-rotating household tasks when assigned member leaves or is removed', () => {
      const task: RepeatingTask = {
        ...rotatingTask,
        id: 'task-clean-dishes',
        assignedTo: 'user-bob',
        isRotating: false,
        rotationMembers: [],
      };

      const { updatedTasks, modifiedTasks } = cleanupHouseholdTasksForMember(
        [task],
        'hh-1',
        { userId: 'user-bob', memberCode: 'BOB1' }
      );

      expect(updatedTasks[0].assignedTo).toBeUndefined();
      expect(modifiedTasks).toHaveLength(1);
    });

    it('reassigns rotating chore to next available user when current assignee leaves', () => {
      // Rotation: Alice -> Bob -> Charlie. Bob is currently assigned.
      const task: RepeatingTask = {
        ...rotatingTask,
        assignedTo: 'user-bob',
        rotationMembers: ['user-alice', 'user-bob', 'user-charlie'],
      };

      const { updatedTasks, modifiedTasks } = cleanupHouseholdTasksForMember(
        [task],
        'hh-1',
        { userId: 'user-bob', memberCode: 'BOB1' }
      );

      // Next available user after Bob is Charlie
      expect(updatedTasks[0].assignedTo).toBe('user-charlie');
      expect(updatedTasks[0].rotationMembers).toEqual(['user-alice', 'user-charlie']);
      expect(updatedTasks[0].isRotating).toBe(true);
      expect(modifiedTasks).toHaveLength(1);
    });

    it('wraps around to first member if the leaving member was last in rotation sequence', () => {
      // Rotation: Alice -> Bob. Bob is currently assigned and is last in list.
      const task: RepeatingTask = {
        ...rotatingTask,
        assignedTo: 'user-bob',
        rotationMembers: ['user-alice', 'user-bob'],
      };

      const { updatedTasks } = cleanupHouseholdTasksForMember(
        [task],
        'hh-1',
        { userId: 'user-bob' }
      );

      expect(updatedTasks[0].assignedTo).toBe('user-alice');
      expect(updatedTasks[0].rotationMembers).toEqual(['user-alice']);
    });

    it('removes leaving member from rotationMembers even when not currently assigned', () => {
      // Alice is currently assigned, but Bob is in future rotation
      const task: RepeatingTask = {
        ...rotatingTask,
        assignedTo: 'user-alice',
        rotationMembers: ['user-alice', 'user-bob', 'user-charlie'],
      };

      const { updatedTasks, modifiedTasks } = cleanupHouseholdTasksForMember(
        [task],
        'hh-1',
        { userId: 'user-bob' }
      );

      // Alice keeps current turn, Bob is stripped from future turns
      expect(updatedTasks[0].assignedTo).toBe('user-alice');
      expect(updatedTasks[0].rotationMembers).toEqual(['user-alice', 'user-charlie']);
      expect(modifiedTasks).toHaveLength(1);

      // Verify that upon Alice completion, it directly rotates to Charlie (skipping Bob)
      const afterAlice = completeTaskInstance(updatedTasks[0], undefined, 'Alice');
      expect(afterAlice.assignedTo).toBe('user-charlie');
    });

    it('unassigns task and disables rotation when removed member was the only rotation member', () => {
      const task: RepeatingTask = {
        ...rotatingTask,
        assignedTo: 'user-bob',
        rotationMembers: ['user-bob'],
      };

      const { updatedTasks } = cleanupHouseholdTasksForMember(
        [task],
        'hh-1',
        { userId: 'user-bob' }
      );

      expect(updatedTasks[0].assignedTo).toBeUndefined();
      expect(updatedTasks[0].isRotating).toBe(false);
      expect(updatedTasks[0].rotationMembers).toEqual([]);
    });

    it('does not touch tasks from a different household', () => {
      const otherHouseholdTask: RepeatingTask = {
        ...rotatingTask,
        id: 'task-other-hh',
        householdId: 'hh-other',
        assignedTo: 'user-bob',
      };

      const { updatedTasks, modifiedTasks } = cleanupHouseholdTasksForMember(
        [otherHouseholdTask],
        'hh-1',
        { userId: 'user-bob' }
      );

      expect(updatedTasks[0].assignedTo).toBe('user-bob');
      expect(modifiedTasks).toHaveLength(0);
    });
  });
});
