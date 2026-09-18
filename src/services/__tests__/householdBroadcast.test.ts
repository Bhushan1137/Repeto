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
});
