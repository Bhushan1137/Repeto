import { describe, it, expect } from 'vitest';
import { forFirestore } from '@/services/firebase/firestore';

describe('forFirestore recursive sanitization', () => {
  it('removes top-level undefined fields', () => {
    const input = { a: 'hello', b: undefined, c: 42 };
    expect(forFirestore(input)).toEqual({ a: 'hello', c: 42 });
  });

  it('removes nested undefined fields inside objects', () => {
    const input = {
      task: {
        title: 'Task 1',
        recurrence: {
          type: 'monthly',
          interval: undefined,
          dayOfMonth: 15,
        },
      },
    };
    expect(forFirestore(input)).toEqual({
      task: {
        title: 'Task 1',
        recurrence: {
          type: 'monthly',
          dayOfMonth: 15,
        },
      },
    });
  });

  it('removes undefined fields inside arrays of objects', () => {
    const input = {
      sharedWith: [
        { name: 'Alice', phone: '12345', userId: undefined },
        { name: 'Bob', phone: '67890', userId: 'user-bob' },
      ],
    };
    expect(forFirestore(input)).toEqual({
      sharedWith: [
        { name: 'Alice', phone: '12345' },
        { name: 'Bob', phone: '67890', userId: 'user-bob' },
      ],
    });
  });

  it('preserves null and primitives', () => {
    const input = {
      assignedTo: null,
      count: 0,
      active: false,
      emptyString: '',
    };
    expect(forFirestore(input)).toEqual({
      assignedTo: null,
      count: 0,
      active: false,
      emptyString: '',
    });
  });
});
