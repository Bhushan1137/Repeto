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

    it('deduplicates rapid repeated calls to broadcastMemberJoinedHousehold', async () => {
      vi.mocked(userRepository.loadRemote).mockImplementation(async (uid: string) => {
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

      const params = {
        householdId: 'hh-rapid-test',
        householdName: 'Rapid Home',
        newMember: { id: 'user-dave', name: 'Dave', code: 'RPT-DAVE' },
        actorUser: { id: 'user-dave', name: 'Dave', userCode: 'RPT-DAVE' },
        allMembers: [
          { code: 'RPT-CHARLIE', userId: 'user-charlie', name: 'Charlie', color: '#10B981', addedAt: '', status: 'active' as const },
          { code: 'RPT-DAVE', userId: 'user-dave', name: 'Dave', color: '#EC4899', addedAt: '', status: 'active' as const },
        ],
      };

      // Call twice concurrently / rapidly
      await Promise.all([
        broadcastMemberJoinedHousehold(params),
        broadcastMemberJoinedHousehold(params),
      ]);

      // Charlie should only receive ONE notification doc and ONE push
      const charlieCalls = vi.mocked(userRepository.saveNotification).mock.calls.filter(
        ([uid]) => uid === 'user-charlie'
      );
      expect(charlieCalls.length).toBe(1);
    });

    it('deduplicates member records when a member appears with both code and userId across members list', async () => {
      vi.mocked(userRepository.loadRemote).mockImplementation(async (uid: string) => {
        if (uid === 'user-bob') {
          return {
            id: 'user-bob',
            name: 'Bob',
            expoPushToken: 'ExponentPushToken[bob-phone]',
            pushOptIn: true,
          } as any;
        }
        return null;
      });

      const { broadcastMemberJoinedHousehold } = await import('../householdBroadcastService');

      await broadcastMemberJoinedHousehold({
        householdId: 'hh-dedupe-members',
        householdName: 'Dedupe Home',
        newMember: { id: 'user-eve', name: 'Eve', code: 'RPT-EVE' },
        actorUser: { id: 'user-eve', name: 'Eve', userCode: 'RPT-EVE' },
        allMembers: [
          // Bob has an active entry with userId
          { code: 'RPT-BOB', userId: 'user-bob', name: 'Bob', color: '#10B981', addedAt: '', status: 'active' },
          // Bob also has a legacy or pending entry with only code
          { code: 'RPT-BOB', name: 'Bob', color: '#10B981', addedAt: '', status: 'pending' },
          { code: 'RPT-EVE', userId: 'user-eve', name: 'Eve', color: '#EC4899', addedAt: '', status: 'active' },
        ],
      });

      const bobCalls = vi.mocked(userRepository.saveNotification).mock.calls.filter(
        ([id]) => id === 'user-bob' || id === 'RPT-BOB'
      );
      expect(bobCalls.length).toBe(1);
      expect(bobCalls[0][0]).toBe('user-bob');
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

  describe('broadcastMemberLeftHousehold', () => {
    it('notifies both owner and remaining peers when a member leaves', async () => {
      const { broadcastMemberLeftHousehold } = await import('../householdBroadcastService');

      vi.mocked(userRepository.loadRemote).mockResolvedValue({
        id: 'user-owner',
        expoPushToken: 'ExponentPushToken[owner]',
        pushOptIn: true,
      } as any);

      await broadcastMemberLeftHousehold({
        householdId: 'hh-1',
        householdName: 'Family Villa',
        leavingUser: { id: 'user-charlie', name: 'Charlie', userCode: 'RPT-CHARLIE' },
        ownerUid: 'user-owner',
        allMembers: [
          { code: 'OWNER', userId: 'user-owner', name: 'Owner', color: '#111', addedAt: '', status: 'active' },
          { code: 'DAVE', userId: 'user-dave', name: 'Dave', color: '#222', addedAt: '', status: 'active' },
          { code: 'RPT-CHARLIE', userId: 'user-charlie', name: 'Charlie', color: '#333', addedAt: '', status: 'active' },
        ],
      });

      expect(userRepository.saveNotification).toHaveBeenCalledWith(
        'user-owner',
        expect.objectContaining({
          type: 'household',
          title: '🚪 Member Left Household',
          body: 'Charlie left "Family Villa".',
        })
      );
      expect(userRepository.saveNotification).toHaveBeenCalledWith(
        'user-dave',
        expect.objectContaining({
          type: 'household',
          title: '🚪 Member Left Household',
          body: 'Charlie left "Family Villa".',
        })
      );
      expect(userRepository.saveNotification).not.toHaveBeenCalledWith(
        'user-charlie',
        expect.anything()
      );
    });
  });

  describe('broadcastHouseholdDisbanded', () => {
    it('notifies all members except the owner when a household is disbanded', async () => {
      const { broadcastHouseholdDisbanded } = await import('../householdBroadcastService');

      await broadcastHouseholdDisbanded({
        householdId: 'hh-1',
        householdName: 'Shared Flat',
        ownerName: 'Alice',
        ownerUid: 'user-alice',
        members: [
          { code: 'ALICE', userId: 'user-alice', name: 'Alice', color: '#111', addedAt: '', status: 'active' },
          { code: 'BOB', userId: 'user-bob', name: 'Bob', color: '#222', addedAt: '', status: 'active' },
        ],
      });

      expect(userRepository.saveNotification).toHaveBeenCalledWith(
        'user-bob',
        expect.objectContaining({
          type: 'household',
          title: '🏠 Household Disbanded',
          body: '"Shared Flat" was deleted by Alice.',
        })
      );
      expect(userRepository.saveNotification).not.toHaveBeenCalledWith(
        'user-alice',
        expect.anything()
      );
    });
  });
});

