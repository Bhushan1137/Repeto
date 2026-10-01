import { describe, expect, it } from 'vitest';
import {
  createTaskFromPreset,
  createTaskFromPresetConfig,
  type PresetTaskConfig,
} from '@/domain/task';
import { getAllPresets, presetToFormValues } from '@/domain/preset';
import { CATEGORIES } from '@/constants/categories';

describe('Preset Library & Bulk Creation Domain Engine', () => {
  it('creates task from preset with optional householdId', () => {
    const task = createTaskFromPreset(
      'Daily Milk Delivery',
      'supplies',
      'Every day',
      1800,
      true,
      '🥛',
      'Aman',
      'hh-123'
    );

    expect(task.title).toBe('Daily Milk Delivery');
    expect(task.category).toBe('supplies');
    expect(task.householdId).toBe('hh-123');
    expect(task.amount).toBe(1800);
    expect(task.finance).toBe(true);
    expect(task.icon).toBe('🥛');
    expect(task.creatorName).toBe('Aman');
    expect(task.recurrence.type).toBe('daily');
    expect(task.id).toBeTruthy();
    expect(task.nextDueDate).toBeTruthy();
  });

  it('creates task from PresetTaskConfig with custom schedule and reminder time', () => {
    const config: PresetTaskConfig = {
      title: 'AC Servicing & Filter Cleaning',
      category: 'maintenance',
      freq: 'Every 6 months',
      recurrence: { type: 'interval', interval: 6, intervalUnit: 'months' },
      reminderTime: '10:30',
      amount: 1500,
      finance: true,
      icon: '❄️',
      assignedTo: 'user-456',
      householdId: 'hh-home',
      note: 'Call Urban Company technician',
    };

    const task = createTaskFromPresetConfig(config, 'Malay', 'fallback-hh');

    expect(task.title).toBe('AC Servicing & Filter Cleaning');
    expect(task.category).toBe('maintenance');
    expect(task.householdId).toBe('hh-home');
    expect(task.recurrence).toEqual({ type: 'interval', interval: 6, intervalUnit: 'months' });
    expect(task.reminderTime).toBe('10:30');
    expect(task.amount).toBe(1500);
    expect(task.finance).toBe(true);
    expect(task.assignedTo).toBe('user-456');
    expect(task.note).toBe('Call Urban Company technician');
    expect(task.creatorName).toBe('Malay');
  });

  it('falls back to fallbackHouseholdId if config.householdId is undefined', () => {
    const config: PresetTaskConfig = {
      title: 'Water balcony plants',
      category: 'gardening',
      freq: 'Every day',
    };

    const task = createTaskFromPresetConfig(config, 'Malay', 'active-hh-789');
    expect(task.householdId).toBe('active-hh-789');
  });

  it('sets alarmEnabled to true for medicines category by default', () => {
    const medConfig: PresetTaskConfig = {
      title: 'BP Medicine',
      category: 'medicines',
      freq: 'Every day',
    };
    const medTask = createTaskFromPresetConfig(medConfig);
    expect(medTask.alarmEnabled).toBe(true);

    const docConfig: PresetTaskConfig = {
      title: 'FASTag Recharge',
      category: 'documents',
      freq: 'Every month',
    };
    const docTask = createTaskFromPresetConfig(docConfig);
    expect(docTask.alarmEnabled).toBe(false);
  });

  it('verifies all 20 categories exist and are covered in getAllPresets', () => {
    const allPresets = getAllPresets();
    expect(allPresets.length).toBeGreaterThan(60);

    const presetCategories = new Set(allPresets.map((p) => p.category));
    for (const cat of CATEGORIES) {
      expect(presetCategories.has(cat.key)).toBe(true);
    }
  });

  it('verifies presetToFormValues converts presets properly without losing data', () => {
    const allPresets = getAllPresets();
    const lpgPreset = allPresets.find((p) => p.category === 'supplies' && p.title.includes('LPG'));
    expect(lpgPreset).toBeDefined();

    if (lpgPreset) {
      const formEn = presetToFormValues(lpgPreset, 'en');
      expect(formEn.title).toBe(lpgPreset.title);
      expect(formEn.category).toBe('supplies');
      expect(formEn.amount).toBe(lpgPreset.amount);

      const formHi = presetToFormValues(lpgPreset, 'hi');
      expect(formHi.title).toBe(lpgPreset.titleHi);
      expect(formHi.category).toBe('supplies');
    }
  });
});
