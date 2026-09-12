import { describe, expect, it } from 'vitest';
import { formatTime12 } from '@/utils/timeFormat';

describe('formatTime12', () => {
  it('formats 24-hour time strings to 12-hour AM/PM format', () => {
    expect(formatTime12('09:00')).toBe('9:00 AM');
    expect(formatTime12('14:30')).toBe('2:30 PM');
    expect(formatTime12('00:15')).toBe('12:15 AM');
    expect(formatTime12('12:00')).toBe('12:00 PM');
    expect(formatTime12('23:59')).toBe('11:59 PM');
  });

  it('formats ISO date strings to 12-hour AM/PM format', () => {
    const d = new Date(2026, 8, 12, 14, 30, 0); // 2:30 PM local
    expect(formatTime12(d.toISOString())).toBe('2:30 PM');
  });

  it('formats Date objects directly', () => {
    const d = new Date(2026, 8, 12, 9, 15, 0); // 9:15 AM local
    expect(formatTime12(d)).toBe('9:15 AM');
  });

  it('handles already formatted 12-hour AM/PM strings', () => {
    expect(formatTime12('9:00 AM')).toBe('9:00 AM');
    expect(formatTime12('2:30 PM')).toBe('2:30 PM');
  });

  it('uses fallback for null, undefined, or empty inputs', () => {
    expect(formatTime12(null)).toBe('9:00 AM');
    expect(formatTime12(undefined)).toBe('9:00 AM');
    expect(formatTime12('', '10:00 AM')).toBe('10:00 AM');
  });
});
