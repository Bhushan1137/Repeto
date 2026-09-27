"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySignupOtp = exports.sendSignupOtp = void 0;
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
// Lazy Firebase Admin Auth initialization (avoids network/credential discovery overhead during startup)
let authInstance = null;
function getAdminAuth() {
    if (!authInstance) {
        if (!admin.apps.length) {
            admin.initializeApp();
        }
        authInstance = admin.auth();
    }
    return authInstance;
}
(0, v2_1.setGlobalOptions)({ region: 'asia-south1', maxInstances: 5, invoker: 'public' });
// ─── Configuration & Secrets ────────────────────────────────────────────────
const _HMAC_SECRET_ENV = process.env.HMAC_SECRET;
if (!_HMAC_SECRET_ENV && process.env.NODE_ENV !== 'development') {
    // In production this MUST be set via Firebase secret manager; fail loudly so it's caught in CI/deploy logs
    console.error('[Config] CRITICAL: HMAC_SECRET env var is not configured! OTP token security is compromised.');
}
const HMAC_SECRET = _HMAC_SECRET_ENV || 'repeto-default-dev-hmac-secret-key-32chars!';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'repeto-mobile-auth-v1';
const SMTP_EMAIL = process.env.SMTP_EMAIL || '';
const SMTP_APP_PASSWORD = process.env.SMTP_APP_PASSWORD || '';
const OTP_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_REQUESTS_PER_15_MIN = 3;
const MAX_VERIFY_ATTEMPTS = 3;
// ─── Disposable Email Domain Blocklist ───────────────────────────────────────
const DISPOSABLE_DOMAINS = new Set([
    'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
    'yopmail.com', 'trashmail.com', 'dispostable.com', 'sharklasers.com',
    'getairmail.com', 'throwawaymail.com', 'fakeinbox.com', 'temp-mail.org',
    'generator.email', 'dropmail.me', 'inboxkitten.com'
]);
const emailRateLimits = new Map();
const ipRateLimits = new Map();
const ipVerifyLimits = new Map();
const emailFailedVerifyLimits = new Map();
let lastCleanupAt = 0;
// Global daily email quota guard (protects Gmail 500/day limit)
const MAX_GLOBAL_DAILY_EMAILS = 400;
let dailySentCount = 0;
let dailyResetTime = Date.now() + 24 * 60 * 60 * 1000;
function canSendDailyEmail() {
    const now = Date.now();
    if (now > dailyResetTime) {
        dailySentCount = 0;
        dailyResetTime = now + 24 * 60 * 60 * 1000;
    }
    return dailySentCount < MAX_GLOBAL_DAILY_EMAILS;
}
// Lazy cleanup of stale rate limits (prevents background timers during deployment/discovery)
function cleanupStaleLimits(now) {
    if (now - lastCleanupAt < 5 * 60 * 1000)
        return;
    lastCleanupAt = now;
    for (const [email, record] of emailRateLimits.entries()) {
        record.timestamps = record.timestamps.filter((t) => now - t < 15 * 60 * 1000);
        if (record.timestamps.length === 0 && now - record.lastSentAt > 15 * 60 * 1000) {
            emailRateLimits.delete(email);
        }
    }
    for (const [ip, record] of ipRateLimits.entries()) {
        record.timestamps = record.timestamps.filter((t) => now - t < 10 * 60 * 1000);
        if (record.timestamps.length === 0) {
            ipRateLimits.delete(ip);
        }
    }
    for (const [ip, record] of ipVerifyLimits.entries()) {
        record.timestamps = record.timestamps.filter((t) => now - t < 5 * 60 * 1000);
        if (record.timestamps.length === 0) {
            ipVerifyLimits.delete(ip);
        }
    }
    for (const [email, record] of emailFailedVerifyLimits.entries()) {
        if (now - record.firstFailedAt > 10 * 60 * 1000) {
            emailFailedVerifyLimits.delete(email);
        }
    }
}
// ─── Helper Functions ────────────────────────────────────────────────────────
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
}
function isValidEmail(email) {
    if (!email || email.length > 254)
        return false;
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
    if (!emailRegex.test(email))
        return false;
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || DISPOSABLE_DOMAINS.has(domain))
        return false;
    return true;
}
function computeOtpSig(email, otp, expiresAt) {
    const data = `${email.toLowerCase()}:${otp}:${expiresAt}`;
    return crypto.createHmac('sha256', HMAC_SECRET).update(data).digest('hex');
}
function computeAttemptSig(email, expiresAt, attempts, otpSig) {
    const data = `${email.toLowerCase()}:${expiresAt}:${attempts}:${otpSig}`;
    return crypto.createHmac('sha256', HMAC_SECRET).update(data).digest('hex');
}
function generateOtpToken(email, otp, expiresAt, attempts = 0) {
    const otpSig = computeOtpSig(email, otp, expiresAt);
    const attemptSig = computeAttemptSig(email, expiresAt, attempts, otpSig);
    return `${expiresAt}.${attempts}.${otpSig}.${attemptSig}`;
}
function verifyOtpToken(email, otp, token) {
    const parts = token.split('.');
    if (parts.length !== 4) {
        return { valid: false, reason: 'invalid_token_format', attempts: 0, expiresAt: 0 };
    }
    const expiresAt = parseInt(parts[0], 10);
    const attempts = parseInt(parts[1], 10);
    const otpSig = parts[2];
    const attemptSig = parts[3];
    if (Number.isNaN(expiresAt) || Number.isNaN(attempts) || !otpSig || !attemptSig) {
        return { valid: false, reason: 'malformed_token', attempts, expiresAt };
    }
    // 1. Verify Attempt Signature (prevents tampering with attempt count or expiration)
    const expectedAttemptSig = computeAttemptSig(email, expiresAt, attempts, otpSig);
    const attemptSigBuf = Buffer.from(attemptSig, 'hex');
    const expectedAttemptSigBuf = Buffer.from(expectedAttemptSig, 'hex');
    if (attemptSigBuf.length !== expectedAttemptSigBuf.length ||
        !crypto.timingSafeEqual(attemptSigBuf, expectedAttemptSigBuf)) {
        return { valid: false, reason: 'tampered_token', attempts, expiresAt };
    }
    // 2. Check Expiration
    if (Date.now() > expiresAt) {
        return { valid: false, reason: 'expired', attempts, expiresAt };
    }
    // 3. Check Attempt Threshold
    if (attempts >= MAX_VERIFY_ATTEMPTS) {
        return { valid: false, reason: 'max_attempts_exceeded', attempts, expiresAt };
    }
    // 4. Verify OTP Code
    const expectedOtpSig = computeOtpSig(email, otp, expiresAt);
    const otpSigBuf = Buffer.from(otpSig, 'hex');
    const expectedOtpSigBuf = Buffer.from(expectedOtpSig, 'hex');
    if (otpSigBuf.length !== expectedOtpSigBuf.length ||
        !crypto.timingSafeEqual(otpSigBuf, expectedOtpSigBuf)) {
        const nextAttempts = attempts + 1;
        const remaining = MAX_VERIFY_ATTEMPTS - nextAttempts;
        if (remaining <= 0) {
            return { valid: false, reason: 'max_attempts_exceeded', attempts: nextAttempts, expiresAt };
        }
        const nextAttemptSig = computeAttemptSig(email, expiresAt, nextAttempts, otpSig);
        const nextToken = `${expiresAt}.${nextAttempts}.${otpSig}.${nextAttemptSig}`;
        return {
            valid: false,
            reason: 'incorrect_code',
            attempts: nextAttempts,
            remainingAttempts: remaining,
            nextToken,
            expiresAt,
        };
    }
    return { valid: true, attempts, expiresAt };
}
// ─── Branded HTML Email Template ─────────────────────────────────────────────
function buildOtpEmailHtml(otp) {
    return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Repeto Verification Code</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0E1122; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0E1122; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table width="100%" max-width="480" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #171B36; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);">
            <!-- Header -->
            <tr>
              <td style="padding: 32px 32px 16px 32px; text-align: center;">
                <h1 style="margin: 0; color: #E8A33D; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Repeto</h1>
                <p style="margin: 6px 0 0 0; color: #9BA3C7; font-size: 13px; font-weight: 500;">Never forget what repeats</p>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding: 0 32px;">
                <hr style="border: 0; height: 1px; background-color: rgba(255, 255, 255, 0.08); margin: 0;">
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding: 28px 32px 32px 32px; text-align: center;">
                <h2 style="margin: 0 0 10px 0; color: #FFFFFF; font-size: 18px; font-weight: 700;">Verify Your Email Address</h2>
                <p style="margin: 0 0 24px 0; color: #C5CAE9; font-size: 14px; line-height: 20px;">
                  Welcome to Repeto! Use the 6-digit verification code below to complete creating your account:
                </p>

                <!-- Code Badge -->
                <div style="background-color: #0E1122; border: 1px solid rgba(232, 163, 61, 0.3); border-radius: 12px; padding: 18px; margin: 0 auto 24px auto; display: inline-block;">
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #E8A33D; display: block;">
                    ${otp}
                  </span>
                </div>

                <p style="margin: 0 0 8px 0; color: #9BA3C7; font-size: 13px;">
                  ⏱ This code is valid for <strong>5 minutes</strong>.
                </p>
                <p style="margin: 0; color: #6C7293; font-size: 12px; line-height: 18px;">
                  If you didn't create a Repeto account, you can safely ignore this message.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #12152B; padding: 18px 32px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                <p style="margin: 0; color: #6C7293; font-size: 11px;">
                  &copy; ${new Date().getFullYear()} Repeto. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}
