import { describe, expect, it } from 'vitest';
import { parseTaskInput } from '@/domain/parser';

describe('parseTaskInput with time and amount', () => {
  it('parses English inputs with 12-hour AM/PM time and amounts', () => {
    const result = parseTaskInput('Pay maid every month ₹3,500 at 9am');
    expect(result.title).toBe('Pay maid');
    expect(result.amount).toBe(3500);
    expect(result.reminderTime).toBe('09:00');
    expect(result.category).toBe('help');
  });

  it('parses English inputs with PM times and cleans title', () => {
    const result = parseTaskInput('Netflix subscription every month ₹199 at 7:30 pm');
    expect(result.title).toBe('Netflix subscription');
    expect(result.amount).toBe(199);
    expect(result.reminderTime).toBe('19:30');
    expect(result.category).toBe('subs');
  });

  it('parses English 24-hour time', () => {
    const result = parseTaskInput('Check car engine every 15 days at 18:00');
    expect(result.title).toBe('Check car engine');
    expect(result.reminderTime).toBe('18:00');
    expect(result.category).toBe('vehicle');
  });

  it('parses Hindi inputs with period (सुबह/शाम) and time', () => {
    const result = parseTaskInput('दवा खाना हर दिन सुबह 8 बजे', 'hi');
    expect(result.title).toBe('दवा खाना');
    expect(result.reminderTime).toBe('08:00');
    expect(result.category).toBe('health');
  });

  it('parses Hindi inputs with PM times and amounts', () => {
    const result = parseTaskInput('दूध का बिल हर महीने ₹1,200 शाम 7:30 बजे', 'hi');
    expect(result.title).toBe('दूध का बिल');
    expect(result.amount).toBe(1200);
    expect(result.reminderTime).toBe('19:30');
    expect(result.category).toBe('bills');
  });
});
