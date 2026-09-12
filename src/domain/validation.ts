const NAME_MIN = 2;
const NAME_MAX = 50;
const PHONE_DIGITS = 10;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN) {
    return { valid: false, error: 'nameTooShort' };
  }
  if (trimmed.length > NAME_MAX) {
    return { valid: false, error: 'nameTooLong' };
  }
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u.test(trimmed)) {
    return { valid: false, error: 'nameInvalid' };
  }
  return { valid: true };
}

export function validatePhone(phone: string, required = true): ValidationResult {
  const trimmed = phone.trim();
  if (!trimmed) {
    return required ? { valid: false, error: 'phoneRequired' } : { valid: true };
  }
  const digits = trimmed.replace(/\D/g, '').slice(-10);
  if (digits.length !== PHONE_DIGITS) {
    return { valid: false, error: 'invalidPhone' };
  }
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return { valid: false, error: 'invalidPhone' };
  }
  return { valid: true };
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  return digits ? `+91 ${digits}` : '';
}

export function validateEmail(email: string): ValidationResult {
  if (!email.trim()) return { valid: false, error: 'emailRequired' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { valid: false, error: 'emailInvalid' };
  }
  return { valid: true };
}
