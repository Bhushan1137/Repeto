import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestSignupOtp, verifySignupOtp } from '@/services/otpService';

describe('OTP Service (requestSignupOtp & verifySignupOtp)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully requests a signup OTP and receives a token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        token: '1727289000000.0.test_signature',
        cooldownSeconds: 60,
        message: 'Verification code sent to your email.',
      }),
    });

    const res = await requestSignupOtp('test@repeato.app');

    expect(res.ok).toBe(true);
    expect(res.token).toBe('1727289000000.0.test_signature');
    expect(res.cooldownSeconds).toBe(60);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sendSignupOtp'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-repeto-client-secret': 'repeto-mobile-auth-v1',
        }),
        body: JSON.stringify({ email: 'test@repeato.app' }),
      })
    );
  });

  it('handles rate-limiting response from server gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        ok: false,
        cooldownSeconds: 45,
        message: 'Please wait 45 seconds before requesting a new code.',
      }),
    });

    const res = await requestSignupOtp('rate_limited@repeato.app');

    expect(res.ok).toBe(false);
    expect(res.cooldownSeconds).toBe(45);
    expect(res.message).toContain('Please wait 45 seconds');
  });

  it('handles existing account response (auth/email-already-in-use) gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        ok: false,
        code: 'auth/email-already-in-use',
        message: 'An account with this email already exists. Please sign in instead.',
      }),
    });

    const res = await requestSignupOtp('existing@repeato.app');

    expect(res.ok).toBe(false);
    expect(res.code).toBe('auth/email-already-in-use');
    expect(res.message).toContain('already exists');
  });

  it('successfully verifies a valid OTP code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        verified: true,
        message: 'Email successfully verified!',
      }),
    });

    const res = await verifySignupOtp(
      'test@repeato.app',
      '482915',
      '1727289000000.0.test_signature'
    );

    expect(res.ok).toBe(true);
    expect(res.verified).toBe(true);
  });

  it('handles incorrect OTP and returns updated token with remaining attempts', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        ok: false,
        verified: false,
        reason: 'incorrect_code',
        token: '1727289000000.1.test_signature',
        remainingAttempts: 2,
        message: 'Incorrect code. 2 attempts remaining.',
      }),
    });

    const res = await verifySignupOtp(
      'test@repeato.app',
      '000000',
      '1727289000000.0.test_signature'
    );

    expect(res.ok).toBe(false);
    expect(res.verified).toBe(false);
    expect(res.remainingAttempts).toBe(2);
    expect(res.token).toBe('1727289000000.1.test_signature');
    expect(res.message).toContain('2 attempts remaining');
  });

  it('simulates OTP verification in dev mode for dev tokens', async () => {
    const devToken = '1727289000000.0.dev_mock_signature';

    const validRes = await verifySignupOtp('dev@repeato.app', '123456', devToken);
    expect(validRes.ok).toBe(true);
    expect(validRes.verified).toBe(true);

    const invalidRes = await verifySignupOtp('dev@repeato.app', '999999', devToken);
    expect(invalidRes.ok).toBe(false);
  });
});
