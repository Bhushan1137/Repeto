/**
 * Safe JSON parse with fallback — prevents crashes from corrupted AsyncStorage.
 */
export function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class StorageError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'StorageError';
  }
}

export async function withError<T>(fn: () => Promise<T>, message: string): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    throw new StorageError(message, cause);
  }
}
