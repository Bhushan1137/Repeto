import { describe, expect, it, vi, beforeEach } from 'vitest';
import { broadcastHouseholdTaskEvent } from '../householdBroadcastService';
import { userRepository } from '@/data/repositories/userRepository';
import * as notificationServices from '../notifications';
import { createTaskFromPreset } from '@/domain/task';
import type { UserProfile, HouseholdMemberProfile } from '@/types';

vi.mock('@/data/repositories/userRepository', () => ({
  userRepository: {
    saveNotification: vi.fn().mockResolvedValue(undefined),
    loadRemote: vi.fn(),
  },
}));

vi.mock('../notifications', () => ({
  sendRemotePushNotification: vi.fn().mockResolvedValue(true),
}));

describe('services/householdBroadcastService', () => {
  const actorUser: Pick<UserProfile, 'id' | 'name' | 'userCode'> = {
    id: 'user-malay',
    name: 'Malay',
    userCode: 'RPT-MALAY',
  };

  const memberBob: HouseholdMemberProfile = {
    code: 'BOB1',
    userId: 'user-bob',
    name: 'Bob',
    color: '#3B82F6',
    addedAt: '2026-09-01T00:00:00.000Z',
    status: 'active',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('broadcasts task_assigned to the assigned member with push notification', async () => {
    const task = {
      ...createTaskFromPreset('Clean Dishes', 'home', 'Daily'),
      householdId: 'hh-home',
      assignedTo: 'user-bob',
    };

    vi.mocked(userRepository.loadRemote).mockResolvedValueOnce({
      id: 'user-bob',
      name: 'Bob',
      expoPushToken: 'ExponentPushToken[bob-phone]',
      pushOptIn: true,
    } as any);

    await broadcastHouseholdTaskEvent({
      eventType: 'task_assigned',
      task,
      actorUser,
      allMembers: [memberBob],
    });

    // 1. Saved in-app notification in Bob's Firestore subcollection
    expect(userRepository.saveNotification).toHaveBeenCalledWith(
      'user-bob',
      expect.objectContaining({
        type: 'household',
        title: '📋 New Task Assigned',
        body: expect.stringContaining('Malay assigned "Clean Dishes" to you'),
      })
    );

    // 2. Dispatched native push to Bob's expo push token
    expect(notificationServices.sendRemotePushNotification).toHaveBeenCalledWith(
      'ExponentPushToken[bob-phone]',
      '📋 New Task Assigned',
      expect.stringContaining('Malay assigned "Clean Dishes" to you'),
      expect.objectContaining({ taskId: task.id, type: 'household' })
    );
  });

  it('broadcasts task_taken_over to other members', async () => {
    const task = {
      ...createTaskFromPreset('Cook Dinner', 'home', 'Daily'),
      householdId: 'hh-home',
      assignedTo: 'user-malay',
    };

    vi.mocked(userRepository.loadRemote).mockResolvedValueOnce({
      id: 'user-bob',
      name: 'Bob',
      expoPushToken: 'ExponentPushToken[bob-phone]',
      pushOptIn: true,
    } as any);

    await broadcastHouseholdTaskEvent({
      eventType: 'task_taken_over',
      task,
      actorUser,
      allMembers: [memberBob],
      previousAssigneeId: 'user-bob',
    });

    expect(userRepository.saveNotification).toHaveBeenCalledWith(
      'user-bob',
      expect.objectContaining({
        type: 'household',
        title: '🤝 Task Taken Over',
      })
    );
  });

  it('broadcasts task_completed_rotation to the next assignee', async () => {
    const task = {
      ...createTaskFromPreset('Mow Lawn', 'home', 'Weekly'),
      householdId: 'hh-home',
      assignedTo: 'user-bob',
      isRotating: true,
    };

    vi.mocked(userRepository.loadRemote).mockResolvedValueOnce({
      id: 'user-bob',
      name: 'Bob',
      expoPushToken: 'ExponentPushToken[bob-phone]',
      pushOptIn: true,
    } as any);

    await broadcastHouseholdTaskEvent({
      eventType: 'task_completed_rotation',
      task,
      actorUser,
      allMembers: [memberBob],
      nextAssigneeId: 'user-bob',
    });

    expect(userRepository.saveNotification).toHaveBeenCalledWith(
      'user-bob',
      expect.objectContaining({
        type: 'household',
        title: "🔄 It's Your Turn!",
        body: expect.stringContaining('You are up next!'),
      })
    );

    expect(notificationServices.sendRemotePushNotification).toHaveBeenCalledWith(
      'ExponentPushToken[bob-phone]',
      "🔄 It's Your Turn!",
      expect.stringContaining('You are up next!'),
      expect.objectContaining({ taskId: task.id, type: 'household' })
    );
  });

  describe('broadcastMemberJoinedHousehold', () => {
    it('sends push to the new member and to existing household members', async () => {
      const newMember = {
        id: 'user-alice',
        name: 'Alice',
        code: 'RPT-ALICE',
      };

      const existingMemberCharlie: HouseholdMemberProfile = {
        code: 'CHARLIE1',
        userId: 'user-charlie',
        name: 'Charlie',
        color: '#10B981',
        addedAt: '2026-09-01T00:00:00.000Z',
        status: 'active',
      };

      vi.mocked(userRepository.loadRemote).mockImplementation(async (uid: string) => {
        if (uid === 'user-alice') {
          return {
            id: 'user-alice',
            name: 'Alice',
            expoPushToken: 'ExponentPushToken[alice-phone]',
            pushOptIn: true,
          } as any;
        }
        if (uid === 'user-charlie') {
          return {
            id: 'user-charlie',
            name: 'Charlie',
            expoPushToken: 'ExponentPushToken[charlie-phone]',
            pushOptIn: true,
          } as any;
        }
        return null;
      });

      const { broadcastMemberJoinedHousehold } = await import('../householdBroadcastService');

      await broadcastMemberJoinedHousehold({
        householdId: 'hh-home',
        householdName: 'Sweet Home',
        newMember,
        actorUser,
        allMembers: [
          { code: actorUser.userCode || 'RPT-MALAY', userId: actorUser.id, name: actorUser.name, color: '#3B82F6', addedAt: '', status: 'active' },
          existingMemberCharlie,
          { code: newMember.code, userId: newMember.id, name: newMember.name, color: '#EC4899', addedAt: '', status: 'active' },
        ],
      });

      // 1. New member Alice receives welcome notification
      expect(userRepository.saveNotification).toHaveBeenCalledWith(
        'user-alice',
        expect.objectContaining({
          type: 'household',
          title: '🏠 Added to Household',
          body: expect.stringContaining('Malay added you to "Sweet Home"'),
        })
      );
      expect(notificationServices.sendRemotePushNotification).toHaveBeenCalledWith(
        'ExponentPushToken[alice-phone]',
        '🏠 Added to Household',
        expect.stringContaining('Malay added you to "Sweet Home"'),
        expect.objectContaining({ householdId: 'hh-home', type: 'household' })
      );

      // 2. Existing member Charlie receives join notification
      expect(userRepository.saveNotification).toHaveBeenCalledWith(
        'user-charlie',
        expect.objectContaining({
          type: 'household',
          title: '🏠 New Member Joined',
          body: expect.stringContaining('Alice has joined "Sweet Home"'),
        })
      );
      expect(notificationServices.sendRemotePushNotification).toHaveBeenCalledWith(
        'ExponentPushToken[charlie-phone]',
        '🏠 New Member Joined',
        expect.stringContaining('Alice has joined "Sweet Home"'),
        expect.objectContaining({ householdId: 'hh-home', type: 'household' })
      );

      // 3. Actor Malay should NOT receive notification
      expect(userRepository.saveNotification).not.toHaveBeenCalledWith(
        actorUser.id,
        expect.anything()
      );
    });
  });

  describe('notifyOwnerMemberLeftHousehold', () => {
    it('sends push notification strictly to the owner when member leaves', async () => {
      vi.mocked(userRepository.loadRemote).mockResolvedValueOnce({
        id: 'user-owner',
        name: 'Owner Bob',
        expoPushToken: 'ExponentPushToken[owner-phone]',
        pushOptIn: true,
      } as any);

      const { notifyOwnerMemberLeftHousehold } = await import('../householdBroadcastService');

      await notifyOwnerMemberLeftHousehold({
        householdId: 'hh-home',
        householdName: 'Sweet Home',
        leavingUser: { id: 'user-alice', name: 'Alice', userCode: 'RPT-ALICE' },
        ownerUid: 'user-owner',
      });

      expect(userRepository.saveNotification).toHaveBeenCalledWith(
        'user-owner',
        expect.objectContaining({
          type: 'household',
          title: '🚪 Member Left Household',
          body: 'Alice left "Sweet Home".',
        })
      );

      expect(notificationServices.sendRemotePushNotification).toHaveBeenCalledWith(
        'ExponentPushToken[owner-phone]',
        '🚪 Member Left Household',
        'Alice left "Sweet Home".',
        expect.objectContaining({ householdId: 'hh-home', type: 'household' })
      );
    });

    it('does not send notification if the leaving user is the owner themselves', async () => {
      const { notifyOwnerMemberLeftHousehold } = await import('../householdBroadcastService');

      await notifyOwnerMemberLeftHousehold({
        householdId: 'hh-home',
        householdName: 'Sweet Home',
        leavingUser: { id: 'user-owner', name: 'Owner Bob', userCode: 'RPT-BOB' },
        ownerUid: 'user-owner',
      });

      expect(userRepository.saveNotification).not.toHaveBeenCalled();
      expect(notificationServices.sendRemotePushNotification).not.toHaveBeenCalled();
    });
  });
});

