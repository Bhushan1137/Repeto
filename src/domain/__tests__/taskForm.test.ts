import { describe, expect, it } from 'vitest';
import {
  applyCategoryChange,
  buildRecurrenceRule,
  dayOfMonthOptions,
  defaultFormState,
  findSchedulingConflicts,
  formStateFromLegacyFreq,
  formStateFromParsed,
  formStateFromTask,
  formStateFromValues,
  formStateToValues,
  intervalPresets,
  nthLabel,
  recurrenceTypeLabel,
  recurrenceToFormState,
  validateFormState,
  validateSmartTitle,
  weekdayLabel,
} from '@/domain/taskForm';
import { createTaskFromParsed, createTaskFromPreset, updateTaskDetails } from '@/domain/task';
import { taskToFormValues } from '@/domain/preset';
import type { TaskFormState } from '@/domain/taskForm';

describe('domain/taskForm', () => {
  it('recurrenceTypeLabel, weekdayLabel, nthLabel render translations correctly', () => {
    expect(recurrenceTypeLabel('daily', 'en')).toBe('Every day');
    expect(recurrenceTypeLabel('daily', 'hi')).toBe('हर दिन');
    expect(weekdayLabel(0, 'en')).toBe('Sunday');
    expect(weekdayLabel(0, 'hi')).toBe('रविवार');
    expect(nthLabel(1, 'en')).toBe('1st');
    expect(nthLabel(2, 'en')).toBe('2nd');
    expect(nthLabel(3, 'en')).toBe('3rd');
    expect(nthLabel(4, 'en')).toBe('4th');
    expect(nthLabel(1, 'hi')).toBe('1वां');
  });

  it('buildRecurrenceRule and recurrenceToFormState build and convert correctly', () => {
    expect(buildRecurrenceRule({ recurrenceType: 'daily', dayOfMonth: 1, weekday: 1, interval: 1, intervalUnit: 'days', nthWeekday: 1 })).toEqual({ type: 'daily' });
    expect(buildRecurrenceRule({ recurrenceType: 'weekly', dayOfMonth: 1, weekday: 2, interval: 1, intervalUnit: 'days', nthWeekday: 1 })).toEqual({ type: 'weekly', weekday: 2 });
    expect(buildRecurrenceRule({ recurrenceType: 'monthDay', dayOfMonth: 15, weekday: 1, interval: 1, intervalUnit: 'days', nthWeekday: 1 })).toEqual({ type: 'monthDay', dayOfMonth: 15 });
    expect(buildRecurrenceRule({ recurrenceType: 'yearly', dayOfMonth: 1, weekday: 1, interval: 1, intervalUnit: 'days', nthWeekday: 1 })).toEqual({ type: 'yearly' });
    expect(buildRecurrenceRule({ recurrenceType: 'interval', dayOfMonth: 1, weekday: 1, interval: 10, intervalUnit: 'days', nthWeekday: 1 })).toEqual({ type: 'interval', interval: 10, intervalUnit: 'days' });
    expect(buildRecurrenceRule({ recurrenceType: 'nthWeekday', dayOfMonth: 1, weekday: 5, interval: 1, intervalUnit: 'days', nthWeekday: 2 })).toEqual({ type: 'nthWeekday', nthWeekday: 2, weekday: 5 });

    const state = recurrenceToFormState({ type: 'monthDay', dayOfMonth: 10 });
    expect(state.recurrenceType).toBe('monthDay');
    expect(state.dayOfMonth).toBe(10);
  });

  it('defaultFormState initializes based on category config', () => {
    const state = defaultFormState('bills');
    expect(state.category).toBe('bills');
    expect(state.finance).toBe(true);
  });

  it('formStateFromValues, formStateFromParsed, formStateFromTask construct valid state', () => {
    const task = createTaskFromPreset('Rent', 'home', 'Monthly', 10000, true);
    const state1 = formStateFromTask(task);
    expect(state1.title).toBe('Rent');
    expect(state1.amountText).toBe('10000');
    expect(state1.alarmEnabled).toBe(false);

    const state2 = formStateFromParsed({
      title: 'Gym',
      category: 'health',
      recurrence: { type: 'daily' },
      frequencyLabel: 'Daily',
      amount: 1500,
    });
    expect(state2.title).toBe('Gym');
    expect(state2.alarmEnabled).toBe(false);

    const state3 = formStateFromValues({
      title: 'Car Service',
      category: 'vehicle',
      recurrence: { type: 'interval', interval: 90, intervalUnit: 'days' },
      freq: 'Every 90 days',
      finance: false,
    });
    expect(state3.title).toBe('Car Service');
    expect(state3.alarmEnabled).toBe(false);
  });

  it('manages alarmEnabled state consistency across parsed, values, task, and category changes', () => {
    // 1. formStateFromParsed with explicit alarmEnabled true
    const parsedAlarmOn = formStateFromParsed({
      title: 'Wake up',
      category: 'personal',
      recurrence: { type: 'daily' },
      frequencyLabel: 'Daily',
      alarmEnabled: true,
    });
    expect(parsedAlarmOn.alarmEnabled).toBe(true);

    // 2. formStateFromParsed with explicit alarmEnabled false
    const parsedAlarmOff = formStateFromParsed({
      title: 'BP Tablets',
      category: 'medicines',
      recurrence: { type: 'daily' },
      frequencyLabel: 'Daily',
      alarmEnabled: false,
    });
    expect(parsedAlarmOff.alarmEnabled).toBe(false);

    // 3. formStateFromValues defaults medicines to true if unspecified
    const medValues = formStateFromValues({
      title: 'Insulin',
      category: 'medicines',
      recurrence: { type: 'daily' },
      freq: 'Daily',
      finance: false,
    });
    expect(medValues.alarmEnabled).toBe(true);

    // 4. formStateFromValues preserves explicit false for medicines
    const medValuesOff = formStateFromValues({
      title: 'Vitamins',
      category: 'medicines',
      recurrence: { type: 'daily' },
      freq: 'Daily',
      finance: false,
      alarmEnabled: false,
    });
    expect(medValuesOff.alarmEnabled).toBe(false);

    // 5. applyCategoryChange switches alarm to true when category becomes medicines
    const baseState = defaultFormState('home');
    expect(baseState.alarmEnabled).toBe(false);
    const medState = applyCategoryChange(baseState, 'medicines');
    expect(medState.alarmEnabled).toBe(true);
  });

  it('preserves alarmEnabled throughout full create -> save -> open edit -> update -> re-open lifecycle', () => {
    // 1. User starts Add Task form and enables Alarm Mode
    const createFormState = defaultFormState('home');
    createFormState.title = 'Morning Workout';
    createFormState.alarmEnabled = true;
    createFormState.reminderTime = '06:30';

    // 2. Form state is converted to submit values (as done in AddTaskSheet and add.tsx)
    const submitValues = formStateToValues(createFormState, 'en');
    expect(submitValues.alarmEnabled).toBe(true);

    // 3. Task is created via createTaskFromParsed (with alarmEnabled passed)
    const createdTask = createTaskFromParsed(
      {
        title: submitValues.title,
        frequencyLabel: submitValues.freq,
        recurrence: submitValues.recurrence,
        category: submitValues.category,
        reminderTime: submitValues.reminderTime,
        timesPerDay: submitValues.timesPerDay,
        reminderTimes: submitValues.reminderTimes,
        startDate: submitValues.startDate,
        alarmEnabled: submitValues.alarmEnabled,
      },
      { finance: submitValues.finance, shared: [] }
    );
    expect(createdTask.alarmEnabled).toBe(true);

    // 4. User opens Edit Sheet -> initial values extracted via taskToFormValues
    const editInitialValues = taskToFormValues(createdTask, 'en');
    expect(editInitialValues.alarmEnabled).toBe(true);

    // 5. Edit TaskFormSheet initializes formStateFromValues
    const editFormState = formStateFromValues(editInitialValues);
    expect(editFormState.alarmEnabled).toBe(true);

    // 6. User edits task title and saves
    editFormState.title = 'Morning Cardio & Workout';
    const updatedValues = formStateToValues(editFormState, 'en');
    expect(updatedValues.alarmEnabled).toBe(true);

    const updatedTask = updateTaskDetails(createdTask, updatedValues);
    expect(updatedTask.alarmEnabled).toBe(true);
    expect(updatedTask.title).toBe('Morning Cardio & Workout');

    // 7. User re-opens edit on updated task
    const reOpenInitial = taskToFormValues(updatedTask, 'en');
    expect(reOpenInitial.alarmEnabled).toBe(true);
    const reOpenState = formStateFromValues(reOpenInitial);
    expect(reOpenState.alarmEnabled).toBe(true);
  });

  it('applyCategoryChange updates defaults and limits allowed recurrence types', () => {
    const state = defaultFormState('bills');
    const newState = applyCategoryChange(state, 'vehicle');
    expect(newState.category).toBe('vehicle');
  });

  it('formStateToValues transforms state into submit values', () => {
    const state = defaultFormState('bills');
    state.title = '  Wifi Bill  ';
    state.finance = true;
    state.amountText = 'Rs 999';

    const values = formStateToValues(state, 'en');
    expect(values.title).toBe('Wifi Bill');
    expect(values.amount).toBe(999);
  });

  it('formStateFromLegacyFreq converts string frequency into state', () => {
    const state = formStateFromLegacyFreq('Milk', 'Daily', 'home');
    expect(state.title).toBe('Milk');
    expect(state.recurrenceType).toBe('daily');
  });

  it('validateFormState checks title, amount, interval validations', () => {
    const dummyTranslate = (k: string) => k;
    const state = defaultFormState('bills');

    state.title = 'A'; // too short
    state.finance = true;
    state.amountText = ''; // required
    state.recurrenceType = 'interval';
    state.interval = 0;

    const errors = validateFormState(state, dummyTranslate);
    expect(errors.title).toBe('presetTitleRequired');
    expect(errors.amount).toBe('amountRequired');
    expect(errors.recurrence).toBe('intervalRequired');
  });

  it('dayOfMonthOptions and intervalPresets return configuration arrays', () => {
    expect(dayOfMonthOptions()).toHaveLength(28);
    expect(intervalPresets('vehicle')).toEqual([3, 6, 12]);
    expect(intervalPresets('home')).toEqual([7, 15, 30, 90]);
  });

  it('findSchedulingConflicts detects conflicts within 30 minutes on matching recurrence', () => {
    const task1 = createTaskFromPreset('Task 1', 'bills', 'Daily');
    task1.reminderTime = '09:00';
    task1.recurrence = { type: 'daily' };

    const state: TaskFormState = {
      ...defaultFormState('bills'),
      recurrenceType: 'daily',
      reminderTime: '09:15',
    };

    const conflicts = findSchedulingConflicts(state, [task1]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe(task1.id);
  });

  it('formStateToValues and formStateFromTask preserve household scope and chore rotation', () => {
    const state = defaultFormState('home');
    state.title = 'Clean Balcony';
    state.householdId = 'hh-home-1';
    state.assignedTo = 'user-malay';
    state.isRotating = true;
    state.rotationMembers = ['user-malay', 'user-sarah'];

    const values = formStateToValues(state, 'en');
    expect(values.householdId).toBe('hh-home-1');
    expect(values.assignedTo).toBe('user-malay');
    expect(values.isRotating).toBe(true);
    expect(values.rotationMembers).toEqual(['user-malay', 'user-sarah']);

    const task = createTaskFromPreset('Clean Balcony', 'home', 'Weekly');
    task.householdId = 'hh-home-1';
    task.assignedTo = 'user-sarah';
    task.isRotating = true;
    task.rotationMembers = ['user-sarah', 'user-malay'];

    const restoredState = formStateFromTask(task);
    expect(restoredState.householdId).toBe('hh-home-1');
    expect(restoredState.assignedTo).toBe('user-sarah');
    expect(restoredState.isRotating).toBe(true);
    expect(restoredState.rotationMembers).toEqual(['user-sarah', 'user-malay']);
  });

  it('validateSmartTitle validates pure numbers, frequencies, symbols, and length', () => {
    // Empty
    expect(validateSmartTitle('').isValid).toBe(false);
    expect(validateSmartTitle('   ').isValid).toBe(false);

    // Too short
    expect(validateSmartTitle('A').isValid).toBe(false);

    // Pure numbers
    const numRes = validateSmartTitle('15000');
    expect(numRes.isValid).toBe(false);
    expect(numRes.error).toContain('15000');

    // Pure frequency without task name
    const freqRes = validateSmartTitle('daily');
    expect(freqRes.isValid).toBe(false);

    // Valid title
    expect(validateSmartTitle('Water plants').isValid).toBe(true);
    expect(validateSmartTitle('किराया 15000', 'hi').isValid).toBe(true);
  });

  it('defaultFormState initializes startDate and reminderTime with current local date and time', () => {
    const state = defaultFormState('bills');
    const todayStr = new Date().toISOString().slice(0, 10);
    expect(state.startDate).toBe(todayStr);
    expect(state.reminderTime).toMatch(/^\d{2}:\d{2}$/);
    expect(state.reminderTimes).toContain(state.reminderTime);
  });

  it('alarmEnabled defaults correctly and preserves through form conversions', () => {
    // Medicine defaults to alarmEnabled: true
    const medState = defaultFormState('medicines');
    expect(medState.alarmEnabled).toBe(true);

    // Bills default to alarmEnabled: false
    const billState = defaultFormState('bills');
    expect(billState.alarmEnabled).toBe(false);

    // formStateToValues preserves alarmEnabled
    medState.title = 'Blood pressure med';
    const values = formStateToValues(medState, 'en');
    expect(values.alarmEnabled).toBe(true);

    // formStateFromValues reads alarmEnabled
    const restored = formStateFromValues(values);
    expect(restored.alarmEnabled).toBe(true);

    // Explicitly toggle off
    restored.alarmEnabled = false;
    const toggledValues = formStateToValues(restored, 'en');
    expect(toggledValues.alarmEnabled).toBe(false);
  });
});

