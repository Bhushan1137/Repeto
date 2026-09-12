import { describe, expect, it } from 'vitest';
import {
  formatPhone,
  validateEmail,
  validateName,
  validatePhone,
} from '@/domain/validation';

describe('domain/validation', () => {
  it('validateName validates length and unicode characters', () => {
    expect(validateName('A')).toEqual({ valid: false, error: 'nameTooShort' });
    expect(validateName('A'.repeat(51))).toEqual({ valid: false, error: 'nameTooLong' });
    expect(validateName('Invalid@Name!')).toEqual({ valid: false, error: 'nameInvalid' });
    expect(validateName('Malay Mahajan')).toEqual({ valid: true });
    expect(validateName('राहुल शर्मा')).toEqual({ valid: true });
  });

  it('validatePhone validates empty or 10-digit Indian phone numbers starting with 6-9', () => {
    expect(validatePhone('', true)).toEqual({ valid: false, error: 'phoneRequired' });
    expect(validatePhone('', false)).toEqual({ valid: true });
    expect(validatePhone('9876543210')).toEqual({ valid: true });
    expect(validatePhone('+91 9876543210')).toEqual({ valid: true });
    expect(validatePhone('1234567890')).toEqual({ valid: false, error: 'invalidPhone' });
    expect(validatePhone('98765')).toEqual({ valid: false, error: 'invalidPhone' });
  });

  it('formatPhone formats number with +91 prefix', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('9876543210')).toBe('+91 9876543210');
    expect(formatPhone('+91 9876543210')).toBe('+91 9876543210');
  });

  it('validateEmail validates presence and format', () => {
    expect(validateEmail('')).toEqual({ valid: false, error: 'emailRequired' });
    expect(validateEmail('invalid-email')).toEqual({ valid: false, error: 'emailInvalid' });
    expect(validateEmail('user@example.com')).toEqual({ valid: true });
  });
});
