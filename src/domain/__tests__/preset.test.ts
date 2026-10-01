import { describe, expect, it } from 'vitest';
import {
  getAllPresets,
  presetToFormValues,
  suggestionToFormValues,
  taskToFormValues,
  formValuesToSuggestionPatch,
  formValuesFromState,
  stateFromFormValues,
  presetFromTaskPreset,
  freqFromValues,
} from '@/domain/preset';
import type { RepeatingTask } from '@/types';
import { defaultFormState } from '@/domain/taskForm';

const mockTask: RepeatingTask = {
  id: 'preset-t1',
  title: 'Gym Membership',
  category: 'health',
  recurrence: { type: 'monthDay', dayOfMonth: 1 },
  frequencyLabel: 'Monthly',
  nextDueDate: '2026-09-01',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  escalationCount: 0,
  finance: true,
  amount: 2500,
  sharedWith: [],
  history: [],
};

describe('preset domain module', () => {
  it('gets all presets', () => {
    const presets = getAllPresets();
    expect(presets.length).toBeGreaterThan(0);
    expect(presets[0]).toHaveProperty('id');
  });

  it('converts preset item to form values in English and Hindi', () => {
    const preset = getAllPresets()[0];
    const valuesEn = presetToFormValues(preset, 'en');
    const valuesHi = presetToFormValues(preset, 'hi');
    expect(valuesEn.title).toBe(preset.title);
    expect(valuesHi.title).toBe(preset.titleHi);
  });

  it('converts suggestion and task to form values', () => {
    const suggestionForm = suggestionToFormValues(
      {
        title: 'Electricity',
        titleHi: 'बिजली का बिल',
        freq: 'Every month',
        freqHi: 'हर महीने',
        category: 'bills',
        accepted: false,
      },
      'en'
    );
    expect(suggestionForm.title).toBe('Electricity');

    const taskForm = taskToFormValues(mockTask, 'en');
    expect(taskForm.title).toBe('Gym Membership');
  });

  it('converts form values to suggestion patch', () => {
    const formVals = taskToFormValues(mockTask, 'en');
    const patchEn = formValuesToSuggestionPatch(formVals, 'en');
    expect(patchEn.accepted).toBe(true);
    expect(patchEn.title).toBe('Gym Membership');

    const patchHi = formValuesToSuggestionPatch(formVals, 'hi');
    expect(patchHi.titleHi).toBe('Gym Membership');
  });

  it('bridges state and form values', () => {
    const state = defaultFormState();
    const vals = formValuesFromState(state, 'en');
    expect(vals.title).toBe('');

    const backToState = stateFromFormValues(vals);
    expect(backToState.title).toBe('');

    const freqStr = freqFromValues(vals, 'en');
    expect(freqStr).toBeDefined();
  });

  it('converts raw task preset', () => {
    const raw = {
      titleEn: 'Cook Salary',
      titleHi: 'रसोइये का वेतन',
      freqEn: 'Every month',
      freqHi: 'हर महीने',
      amount: 5000,
      finance: true,
    };
    const preset = presetFromTaskPreset(raw, 'help');
    expect(preset.title).toBe('Cook Salary');
    expect(preset.category).toBe('help');
  });

  it('contains curated presets for all new Indian categories', () => {
    const allPresets = getAllPresets();
    const categories = ['supplies', 'maintenance', 'documents', 'gardening'] as const;

    for (const cat of categories) {
      const catPresets = allPresets.filter((p) => p.category === cat);
      expect(catPresets.length).toBeGreaterThanOrEqual(4);
      for (const p of catPresets) {
        expect(p.title).toBeTruthy();
        expect(p.titleHi).toBeTruthy();
        expect(p.freq).toBeTruthy();
        expect(p.freqHi).toBeTruthy();
        expect(p.icon).toBeTruthy();

        // Ensure converting to form values doesn't throw
        const valsEn = presetToFormValues(p, 'en');
        expect(valsEn.title).toBe(p.title);
        expect(valsEn.category).toBe(cat);

        const valsHi = presetToFormValues(p, 'hi');
        expect(valsHi.title).toBe(p.titleHi);
        expect(valsHi.category).toBe(cat);
      }
    }
  });
});
