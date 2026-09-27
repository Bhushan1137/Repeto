const FUNCTIONS_BASE_URL =
  process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_URL ||
  'https://asia-south1-repeto-ff21c.cloudfunctions.net';

const CLIENT_SECRET = 'repeto-mobile-auth-v1';

export interface OtpSendResult {
  ok: boolean;
  code?: string;
  token?: string;
  cooldownSeconds?: number;
  message?: string;
}

export interface OtpVerifyResult {
  ok: boolean;
  verified?: boolean;
  token?: string;
  remainingAttempts?: number;
  message?: string;
}

async function safeParseResponse(res: Response): Promise<Record<string, any>> {
  if (typeof res.json === 'function') {
    try {
      const parsed = await res.json();
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // json parsing failed, fall through to text if available
    }
  }
  if (typeof res.text === 'function') {
    try {
      const text = await res.text();
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Dispatches an email OTP for sign-up verification.
 */
export async function requestSignupOtp(email: string): Promise<OtpSendResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const endpoint = `${FUNCTIONS_BASE_URL}/sendSignupOtp`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-repeto-client-secret': CLIENT_SECRET,
      },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    const data = await safeParseResponse(res);

    if (!res.ok || !data.ok) {
      return {
        ok: false,
        code: data.code,
        cooldownSeconds: data.cooldownSeconds,
        message: data.message || 'Failed to send verification code. Please try again.',
      };
    }

    return {
      ok: true,
      token: data.token,
      cooldownSeconds: data.cooldownSeconds || 60,
      message: data.message,
    };
  } catch (err: unknown) {
    console.warn('[Repeto OTP Service] Network error calling sendSignupOtp:', err);

    // Development offline fallback if Cloud Function is not yet deployed
    if (__DEV__) {
      console.log('[Repeto OTP Dev Fallback] Simulating OTP send for:', normalizedEmail);
      const devExpiresAt = Date.now() + 5 * 60 * 1000;
      return {
        ok: true,
        // Token format must be 4 dot-separated parts: expiresAt.attempts.otpSig.attemptSig
        // The client verifySignupOtp short-circuits on 'dev_mock_sig_a' so it never hits the server
        token: `${devExpiresAt}.0.dev_mock_sig_a.dev_mock_sig_b`,
        cooldownSeconds: 60,
        message: 'Dev Mode: Simulated OTP (use 123456)',
      };
    }

    return {
      ok: false,
      message: 'Network error. Please check your internet connection and try again.',
    };
  }
}

/**
 * Validates a 6-digit OTP against the cryptographic token.
 */
export async function verifySignupOtp(
  email: string,
  otp: string,
  token: string
): Promise<OtpVerifyResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const endpoint = `${FUNCTIONS_BASE_URL}/verifySignupOtp`;

  // Handle dev simulation mode
  if (__DEV__ && token.includes('dev_mock_sig')) {
    if (otp === '123456') {
      return { ok: true, verified: true, message: 'Verified in Dev Mode' };
    }
    return { ok: false, message: 'Dev Mode: Please enter code 123456' };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-repeto-client-secret': CLIENT_SECRET,
      },
      body: JSON.stringify({
        email: normalizedEmail,
        otp: otp.trim(),
        token,
      }),
    });

    const data = await safeParseResponse(res);

    if (!res.ok || !data.ok) {
      return {
        ok: false,
        verified: false,
        token: data.token || token,
        remainingAttempts: data.remainingAttempts,
        message: data.message || 'Verification failed. Please check the code.',
      };
    }

    return {
      ok: true,
      verified: true,
      message: data.message || 'Email successfully verified!',
    };
  } catch (err: unknown) {
    console.warn('[Repeto OTP Service] Network error calling verifySignupOtp:', err);
    return {
      ok: false,
      verified: false,
      message: 'Network error verifying code. Please try again.',
    };
  }
}
