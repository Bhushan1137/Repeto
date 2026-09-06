import { beforeEach, describe, expect, it, vi } from 'vitest';
import { taskRepository } from '@/data/repositories/taskRepository';
import * as localSource from '@/data/sources/localSource';
import * as firebaseConfig from '@/services/firebase/config';
import type { RepeatingTask } from '@/types';

vi.mock('@/data/sources/localSource');
vi.mock('@/services/firebase/config');
vi.mock('@/services/firebase/app');
vi.mock('@/services/firebase/firestore');

describe('data/repositories/taskRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(firebaseConfig, 'isFirebaseConfigured').mockReturnValue(false);
  });

  const dummyTask: RepeatingTask = {
    id: 't1',
    title: 'Electricity',
    category: 'bills',
    recurrence: { type: 'monthly' },
    frequencyLabel: 'Monthly',
    nextDueDate: '2026-09-10T00:00:00.000Z',
    finance: false,
    history: [],
    createdAt: 'iso',
    updatedAt: 'iso',
    escalationCount: 0,
    sharedWith: [],
  };

  it('load returns empty array if userId is null', async () => {
    const res = await taskRepository.load(null);
    expect(res).toEqual([]);
  });

  it('load calls loadTasksForUser when remote is disabled', async () => {
    vi.spyOn(localSource, 'loadTasksForUser').mockResolvedValue([dummyTask]);
    const res = await taskRepository.load('u1');
    expect(res).toEqual([dummyTask]);
    expect(localSource.loadTasksForUser).toHaveBeenCalledWith('u1');
  });

  it('saveAll delegates to saveTasksForUser', async () => {
    await taskRepository.saveAll([dummyTask], 'u1');
    expect(localSource.saveTasksForUser).toHaveBeenCalledWith('u1', [dummyTask]);
  });

  it('saveOne enqueues sync when remote is disabled', async () => {
    await taskRepository.saveOne(dummyTask, 'u1', 'create');
    expect(localSource.enqueueSync).toHaveBeenCalledWith('u1', { type: 'create', task: dummyTask });
  });

  it('deleteOne enqueues sync for task deletion when remote is disabled', async () => {
    await taskRepository.deleteOne('t1', 'u1');
    expect(localSource.enqueueSync).toHaveBeenCalledWith('u1', { type: 'delete', taskId: 't1' });
  });
});
