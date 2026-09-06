import { describe, expect, it } from 'vitest';
import { NetworkProvider, useNetwork, useNetworkStatus } from '@/providers/NetworkProvider';

describe('providers/NetworkProvider', () => {
  it('exports NetworkProvider component and network hooks', () => {
    expect(typeof NetworkProvider).toBe('function');
    expect(typeof useNetwork).toBe('function');
    expect(typeof useNetworkStatus).toBe('function');
  });
});
