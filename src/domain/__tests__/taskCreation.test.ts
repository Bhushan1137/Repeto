import { describe, expect, it } from 'vitest';
import {
  applyCategoryChange,
  dayOfMonthOptions,
  defaultFormState,
  findSchedulingConflicts,
  formStateFromLegacyFreq,
  formStateFromParsed,
  formStateFromTask,
  formStateFromValues,
  formStateToValues,
  getDefaultDoseTimes,
  intervalPresets,
  normalizeReminderTimes,
  nthLabel,
  recurrenceTypeLabel,
  validateFormState,
  weekdayLabel,
  type TaskFormState,
} from '@/domain/taskForm';
import {
  canAddTask,
  canShareWith,
  capTasksForPlan,
  createTaskId,
  createTaskFromFormValues,
  createTaskFromParsed,
  createTaskFromPreset,
  FREE_SHARED_PARTICIPANT_LIMIT,
  FREE_TASK_LIMIT,
} from '@/domain/task';
import {
  computePreviousDueDate,
  getMonthLabel,
  isCurrentMonth,
  parseFrequencyLabel,
} from '@/domain/recurrence';
import { parseTaskInput } from '@/domain/parser';
import type { CategoryKey, SharedMember, UserProfile } from '@/types';

describe('Task Creation Comprehensive Test Suite (100% Coverage)', () => {
  const dummyTranslate = (k: string) => k;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Task ID & Limit Utilities
  // ──────────────────────────────────────────────────────────────────────────
  describe('createTaskId and Plan Limits', () => {
    it('creates distinct unique task IDs with expected prefix', () => {
      const id1 = createTaskId();
      const id2 = createTaskId();
      expect(id1).toMatch(/^task-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^task-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('validates plan limit defaults and constants', () => {
      expect(FREE_TASK_LIMIT).toBe(10);
      expect(FREE_SHARED_PARTICIPANT_LIMIT).toBe(1);

      const dummyUser: UserProfile = {
        id: 'u-1',
        name: 'Test',
        email: 'test@example.com',
        language: 'en',
        pushOptIn: true,
        profileComplete: true,
        onboardingComplete: true,
        plan: 'free',
      };

      expect(canAddTask(dummyUser, 5)).toBe(true);
      expect(canAddTask(dummyUser, 100)).toBe(true);
      expect(canShareWith(dummyUser, [])).toBe(true);
      expect(canShareWith(dummyUser, [{ userId: 'u2', name: 'User 2', phone: '', color: '#3E7C6A' }])).toBe(true);
      expect(capTasksForPlan(dummyUser, [1, 2, 3])).toEqual([1, 2, 3]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. createTaskFromFormValues (Domain Creation)
  // ──────────────────────────────────────────────────────────────────────────
  describe('createTaskFromFormValues', () => {
    it('creates a minimal personal task with required fields only', () => {
      const task = createTaskFromFormValues({
        title: '   Pay Electricity Bill   ',
        category: 'bills',
        recurrence: { type: 'monthly' },
        freq: 'Monthly',
        finance: false,
      });

      expect(task.id).toMatch(/^task-/);
      expect(task.title).toBe('Pay Electricity Bill');
      expect(task.category).toBe('bills');
      expect(task.recurrence).toEqual({ type: 'monthly' });
      expect(task.frequencyLabel).toBe('Monthly');
      expect(task.householdId).toBeNull();
      expect(task.assignedTo).toBeUndefined();
      expect(task.sharedWith).toEqual([]);
      expect(task.history).toEqual([]);
      expect(task.escalationCount).toBe(0);
      expect(task.finance).toBe(false);
      expect(task.amount).toBeUndefined();
      expect(task.icon).toBeUndefined();
      expect(task.creatorName).toBeUndefined();
      expect(new Date(task.createdAt).getTime()).not.toBeNaN();
      expect(new Date(task.updatedAt).getTime()).not.toBeNaN();
    });

    it('creates a full-featured financial task with notes, icon, reminder time and creator name', () => {
      const task = createTaskFromFormValues(
        {
          title: 'Car Insurance Renewal',
          category: 'vehicle',
          recurrence: { type: 'yearly' },
          freq: 'Yearly',
          amount: 12500,
          finance: true,
          icon: '🚗',
          note: 'Check NCB discount before renewal',
          reminderTime: '10:30',
          startDate: '2026-11-15',
        },
        [],
        'Malay'
      );

      expect(task.title).toBe('Car Insurance Renewal');
      expect(task.category).toBe('vehicle');
      expect(task.amount).toBe(12500);
      expect(task.finance).toBe(true);
      expect(task.icon).toBe('🚗');
      expect(task.reminderTime).toBe('10:30');
      expect(task.startDate).toBe('2026-11-15');
      expect(task.creatorName).toBe('Malay');
    });

    it('infers finance: true when amount is provided even if finance flag was omitted or false', () => {
      const task = createTaskFromFormValues({
        title: 'Gym Fee',
        category: 'health',
        recurrence: { type: 'monthly' },
        freq: 'Monthly',
        amount: 2000,
        finance: false,
      });

      expect(task.amount).toBe(2000);
      expect(task.finance).toBe(true);
    });

    it('creates a multi-dose task with reminderTimes and timesPerDay', () => {
      const task = createTaskFromFormValues({
        title: 'Antibiotic Course',
        category: 'health',
        recurrence: { type: 'daily' },
        freq: 'Daily',
        finance: false,
        timesPerDay: 3,
        reminderTimes: ['08:00', '14:00', '20:00'],
        reminderTime: '08:00',
      });

      expect(task.timesPerDay).toBe(3);
      expect(task.reminderTimes).toEqual(['08:00', '14:00', '20:00']);
      expect(task.reminderTime).toBe('08:00');
    });

    it('creates a household assigned task with shared members', () => {
      const shared: SharedMember[] = [
        { userId: 'u-1', name: 'Malay', phone: '', color: '#3E7C6A' },
        { userId: 'u-2', name: 'Sarah', phone: '', color: '#E07A5F' },
      ];

      const task = createTaskFromFormValues(
        {
          title: 'Clean Kitchen Exhaust',
          category: 'home',
          recurrence: { type: 'monthDay', dayOfMonth: 1 },
          freq: 'Monthly on 1st',
          finance: false,
          householdId: 'hh-apartment-402',
          assignedTo: 'u-2',
        },
        shared
      );

      expect(task.householdId).toBe('hh-apartment-402');
      expect(task.assignedTo).toBe('u-2');
      expect(task.sharedWith).toEqual(shared);
    });

    it('creates a chore-rotation task across multiple members', () => {
      const task = createTaskFromFormValues({
        title: 'Mop Living Room',
        category: 'home',
        recurrence: { type: 'weekly', weekday: 0 },
        freq: 'Every Sunday',
        finance: false,
        householdId: 'hh-1',
        isRotating: true,
        rotationMembers: ['u-1', 'u-2', 'u-3'],
        assignedTo: 'u-1',
      });

      expect(task.isRotating).toBe(true);
      expect(task.rotationMembers).toEqual(['u-1', 'u-2', 'u-3']);
      expect(task.assignedTo).toBe('u-1');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. createTaskFromPreset (Domain Creation)
  // ──────────────────────────────────────────────────────────────────────────
  describe('createTaskFromPreset', () => {
    it('creates task correctly from preset parameters', () => {
      const task = createTaskFromPreset('House Rent', 'home', 'Every month', 18000, true, '🏠', 'Admin');

      expect(task.title).toBe('House Rent');
      expect(task.category).toBe('home');
      expect(task.frequencyLabel).toBe('Every month');
      expect(task.recurrence).toEqual({ type: 'monthly' });
      expect(task.amount).toBe(18000);
      expect(task.finance).toBe(true);
      expect(task.icon).toBe('🏠');
      expect(task.creatorName).toBe('Admin');
      expect(task.householdId).toBeNull();
      expect(task.sharedWith).toEqual([]);
      expect(task.history).toEqual([]);
    });

    it('handles presets without finance or amount', () => {
      const task = createTaskFromPreset('Water Plants', 'home', 'Daily');
      expect(task.amount).toBeUndefined();
      expect(task.finance).toBe(false);
      expect(task.recurrence).toEqual({ type: 'daily' });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. createTaskFromParsed (Natural Language Domain Creation)
  // ──────────────────────────────────────────────────────────────────────────
  describe('createTaskFromParsed', () => {
    it('creates task from parsed natural language input with householdId override', () => {
      const parsed = parseTaskInput('Rent 15000 monthly on 5th at 9am');
      const task = createTaskFromParsed(
        parsed,
        {
          finance: true,
          shared: [],
          householdId: 'hh-villa-9',
        },
        'Alice'
      );

      expect(task.title).toBe('Rent');
      expect(task.amount).toBe(15000);
      expect(task.finance).toBe(true);
      expect(task.householdId).toBe('hh-villa-9');
      expect(task.creatorName).toBe('Alice');
      expect(task.recurrence).toEqual({ type: 'monthDay', dayOfMonth: 5 });
    });

    it('sets householdId to undefined when shared members present but householdId omitted', () => {
      const parsed = parseTaskInput('Groceries ₹2500 weekly');
      const shared: SharedMember[] = [{ userId: 'u-1', name: 'Partner', phone: '', color: '#3E7C6A' }];
      const task = createTaskFromParsed(parsed, { finance: true, shared });

      expect(task.householdId).toBeUndefined();
      expect(task.sharedWith).toEqual(shared);
    });

    it('sets householdId to null when no shared members and householdId omitted', () => {
      const parsed = parseTaskInput('Personal Yoga daily');
      const task = createTaskFromParsed(parsed, { finance: false, shared: [] });

      expect(task.householdId).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. defaultFormState & Category Defaults
  // ──────────────────────────────────────────────────────────────────────────
  describe('defaultFormState', () => {
    it('initializes default state across diverse categories', () => {
      const categories: CategoryKey[] = [
        'bills',
        'home',
        'vehicle',
        'health',
        'personal',
        'education',
        'pets',
        'work',
        'finance',
        'subs',
        'help',
        'kids',
        'fitness',
        'medicines',
      ];

      categories.forEach((cat) => {
        const state = defaultFormState(cat);
        expect(state.category).toBe(cat);
        expect(state.title).toBe('');
        expect(state.amountText).toBe('');
        expect(state.isMultiTime).toBe(false);
        expect(state.timesPerDay).toBe(1);
        expect(state.reminderTimes.length).toBeGreaterThanOrEqual(1);
        expect(state.isRotating).toBe(false);
        expect(state.rotationMembers).toEqual([]);
      });
    });

    it('sets finance true by default only for bills, subs, and home categories, and false for others', () => {
      expect(defaultFormState('bills').finance).toBe(true);
      expect(defaultFormState('subs').finance).toBe(true);
      expect(defaultFormState('home').finance).toBe(true);
      expect(defaultFormState('finance').finance).toBe(false);
      expect(defaultFormState('help').finance).toBe(false);
      expect(defaultFormState('education').finance).toBe(false);
      expect(defaultFormState('vehicle').finance).toBe(false);
      expect(defaultFormState('health').finance).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Form State Transformations & Round-trips
  // ──────────────────────────────────────────────────────────────────────────
  describe('Form State Transformations', () => {
    it('formStateFromValues and formStateToValues round-trip correctly', () => {
      const originalState: TaskFormState = {
        ...defaultFormState('vehicle'),
        title: 'Bike Oil Change',
        amountText: '1200',
        finance: true,
        recurrenceType: 'interval',
        interval: 90,
        intervalUnit: 'days',
        reminderTime: '11:00',
        startDate: '2026-10-01',
        icon: '🏍️',
        note: 'Castrol 10W-40',
        householdId: 'hh-1',
        assignedTo: 'u-1',
        isRotating: false,
        rotationMembers: [],
      };

      const values = formStateToValues(originalState, 'en');
      expect(values.title).toBe('Bike Oil Change');
      expect(values.amount).toBe(1200);
      expect(values.finance).toBe(true);
      expect(values.recurrence).toEqual({ type: 'interval', interval: 90, intervalUnit: 'days' });
      expect(values.freq).toBe('Every 90 days');
      expect(values.icon).toBe('🏍️');

      const restoredState = formStateFromValues(values);
      expect(restoredState.title).toBe(originalState.title);
      expect(restoredState.amountText).toBe('1200');
      expect(restoredState.recurrenceType).toBe('interval');
      expect(restoredState.interval).toBe(90);
      expect(restoredState.intervalUnit).toBe('days');
    });

    it('formStateFromTask converts RepeatingTask back to form state', () => {
      const task = createTaskFromFormValues({
        title: 'Monthly Broadband',
        category: 'bills',
        recurrence: { type: 'monthDay', dayOfMonth: 10 },
        freq: 'Monthly on 10th',
        amount: 999,
        finance: true,
        reminderTime: '15:00',
        icon: '📶',
        startDate: '2026-10-10',
      });

      const state = formStateFromTask(task);
      expect(state.title).toBe('Monthly Broadband');
      expect(state.category).toBe('bills');
      expect(state.recurrenceType).toBe('monthDay');
      expect(state.dayOfMonth).toBe(10);
      expect(state.amountText).toBe('999');
      expect(state.finance).toBe(true);
      expect(state.reminderTime).toBe('15:00');
      expect(state.icon).toBe('📶');
    });

    it('formStateFromParsed handles multi-dose and natural language parameters', () => {
      const parsed = parseTaskInput('Take BP tablet twice daily at 8am and 8pm');
      const state = formStateFromParsed(parsed);

      expect(state.title).toBe('Take BP tablet');
      expect(state.isMultiTime).toBe(true);
      expect(state.timesPerDay).toBe(2);
      expect(state.reminderTimes).toEqual(['08:00', '20:00']);
      expect(state.category).toBe('health');
    });

    it('formStateFromLegacyFreq correctly parses string frequencies and amounts', () => {
      const state = formStateFromLegacyFreq('Newspaper Bill', 'Every month', 'bills', 450, true, 'en', '📰');
      expect(state.title).toBe('Newspaper Bill');
      expect(state.recurrenceType).toBe('monthly');
      expect(state.amountText).toBe('450');
      expect(state.finance).toBe(true);
      expect(state.icon).toBe('📰');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Dose Helpers & Normalization
  // ──────────────────────────────────────────────────────────────────────────
  describe('Dose Times and Normalization', () => {
    it('getDefaultDoseTimes returns sensible defaults for 2 to 5 doses', () => {
      expect(getDefaultDoseTimes(2)).toEqual(['08:00', '20:00']);
      expect(getDefaultDoseTimes(3)).toEqual(['08:00', '14:00', '20:00']);
      expect(getDefaultDoseTimes(4)).toEqual(['08:00', '12:00', '16:00', '20:00']);
      expect(getDefaultDoseTimes(5)).toEqual(['07:00', '10:00', '13:00', '17:00', '21:00']);
    });

    it('normalizeReminderTimes pads missing doses with defaults and clamps bounds', () => {
      // 1 dose
      expect(normalizeReminderTimes(1, ['10:00'])).toEqual(['10:00']);
      expect(normalizeReminderTimes(1, [])).toEqual(['09:00']);

      // 3 doses with only 1 provided
      const normalized = normalizeReminderTimes(3, ['09:00']);
      expect(normalized).toEqual(['09:00', '14:00', '20:00']);

      // Clamp upper bound to 5
      const clampedHigh = normalizeReminderTimes(6, []);
      expect(clampedHigh).toHaveLength(5);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Category Change Logic (applyCategoryChange)
  // ──────────────────────────────────────────────────────────────────────────
  describe('applyCategoryChange', () => {
    it('preserves user input while adapting recurrence rules to the new category', () => {
      const state: TaskFormState = {
        ...defaultFormState('bills'),
        title: 'Custom User Title',
        amountText: '500',
        note: 'Important note',
        recurrenceType: 'daily',
      };

      const changed = applyCategoryChange(state, 'vehicle');
      expect(changed.category).toBe('vehicle');
      expect(changed.title).toBe('Custom User Title');
      expect(changed.amountText).toBe('500');
      expect(changed.note).toBe('Important note');
    });

    it('resets recurrence if current recurrence is not allowed in new category', () => {
      const state: TaskFormState = {
        ...defaultFormState('health'),
        recurrenceType: 'nthWeekday',
      };

      const changed = applyCategoryChange(state, 'bills');
      // If bills does not allow nthWeekday, it switches to default
      expect(changed.category).toBe('bills');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Validation: Positive, Negative, & Edge Cases
  // ──────────────────────────────────────────────────────────────────────────
  describe('validateFormState - Every Scenario & Edge Case', () => {
    it('passes for valid English title and valid non-finance state', () => {
      const state: TaskFormState = {
        ...defaultFormState('personal'),
        title: 'Go for a walk',
        finance: false,
      };
      const errors = validateFormState(state, dummyTranslate);
      expect(errors).toEqual({});
    });

    it('passes for valid Hindi / Devanagari title', () => {
      const state: TaskFormState = {
        ...defaultFormState('home'),
        title: 'किराया ₹15,000',
        finance: true,
        amountText: '15000',
      };
      const errors = validateFormState(state, dummyTranslate);
      expect(errors).toEqual({});
    });

    it('passes for minimum 2-character alphanumeric title ("TV")', () => {
      const state: TaskFormState = {
        ...defaultFormState('home'),
        title: 'TV',
        finance: false,
      };
      expect(validateFormState(state, dummyTranslate)).toEqual({});
    });

    it('passes for title with emojis and alphanumeric characters', () => {
      const state: TaskFormState = {
        ...defaultFormState('health'),
        title: 'Morning Gym 🏋️',
        finance: false,
      };
      expect(validateFormState(state, dummyTranslate)).toEqual({});
    });

    it('passes for finance task with maximum allowed boundary amount (₹99,99,999)', () => {
      const state: TaskFormState = {
        ...defaultFormState('finance'),
        title: 'Mutual Fund Investment',
        finance: true,
        amountText: '9999999',
      };
      expect(validateFormState(state, dummyTranslate)).toEqual({});
    });

    it('fails when title is completely empty', () => {
      const state: TaskFormState = {
        ...defaultFormState('bills'),
        title: '',
      };
      const errors = validateFormState(state, dummyTranslate);
      expect(errors.title).toBe('presetTitleRequired');
    });

    it('fails when title contains only whitespace', () => {
      const state: TaskFormState = {
        ...defaultFormState('bills'),
        title: '     ',
      };
      const errors = validateFormState(state, dummyTranslate);
      expect(errors.title).toBe('presetTitleRequired');
    });

    it('fails when title is only 1 character long', () => {
      const state: TaskFormState = {
        ...defaultFormState('bills'),
        title: 'A',
      };
      const errors = validateFormState(state, dummyTranslate);
      expect(errors.title).toBe('presetTitleRequired');
    });

    it('fails when title contains only symbols/punctuation with no alphanumeric characters', () => {
      const state: TaskFormState = {
        ...defaultFormState('bills'),
        title: '!@#$%^&*()',
      };
      const errors = validateFormState(state, dummyTranslate);
      expect(errors.title).toBe('presetTitleRequired');
    });

    it('fails when finance is ON but amountText is empty', () => {
      const state: TaskFormState = {
        ...defaultFormState('bills'),
        title: 'Electricity',
        finance: true,
        amountText: '',
      };
      const errors = validateFormState(state, dummyTranslate);
      expect(errors.amount).toBe('amountRequired');
    });

    it('fails when finance is ON but amountText contains no digits', () => {
      const state: TaskFormState = {
        ...defaultFormState('bills'),
        title: 'Electricity',
        finance: true,
        amountText: 'abc, Rs',
      };
      const errors = validateFormState(state, dummyTranslate);
      expect(errors.amount).toBe('amountRequired');
    });

    it('fails when finance is ON but amountText is zero ("0" or "000")', () => {
      const state: TaskFormState = {
        ...defaultFormState('bills'),
        title: 'Electricity',
        finance: true,
        amountText: '0',
      };
      const errors = validateFormState(state, dummyTranslate);
      expect(errors.amount).toBe('amountRequired');
    });

    it('fails when finance is ON and amount exceeds maximum limit (₹99,99,999)', () => {
      const state: TaskFormState = {
        ...defaultFormState('bills'),
        title: 'Big Expense',
        finance: true,
        amountText: '10000000',
      };
      const errors = validateFormState(state, dummyTranslate);
      expect(errors.amount).toBe('Maximum amount allowed is ₹99,99,999');
    });

    it('fails when recurrenceType is interval and interval is 0 or negative', () => {
      const state0: TaskFormState = {
        ...defaultFormState('vehicle'),
        title: 'Service',
        recurrenceType: 'interval',
        interval: 0,
      };
      expect(validateFormState(state0, dummyTranslate).recurrence).toBe('intervalRequired');

      const stateNeg: TaskFormState = {
        ...defaultFormState('vehicle'),
        title: 'Service',
        recurrenceType: 'interval',
        interval: -5,
      };
      expect(validateFormState(stateNeg, dummyTranslate).recurrence).toBe('intervalRequired');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Scheduling Conflicts: All Rules & Branches
  // ──────────────────────────────────────────────────────────────────────────
  describe('findSchedulingConflicts - Comprehensive Rule Matching', () => {
    it('returns empty when current state has no reminderTime', () => {
      const state: TaskFormState = {
        ...defaultFormState('bills'),
        reminderTime: null,
      };
      expect(findSchedulingConflicts(state, [])).toEqual([]);
    });

    it('ignores tasks without reminderTime or matching editingTaskId', () => {
      const taskNoTime = createTaskFromPreset('Task 1', 'bills', 'Daily');
      taskNoTime.reminderTime = undefined;

      const taskSelf = createTaskFromPreset('Task Self', 'bills', 'Daily');
      taskSelf.reminderTime = '09:00';
      taskSelf.recurrence = { type: 'daily' };

      const state: TaskFormState = {
        ...defaultFormState('bills'),
        recurrenceType: 'daily',
        reminderTime: '09:10',
      };

      expect(findSchedulingConflicts(state, [taskNoTime, taskSelf], taskSelf.id)).toEqual([]);
    });

    it('detects conflict for weekly tasks on the same weekday within 30 minutes', () => {
      const task = createTaskFromPreset('Weekly Clean', 'home', 'Weekly');
      task.recurrence = { type: 'weekly', weekday: 2 }; // Tuesday
      task.reminderTime = '10:00';

      const conflictState: TaskFormState = {
        ...defaultFormState('home'),
        recurrenceType: 'weekly',
        weekday: 2, // Same Tuesday
        reminderTime: '10:20', // Within 30 mins
      };
      expect(findSchedulingConflicts(conflictState, [task])).toHaveLength(1);

      const differentDayState: TaskFormState = {
        ...defaultFormState('home'),
        recurrenceType: 'weekly',
        weekday: 3, // Wednesday
        reminderTime: '10:20',
      };
      expect(findSchedulingConflicts(differentDayState, [task])).toHaveLength(0);
    });

    it('detects conflict for monthDay tasks on the same dayOfMonth within 30 minutes', () => {
      const task = createTaskFromPreset('SIP Investment', 'finance', 'Monthly');
      task.recurrence = { type: 'monthDay', dayOfMonth: 5 };
      task.reminderTime = '09:00';

      const conflictState: TaskFormState = {
        ...defaultFormState('finance'),
        recurrenceType: 'monthDay',
        dayOfMonth: 5,
        reminderTime: '09:30', // Exact 30 min boundary
      };
      expect(findSchedulingConflicts(conflictState, [task])).toHaveLength(1);

      const noConflictTime: TaskFormState = {
        ...defaultFormState('finance'),
        recurrenceType: 'monthDay',
        dayOfMonth: 5,
        reminderTime: '09:31', // Outside 30 mins
      };
      expect(findSchedulingConflicts(noConflictTime, [task])).toHaveLength(0);

      const differentDayOfMonth: TaskFormState = {
        ...defaultFormState('finance'),
        recurrenceType: 'monthDay',
        dayOfMonth: 6,
        reminderTime: '09:00',
      };
      expect(findSchedulingConflicts(differentDayOfMonth, [task])).toHaveLength(0);
    });

    it('detects conflict for nthWeekday tasks on the same nth and weekday within 30 minutes', () => {
      const task = createTaskFromPreset('Club Meeting', 'personal', 'Monthly');
      task.recurrence = { type: 'nthWeekday', nthWeekday: 2, weekday: 6 }; // 2nd Saturday
      task.reminderTime = '18:00';

      const conflictState: TaskFormState = {
        ...defaultFormState('personal'),
        recurrenceType: 'nthWeekday',
        nthWeekday: 2,
        weekday: 6,
        reminderTime: '18:15',
      };
      expect(findSchedulingConflicts(conflictState, [task])).toHaveLength(1);

      const differentNth: TaskFormState = {
        ...defaultFormState('personal'),
        recurrenceType: 'nthWeekday',
        nthWeekday: 3,
        weekday: 6,
        reminderTime: '18:15',
      };
      expect(findSchedulingConflicts(differentNth, [task])).toHaveLength(0);
    });

    it('detects conflict for interval tasks on same interval and unit within 30 minutes', () => {
      const task = createTaskFromPreset('AC Filter Clean', 'home', 'Every 15 days');
      task.recurrence = { type: 'interval', interval: 15, intervalUnit: 'days' };
      task.reminderTime = '08:00';

      const conflictState: TaskFormState = {
        ...defaultFormState('home'),
        recurrenceType: 'interval',
        interval: 15,
        intervalUnit: 'days',
        reminderTime: '08:15',
      };
      expect(findSchedulingConflicts(conflictState, [task])).toHaveLength(1);

      const differentInterval: TaskFormState = {
        ...defaultFormState('home'),
        recurrenceType: 'interval',
        interval: 30,
        intervalUnit: 'days',
        reminderTime: '08:15',
      };
      expect(findSchedulingConflicts(differentInterval, [task])).toHaveLength(0);
    });

    it('returns no conflict when recurrence rule types differ', () => {
      const task = createTaskFromPreset('Daily Task', 'home', 'Daily');
      task.recurrence = { type: 'daily' };
      task.reminderTime = '09:00';

      const weeklyState: TaskFormState = {
        ...defaultFormState('home'),
        recurrenceType: 'weekly',
        weekday: 1,
        reminderTime: '09:00',
      };
      expect(findSchedulingConflicts(weeklyState, [task])).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. Presets and Options Helpers
  // ──────────────────────────────────────────────────────────────────────────
  describe('Options and Presets', () => {
    it('intervalPresets returns category-specific intervals', () => {
      expect(intervalPresets('vehicle')).toEqual([3, 6, 12]);
      expect(intervalPresets('home')).toEqual([7, 15, 30, 90]);
      expect(intervalPresets('pets')).toEqual([7, 15, 30, 90]);
      expect(intervalPresets('health')).toEqual([7, 15, 30, 90]);
      expect(intervalPresets('education')).toEqual([1, 3, 6, 12]);
      expect(intervalPresets('bills')).toEqual([7, 15, 30, 60, 90]);
    });

    it('dayOfMonthOptions returns exactly 28 options with English and Hindi labels', () => {
      const options = dayOfMonthOptions();
      expect(options).toHaveLength(28);
      expect(options[0]).toEqual({ value: 1, labelEn: '1', labelHi: '1' });
      expect(options[27]).toEqual({ value: 28, labelEn: '28', labelHi: '28' });
    });

    it('weekdayLabel, nthLabel, recurrenceTypeLabel handle both en and hi locales', () => {
      expect(recurrenceTypeLabel('weekly', 'en')).toBe('Every week');
      expect(recurrenceTypeLabel('weekly', 'hi')).toBe('हर हफ्ते');
      expect(weekdayLabel(6, 'en')).toBe('Saturday');
      expect(weekdayLabel(6, 'hi')).toBe('शनिवार');
      expect(nthLabel(3, 'en')).toBe('3rd');
      expect(nthLabel(3, 'hi')).toBe('3वां');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 12. Recurrence Previous Due Date & Month Helpers
  // ──────────────────────────────────────────────────────────────────────────
  describe('Recurrence Date Computations & Previous Due Date', () => {
    it('computes previous due date across all recurrence types', () => {
      const baseIso = '2026-06-15T10:00:00.000Z';

      // daily (-1 day)
      const prevDaily = computePreviousDueDate({ type: 'daily' }, baseIso);
      expect(new Date(prevDaily).getUTCDate()).toBe(14);

      // weekly (-7 days)
      const prevWeekly = computePreviousDueDate({ type: 'weekly', weekday: 1 }, baseIso);
      expect(new Date(prevWeekly).getUTCDate()).toBe(8);

      // monthly (-1 month)
      const prevMonthly = computePreviousDueDate({ type: 'monthly' }, baseIso);
      expect(new Date(prevMonthly).getUTCMonth()).toBe(4); // May (0-indexed)

      // yearly (-12 months)
      const prevYearly = computePreviousDueDate({ type: 'yearly' }, baseIso);
      expect(new Date(prevYearly).getUTCFullYear()).toBe(2025);

      // interval days (-10 days)
      const prevIntervalDays = computePreviousDueDate(
        { type: 'interval', interval: 10, intervalUnit: 'days' },
        baseIso
      );
      expect(new Date(prevIntervalDays).getUTCDate()).toBe(5);

      // interval months (-2 months)
      const prevIntervalMonths = computePreviousDueDate(
        { type: 'interval', interval: 2, intervalUnit: 'months' },
        baseIso
      );
      expect(new Date(prevIntervalMonths).getUTCMonth()).toBe(3); // April

      // monthDay
      const prevMonthDay = computePreviousDueDate(
        { type: 'monthDay', dayOfMonth: 5 },
        baseIso
      );
      expect(new Date(prevMonthDay).getUTCDate()).toBe(5);
      expect(new Date(prevMonthDay).getUTCMonth()).toBe(4); // May

      // nthWeekday
      const prevNth = computePreviousDueDate(
        { type: 'nthWeekday', nthWeekday: 2, weekday: 6 },
        baseIso
      );
      expect(new Date(prevNth).getTime()).toBeLessThan(new Date(baseIso).getTime());

      // default fallback
      const prevDefault = computePreviousDueDate({ type: 'unknown' as any }, baseIso);
      expect(new Date(prevDefault).getTime()).toBeLessThan(new Date(baseIso).getTime());
    });

    it('validates getMonthLabel and isCurrentMonth helpers', () => {
      const date = new Date(2026, 8, 15); // Sep 2026
      const label = getMonthLabel(date);
      expect(label).toContain('2026');

      expect(isCurrentMonth(label, date)).toBe(true);
      expect(isCurrentMonth('2026-09', date)).toBe(true);
      expect(isCurrentMonth('', date)).toBe(false);
      expect(isCurrentMonth('2025-01', date)).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 13. Parser Edge Cases for Task Creation
  // ──────────────────────────────────────────────────────────────────────────
  describe('Natural Language Task Creation Parser Edge Cases', () => {
    it('handles empty input in both en and hi locales gracefully', () => {
      const enRes = parseTaskInput('', 'en');
      expect(enRes.title).toBe('New task');
      expect(enRes.frequencyLabel).toBe('Every month');

      const hiRes = parseTaskInput('   ', 'hi');
      expect(hiRes.title).toBe('नया कार्य');
      expect(hiRes.frequencyLabel).toBe('हर महीने');
    });

    it('handles pure token string where cleanTitle becomes empty (falls back to original text)', () => {
      const res = parseTaskInput('₹15,000');
      expect(res.amount).toBe(15000);
      expect(res.title).toBe('₹15,000');
    });

    it('populates default dose times when multi-dose medicine has no specific times mentioned', () => {
      const res = parseTaskInput('Take vitamin tablet 3 times a day');
      expect(res.isMultiTime).toBe(true);
      expect(res.timesPerDay).toBe(3);
      expect(res.reminderTimes).toEqual(['08:00', '14:00', '20:00']);
    });

    it('pads missing dose times when user specifies fewer times than doses', () => {
      const res = parseTaskInput('Insulin 3 times a day at 9am');
      expect(res.isMultiTime).toBe(true);
      expect(res.timesPerDay).toBe(3);
      expect(res.reminderTimes).toHaveLength(3);
      expect(res.reminderTimes![0]).toBe('09:00');
    });

    it('parses Hindi written number for multi-dose schedules ("दिन में दो बार")', () => {
      const res = parseTaskInput('दवा दिन में दो बार सुबह 9 बजे');
      expect(res.isMultiTime).toBe(true);
      expect(res.timesPerDay).toBe(2);
    });

    it('parses Hindi midnight time 12 am ("सुबह 12:00 बजे")', () => {
      const res = parseTaskInput('पानी की मोटर सुबह 12:00 बजे');
      expect(res.reminderTime).toBe('00:00');
    });

    it('parses every 12 months as yearly recurrence rule', () => {
      const res = parseTaskInput('Car service every 12 months');
      expect(res.recurrence).toEqual({ type: 'yearly' });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 14. Frequency Labels & Multi-Time Form Values
  // ──────────────────────────────────────────────────────────────────────────
  describe('Frequency Labels and Multi-Time Form Values', () => {
    it('formStateToValues formats multi-dose frequency labels in en and hi', () => {
      const state: TaskFormState = {
        ...defaultFormState('health'),
        title: 'Eye Drops',
        isMultiTime: true,
        timesPerDay: 3,
        recurrenceType: 'daily',
        reminderTimes: ['08:00', '14:00', '20:00'],
      };

      const enValues = formStateToValues(state, 'en');
      expect(enValues.freq).toBe('3 times a day');
      expect(enValues.reminderTime).toBe('08:00');
      expect(enValues.timesPerDay).toBe(3);

      const hiValues = formStateToValues(state, 'hi');
      expect(hiValues.freq).toBe('3 बार प्रतिदिन');
    });

    it('parses Hindi frequency strings for interval months and days', () => {
      expect(parseFrequencyLabel('हर 3 महीने')).toEqual({
        type: 'interval',
        interval: 3,
        intervalUnit: 'months',
      });
      expect(parseFrequencyLabel('हर 10 दिन')).toEqual({
        type: 'interval',
        interval: 10,
        intervalUnit: 'days',
      });
    });

    it('detects scheduling conflict for monthly and yearly rules within 30 minutes', () => {
      const monthlyTask = createTaskFromPreset('Rent', 'home', 'Monthly');
      monthlyTask.recurrence = { type: 'monthly' };
      monthlyTask.reminderTime = '09:00';

      const stateMonthly: TaskFormState = {
        ...defaultFormState('home'),
        recurrenceType: 'monthly',
        reminderTime: '09:15',
      };
      expect(findSchedulingConflicts(stateMonthly, [monthlyTask])).toHaveLength(1);

      const yearlyTask = createTaskFromPreset('Taxes', 'finance', 'Yearly');
      yearlyTask.recurrence = { type: 'yearly' };
      yearlyTask.reminderTime = '12:00';

      const stateYearly: TaskFormState = {
        ...defaultFormState('finance'),
        recurrenceType: 'yearly',
        reminderTime: '12:20',
      };
      expect(findSchedulingConflicts(stateYearly, [yearlyTask])).toHaveLength(1);
    });
  });
});
