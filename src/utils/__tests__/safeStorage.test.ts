import { describe, expect, it } from 'vitest';
import { safeJsonParse, StorageError, withError } from '@/utils/safeStorage';

describe('utils/safeStorage', () => {
  it('safeJsonParse returns parsed value or fallback', () => {
    expect(safeJsonParse(null, { default: true })).toEqual({ default: true });
    expect(safeJsonParse('{"a":1}', { default: true })).toEqual({ a: 1 });
    expect(safeJsonParse('invalid-json', { default: true })).toEqual({ default: true });
  });

  it('withError wraps thrown errors in StorageError', async () => {
    const success = await withError(async () => 'ok', 'failed');
    expect(success).toBe('ok');

    await expect(
      withError(async () => {
        throw new Error('inner failure');
      }, 'Operation failed')
    ).rejects.toThrow(StorageError);
  });
});
