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

  it('saveOne saves to local SQLite and enqueues sync when remote is disabled', async () => {
    await taskRepository.saveOne(dummyTask, 'u1', 'create');
    expect(localSource.saveSingleTaskLocal).toHaveBeenCalledWith('u1', dummyTask);
    expect(localSource.enqueueSync).toHaveBeenCalledWith('u1', { type: 'create', task: dummyTask });
  });

  it('saveSingleLocal delegates to saveSingleTaskLocal', async () => {
    await taskRepository.saveSingleLocal(dummyTask, 'u1');
    expect(localSource.saveSingleTaskLocal).toHaveBeenCalledWith('u1', dummyTask);
  });

  it('deleteOne deletes from local SQLite and enqueues sync for task deletion when remote is disabled', async () => {
    await taskRepository.deleteOne('t1', 'u1');
    expect(localSource.deleteSingleTaskLocal).toHaveBeenCalledWith('u1', 't1');
    expect(localSource.enqueueSync).toHaveBeenCalledWith('u1', { type: 'delete', taskId: 't1' });
  });

  it('deleteMany deletes multiple tasks locally and enqueues sync when remote is disabled', async () => {
    await taskRepository.deleteMany(['t1', 't2'], 'u1');
    expect(localSource.deleteMultipleTasksLocal).toHaveBeenCalledWith('u1', ['t1', 't2']);
    expect(localSource.enqueueSync).toHaveBeenCalledWith('u1', { type: 'delete', taskId: 't1' });
    expect(localSource.enqueueSync).toHaveBeenCalledWith('u1', { type: 'delete', taskId: 't2' });
  });

  it('load merges inMemoryTasks with SQLite tasks when provided', async () => {
    const memoryTask: RepeatingTask = {
      ...dummyTask,
      id: 't2',
      title: 'Water Bill',
      updatedAt: '2026-09-12T12:00:00.000Z',
    };
    vi.spyOn(localSource, 'loadTasksForUser').mockResolvedValue([dummyTask]);
    const res = await taskRepository.load('u1', false, [memoryTask]);
    expect(res).toHaveLength(2);
    expect(res.map((t) => t.id)).toEqual(['t2', 't1']);
  });
});