// ─── Endpoint 1: sendSignupOtp ───────────────────────────────────────────────
exports.sendSignupOtp = (0, https_1.onRequest)({
    region: 'asia-south1',
    invoker: 'public',
    cors: true,
    maxInstances: 5,
    secrets: ['SMTP_EMAIL', 'SMTP_APP_PASSWORD', 'HMAC_SECRET'],
}, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, message: 'Method Not Allowed' });
        return;
    }
    // 1. Verify Application Handshake Header (blocks random internet scrapers)
    const clientSecret = req.headers['x-repeto-client-secret'];
    if (clientSecret !== CLIENT_SECRET) {
        res.status(403).json({ ok: false, message: 'Forbidden: unauthorized client origin' });
        return;
    }
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
        res.status(400).json({ ok: false, message: 'Email is required' });
        return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    // 2. Validate Email Format & Disposable Filter
    if (!isValidEmail(normalizedEmail)) {
        res.status(400).json({ ok: false, message: 'Please provide a valid, permanent email address' });
        return;
    }
    const clientIp = getClientIp(req);
    const now = Date.now();
    cleanupStaleLimits(now);
    // 3. IP Rate Limiting (Max 5 requests per IP per 10 minutes)
    const ipRecord = ipRateLimits.get(clientIp) || { timestamps: [] };
    ipRecord.timestamps = ipRecord.timestamps.filter((t) => now - t < 10 * 60 * 1000);
    if (ipRecord.timestamps.length >= 5) {
        res.status(429).json({
            ok: false,
            message: 'Too many requests from this network. Please wait a few minutes before trying again.'
        });
        return;
    }
    ipRecord.timestamps.push(now);
    ipRateLimits.set(clientIp, ipRecord);
    // 4. Validate if email already exists before generating OTP or sending emails
    let userExists = false;
    // 4A: Check Firebase Admin Auth (single source of truth for all Firebase accounts)
    try {
        const auth = getAdminAuth();
        const existingUser = await auth.getUserByEmail(normalizedEmail);
        if (existingUser && existingUser.uid) {
            userExists = true;
        }
    }
    catch (authErr) {
        if (authErr?.code === 'auth/user-not-found') {
            // Confirmed: User does not exist in Firebase Auth
            userExists = false;
        }
        else {
            console.error('[sendSignupOtp] Firebase Auth user lookup error:', authErr?.message || authErr);
            // Service account lacks IAM role (Firebase Authentication Admin) or unexpected server error.
            // FAIL CLOSED to avoid sending unauthorized OTPs or burning Gmail quota!
            res.status(500).json({
                ok: false,
                code: 'auth/verification-unavailable',
                message: 'Unable to verify account status right now. Please ensure server IAM permissions are configured or try again shortly.'
            });
            return;
        }
    }
    // 4B: Secondary check in Firestore /users collection
    if (!userExists) {
        try {
            if (!admin.apps.length) {
                admin.initializeApp();
            }
            const snap = await admin.firestore().collection('users').where('email', '==', normalizedEmail).limit(1).get();
            if (!snap.empty) {
                userExists = true;
            }
        }
        catch (fsErr) {
            console.warn('[sendSignupOtp] Firestore user lookup notice:', fsErr?.message || fsErr);
        }
    }
    if (userExists) {
        res.status(409).json({
            ok: false,
            code: 'auth/email-already-in-use',
            message: 'An account with this email already exists. Please sign in instead.'
        });
        return;
    }
    // 5. Email Rate Limiting (60s cooldown + Max 3 in 15 minutes)
    const emailRecord = emailRateLimits.get(normalizedEmail) || { lastSentAt: 0, timestamps: [] };
    if (now - emailRecord.lastSentAt < RESEND_COOLDOWN_MS) {
        const remainingSec = Math.ceil((RESEND_COOLDOWN_MS - (now - emailRecord.lastSentAt)) / 1000);
        res.status(429).json({
            ok: false,
            message: `Please wait ${remainingSec} seconds before requesting a new code.`,
            cooldownSeconds: remainingSec
        });
        return;
    }
    emailRecord.timestamps = emailRecord.timestamps.filter((t) => now - t < 15 * 60 * 1000);
    if (emailRecord.timestamps.length >= MAX_REQUESTS_PER_15_MIN) {
        res.status(429).json({
            ok: false,
            message: 'Maximum OTP attempts reached for this email. Please try again after 15 minutes.'
        });
        return;
    }
    // 5. Generate Cryptographic 6-Digit Code
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = now + OTP_VALIDITY_MS;
    const token = generateOtpToken(normalizedEmail, otpCode, expiresAt, 0);
    // Update email rate records
    emailRecord.lastSentAt = now;
    emailRecord.timestamps.push(now);
    emailRateLimits.set(normalizedEmail, emailRecord);
    // 6. Send Email via Gmail SMTP
    const smtpEmail = process.env.SMTP_EMAIL || SMTP_EMAIL;
    const smtpPassword = process.env.SMTP_APP_PASSWORD || SMTP_APP_PASSWORD;
    if (!smtpEmail || !smtpPassword) {
        // In local development or missing SMTP credentials, log the OTP safely
        console.warn(`[Repeto OTP Service] Missing SMTP credentials! Development OTP for ${normalizedEmail}: ${otpCode}`);
        res.status(200).json({
            ok: true,
            token,
            cooldownSeconds: 60,
            devMode: true,
            message: 'Verification code generated (Dev mode).'
        });
        return;
    }
    if (!canSendDailyEmail()) {
        res.status(429).json({
            ok: false,
            message: 'Daily sign-up capacity reached. Please try again tomorrow or contact support.'
        });
        return;
    }
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: smtpEmail,
                pass: smtpPassword,
            },
        });
        await transporter.sendMail({
            from: `"Repeto" <${smtpEmail}>`,
            to: normalizedEmail,
            subject: `${otpCode} is your Repeto verification code`,
            text: `Your Repeto verification code is: ${otpCode}. It will expire in 5 minutes.`,
            html: buildOtpEmailHtml(otpCode),
        });
        dailySentCount += 1;
        res.status(200).json({
            ok: true,
            token,
            cooldownSeconds: 60,
            message: 'Verification code sent to your email.'
        });
    }
    catch (error) {
        console.error('[Repeto OTP Service] Failed to send email via SMTP:', error);
        // Roll back rate limit so user is not penalized for an infrastructure delivery failure
        emailRecord.timestamps.pop();
        emailRecord.lastSentAt = emailRecord.timestamps[emailRecord.timestamps.length - 1] || 0;
        res.status(500).json({
            ok: false,
            message: 'Failed to deliver verification email. Please check your email address or try again shortly.'
        });
    }
});
// ─── Endpoint 2: verifySignupOtp ─────────────────────────────────────────────
exports.verifySignupOtp = (0, https_1.onRequest)({
    region: 'asia-south1',
    invoker: 'public',
    cors: true,
    maxInstances: 5,
    secrets: ['HMAC_SECRET'],
}, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, message: 'Method Not Allowed' });
        return;
    }
    const clientSecret = req.headers['x-repeto-client-secret'];
    if (clientSecret !== CLIENT_SECRET) {
        res.status(403).json({ ok: false, message: 'Forbidden' });
        return;
    }
    const { email, otp, token } = req.body || {};
    if (!email || !otp || !token) {
        res.status(400).json({ ok: false, message: 'Email, OTP, and token are required' });
        return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.toString().trim();
    const clientIp = getClientIp(req);
    const now = Date.now();
    cleanupStaleLimits(now);
    // 1. IP Rate Limiting for Verification (Max 15 verify calls per IP per 5 minutes)
    const ipRecord = ipVerifyLimits.get(clientIp) || { timestamps: [] };
    ipRecord.timestamps = ipRecord.timestamps.filter((t) => now - t < 5 * 60 * 1000);
    if (ipRecord.timestamps.length >= 15) {
        res.status(429).json({
            ok: false,
            message: 'Too many verification attempts from this network. Please wait a few minutes.'
        });
        return;
    }
    ipRecord.timestamps.push(now);
    ipVerifyLimits.set(clientIp, ipRecord);
    // 2. Email Failed-Attempts Limiter (Max 5 failed attempts per email across all tokens)
    const emailFailedRecord = emailFailedVerifyLimits.get(normalizedEmail);
    if (emailFailedRecord && emailFailedRecord.count >= 5) {
        if (now - emailFailedRecord.firstFailedAt < 10 * 60 * 1000) {
            res.status(429).json({
                ok: false,
                message: 'Too many failed verification attempts for this email. Please request a new code after 10 minutes.'
            });
            return;
        }
        emailFailedVerifyLimits.delete(normalizedEmail);
    }
    const result = verifyOtpToken(normalizedEmail, normalizedOtp, token);
    if (result.valid) {
        // Successfully verified! Clear email rate limits and failed counters
        emailRateLimits.delete(normalizedEmail);
        emailFailedVerifyLimits.delete(normalizedEmail);
        res.status(200).json({
            ok: true,
            verified: true,
            message: 'Email successfully verified!'
        });
        return;
    }
    // Record failed verification attempt for email
    const existingFail = emailFailedVerifyLimits.get(normalizedEmail) || { count: 0, firstFailedAt: now };
    existingFail.count += 1;
    emailFailedVerifyLimits.set(normalizedEmail, existingFail);
    // Handle specific failure reasons
    if (result.reason === 'expired') {
        res.status(400).json({
            ok: false,
            reason: 'expired',
            message: 'Verification code has expired. Please request a new one.'
        });
        return;
    }
    if (result.reason === 'max_attempts_exceeded') {
        res.status(400).json({
            ok: false,
            reason: 'max_attempts_exceeded',
            message: 'Too many incorrect attempts. Please request a new code.'
        });
        return;
    }
    if (result.reason === 'incorrect_code') {
        const remaining = result.remainingAttempts ?? 0;
        res.status(400).json({
            ok: false,
            reason: 'incorrect_code',
            token: result.nextToken,
            remainingAttempts: remaining,
            message: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        });
        return;
    }
    res.status(400).json({
        ok: false,
        message: 'Invalid verification token. Please request a new code.'
    });
});
//# sourceMappingURL=index.js.map