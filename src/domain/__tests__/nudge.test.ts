import { describe, it, expect } from 'vitest';
import {
  NUDGE_COOLDOWN_MS,
  getRemainingNudgeCooldown,
  canNudge,
  formatRemainingCooldown,
  buildNudgeNotification,
} from '../nudge';

describe('domain/nudge', () => {
  it('allows nudging when task has never been nudged', () => {
    expect(canNudge(null)).toBe(true);
    expect(canNudge(undefined)).toBe(true);
    expect(getRemainingNudgeCooldown(null)).toBe(0);
  });

  it('blocks nudging and computes remaining ms when inside 4h cooldown', () => {
    const now = 10000000;
    const lastNudged = now - 1 * 60 * 60 * 1000; // 1 hour ago
    expect(canNudge(lastNudged, now)).toBe(false);

    const remaining = getRemainingNudgeCooldown(lastNudged, now);
    expect(remaining).toBe(3 * 60 * 60 * 1000); // 3 hours left
  });

  it('allows nudging once 4 hours have elapsed', () => {
    const now = 10000000;
    const lastNudged = now - NUDGE_COOLDOWN_MS;
    expect(canNudge(lastNudged, now)).toBe(true);
    expect(getRemainingNudgeCooldown(lastNudged, now)).toBe(0);

    const lastNudgedLongAgo = now - 10 * 60 * 60 * 1000;
    expect(canNudge(lastNudgedLongAgo, now)).toBe(true);
    expect(getRemainingNudgeCooldown(lastNudgedLongAgo, now)).toBe(0);
  });

  it('formats remaining cooldown correctly in English and Hindi', () => {
    const twoHoursThirtyMins = (2 * 60 + 30) * 60 * 1000;
    expect(formatRemainingCooldown(twoHoursThirtyMins, 'en')).toBe('2h 30m');
    expect(formatRemainingCooldown(twoHoursThirtyMins, 'hi')).toBe('2घं 30मि');

    const fortyFiveMins = 45 * 60 * 1000;
    expect(formatRemainingCooldown(fortyFiveMins, 'en')).toBe('45m');
    expect(formatRemainingCooldown(fortyFiveMins, 'hi')).toBe('45 मिनट');

    const twoHoursExact = 2 * 60 * 60 * 1000;
    expect(formatRemainingCooldown(twoHoursExact, 'en')).toBe('2h');
    expect(formatRemainingCooldown(twoHoursExact, 'hi')).toBe('2घंटे');

    expect(formatRemainingCooldown(0, 'en')).toBe('');
  });

  it('builds valid AppNotification structure for nudge', () => {
    const notif = buildNudgeNotification('task-123', 'Clean Kitchen', {
      id: 'user-a',
      name: 'Rohan',
    });

    expect(notif.type).toBe('nudge');
    expect(notif.title).toContain('Clean Kitchen');
    expect(notif.body).toContain('Rohan');
    expect(notif.metadata?.taskId).toBe('task-123');
    expect(notif.metadata?.fromUserId).toBe('user-a');
    expect(notif.metadata?.fromUserName).toBe('Rohan');
    expect(notif.read).toBe(false);
  });
});
