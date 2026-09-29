import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Platform } from 'react-native';

vi.mock('@/components/AppIcon', () => ({
  AppIcon: () => null,
}));

import { AlarmToggleRow } from '@/components/taskForm/AlarmToggleRow';

describe('components/taskForm/AlarmToggleRow', () => {
  beforeEach(() => {
    Platform.OS = 'android';
  });

  it('exports AlarmToggleRow component', () => {
    expect(typeof AlarmToggleRow).toBe('function');
  });

  it('renders null when Platform.OS is ios', () => {
    Platform.OS = 'ios';
    const result = AlarmToggleRow({ value: true, onChange: () => {} });
    expect(result).toBeNull();
  });

  it('renders element tree when Platform.OS is android and value is true', () => {
    Platform.OS = 'android';
    const result = AlarmToggleRow({ value: true, onChange: () => {}, language: 'en' });
    expect(result).not.toBeNull();
    expect(result?.type).toBeDefined();
  });

  it('renders element tree when Platform.OS is android and value is false', () => {
    Platform.OS = 'android';
    const result = AlarmToggleRow({ value: false, onChange: () => {}, language: 'hi' });
    expect(result).not.toBeNull();
    expect(result?.type).toBeDefined();
  });
});
