import { describe, it, expect } from 'vitest';
import { parseTime, toTimeString } from '../timeFieldShared';

describe('timeFieldShared', () => {
  describe('parseTime', () => {
    it('correctly parses 12:00 AM (00:00) without resetting to 9:00 AM', () => {
      const d = parseTime('00:00');
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
    });

    it('correctly parses 12:30 AM (00:30) without resetting to 9:30 AM', () => {
      const d = parseTime('00:30');
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(30);
    });

    it('correctly parses 12:00 PM (12:00)', () => {
      const d = parseTime('12:00');
      expect(d.getHours()).toBe(12);
      expect(d.getMinutes()).toBe(0);
    });

    it('correctly parses morning times (e.g. 09:15)', () => {
      const d = parseTime('09:15');
      expect(d.getHours()).toBe(9);
      expect(d.getMinutes()).toBe(15);
    });

    it('correctly falls back to 9:00 AM when value is null or empty', () => {
      const dNull = parseTime(null);
      expect(dNull.getHours()).toBe(9);
      expect(dNull.getMinutes()).toBe(0);

      const dEmpty = parseTime('');
      expect(dEmpty.getHours()).toBe(9);
      expect(dEmpty.getMinutes()).toBe(0);
    });
  });

  describe('toTimeString', () => {
    it('formats midnight as 00:00', () => {
      const d = new Date(2026, 0, 1, 0, 0, 0);
      expect(toTimeString(d)).toBe('00:00');
    });

    it('formats noon as 12:00', () => {
      const d = new Date(2026, 0, 1, 12, 0, 0);
      expect(toTimeString(d)).toBe('12:00');
    });
  });

  describe('roundtrip', () => {
    it('roundtrips 12:00 AM through parseTime and toTimeString', () => {
      const original = '00:00';
      const parsed = parseTime(original);
      const output = toTimeString(parsed);
      expect(output).toBe(original);
    });

    it('roundtrips 12:30 AM through parseTime and toTimeString', () => {
      const original = '00:30';
      const parsed = parseTime(original);
      const output = toTimeString(parsed);
      expect(output).toBe(original);
    });
  });
});
