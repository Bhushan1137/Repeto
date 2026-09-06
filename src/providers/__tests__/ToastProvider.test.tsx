import { describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from '@/providers/ToastProvider';

describe('providers/ToastProvider', () => {
  it('exports ToastProvider component and useToast hook', () => {
    expect(typeof ToastProvider).toBe('function');
    expect(typeof useToast).toBe('function');
  });
});
