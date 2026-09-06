import { describe, expect, it } from 'vitest';
import { buildActivityFeed } from '@/domain/activityFeed';
import type { RepeatingTask, HouseholdMemberProfile } from '@/types';

const mockTask: RepeatingTask = {
  id: 't-1',
  title: 'Water Plants',
  category: 'home',
  recurrence: { type: 'daily', interval: 1 },
  frequencyLabel: 'Daily',
  nextDueDate: '2026-09-02',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  escalationCount: 0,
  finance: false,
  sharedWith: [{ code: 'MEMBER2', name: 'Bob', color: '#00FF00', phone: '123' }],
  history: [
    {
      completedAt: '2026-09-01T08:00:00.000Z',
      status: 'on_time',
      month: '2026-09',
      completedBy: 'MEMBER2',
    },
    {
      completedAt: '2026-08-31T08:00:00.000Z',
      status: 'late',
      month: '2026-08',
      completedBy: 'user-1',
    },
    {
      month: '2026-08',
      status: 'skipped',
    },
  ],
};

const members: HouseholdMemberProfile[] = [
  { code: 'MEMBER2', name: 'Bob', color: '#00FF00', status: 'active', addedAt: '2026-01-01' },
];

describe('activityFeed domain module', () => {
  it('builds sorted activity items from task history and members', () => {
    const feed = buildActivityFeed([mockTask], members, 'user-1', 'Malay');

    expect(feed).toHaveLength(2); // Skipped item with no completedAt excluded
    expect(feed[0].taskTitle).toBe('Water Plants');
    expect(feed[0].completedByName).toBe('Bob');
    expect(feed[0].completedByColor).toBe('#00FF00');

    expect(feed[1].completedByName).toBe('Malay');
    expect(feed[1].completedByColor).toBe('#E8A33D');
  });

  it('handles unknown household member fallback', () => {
    const taskWithUnknown: RepeatingTask = {
      ...mockTask,
      history: [
        {
          completedAt: '2026-09-01T08:00:00.000Z',
          status: 'on_time',
          month: '2026-09',
          completedBy: 'UNKNOWN_USER',
        },
      ],
    };

    const feed = buildActivityFeed([taskWithUnknown], members, 'user-1', 'Malay');
    expect(feed[0].completedByName).toBe('Household member');
    expect(feed[0].completedByColor).toBe('#363E71');
  });
});
