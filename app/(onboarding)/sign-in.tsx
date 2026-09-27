import { AppIcon } from '@/components/AppIcon';
import { OtpInput } from '@/components/OtpInput';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/providers/AuthProvider';
import { sendPasswordResetEmail } from '@/services/firebase/auth';
import { requestSignupOtp, verifySignupOtp } from '@/services/otpService';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FEATURES = [
  {
    icon: 'calendar-outline',
    title: 'Routines & Reminders',
    description: "Never forget rent, EMIs, monthly bills, or daily medicines. Set them once, and we'll remind you.",
    color: Colors.marigoldDeep,
  },
  {
    icon: 'chatbox-ellipses-outline',
    title: 'Type Like You Talk',
    description: "Just type 'Pay rent on the 5th of every month ₹10000'. Repeto sets it up instantly.",
    color: Colors.tealDeep,
  },
  {
    icon: 'people-outline',
    title: 'Share with Family',
    description: 'Share household chores or bills with family and flatmates. Keep housework stress-free.',
    color: Colors.marigoldDeep,
  },
  {
    icon: 'checkmark-done-outline',
    title: 'Works Offline',
    description: "Mark tasks as done even without internet. They sync automatically when you're online.",
    color: Colors.tealDeep,
  },
] as const;

export default function SignInScreen() {
  const router = useRouter();
  const { language } = useOnboarding();
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const { translate } = useTranslation(language);
  const [agreed, setAgreed] = useState(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Mode: 'signin' | 'signup'
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  // Sign-up OTP verification state
  const [signupStep, setSignupStep] = useState<'form' | 'otp'>('form');
  const [otpToken, setOtpToken] = useState('');
  const [otpVal, setOtpVal] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);

  // Form state
  const [nameVal, setNameVal] = useState('');
  const [emailVal, setEmailVal] = useState('');
  const [passwordVal, setPasswordVal] = useState('');
  const [confirmPassVal, setConfirmPassVal] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [isEmailInUse, setIsEmailInUse] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const isSubmittingRef = useRef(false);

  // Resend countdown timer
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const isLargeScreen = width > 768;

  const handleSwitchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setSignupStep('form');
    setOtpVal('');
    setOtpError('');
    setFormError('');
    setIsEmailInUse(false);
    setResetSent(false);
  };

  const handleSignInSubmit = async () => {
    if (isSubmittingRef.current || loading) return;
    if (!agreed) {
      setFormError(translate('agreeRequired'));
      return;
    }
    const cleanEmail = emailVal.trim().toLowerCase();
    if (!cleanEmail || !passwordVal) {
      setFormError('Please enter your email and password.');
      return;
    }
    isSubmittingRef.current = true;
    setLoading(true);
    setFormError('');
    setResetSent(false);
    try {
      const res = await signInWithEmail(cleanEmail, passwordVal);
      if (res.ok && res.isDeleted) {
        return;
      }
      if (!res.ok) {
        setFormError(res.message || 'Sign-in failed. Please check your credentials.');
      }
    } catch {
      setFormError('Sign-in failed. Please check your connection and try again.');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async () => {
    if (isSubmittingRef.current || loading) return;
    if (!agreed) {
      setFormError(translate('agreeRequired'));
      return;
    }
    const cleanEmail = emailVal.trim().toLowerCase();
    if (!cleanEmail || !passwordVal) {
      setFormError('Please enter your email and password.');
      return;
    }
    if (passwordVal.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }
    if (passwordVal !== confirmPassVal) {
      setFormError('Passwords do not match. Please verify.');
      return;
    }
    isSubmittingRef.current = true;
    setLoading(true);
    setFormError('');
    setIsEmailInUse(false);
    try {
      // 1. Fast client-side probe (zero server invocations if email enumeration protection is off)
      try {
        const { getFirebaseAuth } = await import('@/services/firebase/app');
        const { fetchSignInMethodsForEmail } = await import('firebase/auth');
        const auth = getFirebaseAuth();
        if (auth) {
          const methods = await fetchSignInMethodsForEmail(auth, cleanEmail);
          if (methods && methods.length > 0) {
            setIsEmailInUse(true);
            setFormError('An account with this email already exists. Please sign in instead.');
            return;
          }
        }
      } catch {
        // Fall through to authoritative backend verification
      }

      // 2. Authoritative backend OTP request (validates against Firebase Auth before sending code)
      const res = await requestSignupOtp(cleanEmail);
      if (!res.ok) {
        if (res.code === 'auth/email-already-in-use') {
          setIsEmailInUse(true);
          setFormError('An account with this email already exists. Please sign in instead.');
        } else {
          setFormError(res.message || 'Failed to send verification code. Please try again.');
        }
        return;
      }
      setOtpToken(res.token || '');
      setResendSeconds(res.cooldownSeconds || 60);
      setSignupStep('otp');
      setOtpVal('');
      setOtpError('');
    } catch {
      setFormError('Failed to send verification code. Please check your connection.');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (codeToVerify?: string) => {
    if (isSubmittingRef.current || loading) return;
    const code = (codeToVerify || otpVal).trim();
    if (!code || code.length < 6) {
      setOtpError('Please enter the complete 6-digit code.');
      return;
    }
    isSubmittingRef.current = true;
    setLoading(true);
    setOtpError('');
    try {
      const cleanEmail = emailVal.trim().toLowerCase();
      const verifyRes = await verifySignupOtp(cleanEmail, code, otpToken);
      if (!verifyRes.ok || !verifyRes.verified) {
        if (verifyRes.token) {
          setOtpToken(verifyRes.token);
        }
        setOtpError(verifyRes.message || 'Invalid code. Please try again.');
        return;
      }

      // Code successfully verified! Create Firebase account
      const res = await signUpWithEmail(cleanEmail, passwordVal, nameVal.trim());
      if (!res.ok) {
        setOtpError(res.message || 'Account creation failed. Please try again.');
      }
    } catch {
      setOtpError('Verification failed. Please check your connection and try again.');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendSeconds > 0 || loading) return;
    setLoading(true);
    setOtpError('');
    try {
      const res = await requestSignupOtp(emailVal.trim());
      if (!res.ok) {
        setOtpError(res.message || 'Failed to resend code.');
        return;
      }
      setOtpToken(res.token || '');
      setResendSeconds(res.cooldownSeconds || 60);
      setOtpVal('');
    } catch {
      setOtpError('Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setSignupStep('form');
    setOtpVal('');
    setOtpError('');
  };

  const handleForgotPassword = async () => {
    if (!emailVal.trim()) {
      setFormError('Please enter your email above to receive a reset link.');
      return;
    }
    setLoading(true);
    setFormError('');
    try {
      await sendPasswordResetEmail(emailVal.trim().toLowerCase());
      setResetSent(true);
    } catch {
      setFormError('Failed to send reset email. Please check your email address.');
    } finally {
      setLoading(false);
    }
  };

  const [activeSlide, setActiveSlide] = useState(0);

  // Auto-cycle features slider
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % FEATURES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const currentFeature = FEATURES[activeSlide];

  const handleNextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % FEATURES.length);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.surfaceMuted }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 16) + (keyboardOpen ? 4 : 8),
            paddingBottom: Math.max(insets.bottom, 16) + (keyboardOpen ? 24 : 32),
            justifyContent: 'center',
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={true}
      >
        <View style={[styles.contentWrapper, { maxWidth: isLargeScreen ? 820 : 440 }]}>

          {/* Prominent Brand Header */}
          <View style={[styles.brandHeader, keyboardOpen && !isLargeScreen && styles.brandHeaderCompact]}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={[styles.logoImage, keyboardOpen && !isLargeScreen && styles.logoImageCompact]}
              resizeMode="contain"
            />
            <Text style={[styles.brandTitle, keyboardOpen && !isLargeScreen && styles.brandTitleCompact]}>Repeto</Text>
            {(!keyboardOpen || isLargeScreen) && (
              <Text style={styles.sub}>Never forget what repeats</Text>
            )}
          </View>

          {/* 2. Main Layout Container */}
          <View style={[styles.mainLayout, isLargeScreen && styles.mainLayoutRow]}>

            {/* Left Column (Desktop / Tablet only): Brand & Product Features */}
            {isLargeScreen && (
              <View style={[styles.infoSection, styles.infoSectionLarge]}>
                <View style={styles.sliderContainer}>
                  <Pressable onPress={handleNextSlide} style={styles.slideCard}>
                    <View style={[styles.slideIconContainer, { backgroundColor: currentFeature.color + '15' }]}>
                      <AppIcon name={currentFeature.icon} size={24} color={currentFeature.color} />
                    </View>
                    <View style={styles.slideContent}>
                      <Text style={styles.slideTitle}>{currentFeature.title}</Text>
                      <Text style={styles.slideDesc}>{currentFeature.description}</Text>
                    </View>
                  </Pressable>

                  {/* Pagination Dots */}
                  <View style={styles.dotsRow} testID="signin-dots-container">
                    {FEATURES.map((_, idx) => (
                      <Pressable
                        key={idx}
                        onPress={() => setActiveSlide(idx)}
                        testID={`signin-slide-dot-${idx}`}
                        style={[
                          styles.dot,
                          activeSlide === idx && styles.dotActive
                        ]}
                        hitSlop={8}
                      />
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Right Column / Primary Action Panel */}
            <View style={[styles.actionSection, isLargeScreen && styles.actionSectionLarge]} testID="signin-action-section">
              <View style={styles.actionCard} testID="signin-action-card">

                {mode === 'signup' && signupStep === 'otp' ? (
                  <View style={styles.otpSection}>
                    <Pressable onPress={handleChangeEmail} style={styles.backLinkRow} hitSlop={10} testID="otp-back-btn">
                      <AppIcon name="chevron-back" size={15} color={Colors.tealDeep} />
                      <Text style={styles.backLinkText}>Back to form</Text>
                    </Pressable>

                    <View style={styles.otpBadgeContainer}>
                      <View style={styles.otpIconBadge}>
                        <AppIcon name="mail-open-outline" size={26} color={Colors.tealDeep} />
                      </View>
                    </View>

                    <Text style={styles.cardHeaderTitle} testID="signin-card-title">
                      Verify Your Email
                    </Text>

                    <View style={styles.emailPill}>
                      <AppIcon name="mail-outline" size={13} color={Colors.tealDeep} style={{ marginRight: 6 }} />
                      <Text style={styles.emailPillText} numberOfLines={1}>{emailVal.trim()}</Text>
                      <Pressable onPress={handleChangeEmail} hitSlop={8} style={styles.emailPillEdit}>
                        <AppIcon name="create-outline" size={13} color={Colors.marigoldDeep} />
                      </Pressable>
                    </View>

                    <Text style={styles.otpInstructionText}>
                      Enter the 6-digit verification code sent to your inbox:
                    </Text>

                    <OtpInput
                      length={6}
                      value={otpVal}
                      onChange={(v: string) => {
                        setOtpVal(v);
                        setOtpError('');
                      }}
                      onComplete={(v: string) => handleVerifyAndRegister(v)}
                      disabled={loading}
                      error={Boolean(otpError)}
                    />

                    {otpError ? (
                      <View style={styles.errorAlert} testID="otp-error-text">
                        <AppIcon name="alert-circle-outline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                        <Text style={styles.errorAlertText}>{otpError}</Text>
                      </View>
                    ) : null}

                    <View style={styles.resendRow}>
                      {resendSeconds > 0 ? (
                        <Text style={styles.resendTimerText}>
                          Resend code in{' '}
                          <Text style={{ fontFamily: 'Manrope_700Bold', color: Colors.indigo950 }}>
                            {resendSeconds}s
                          </Text>
                        </Text>
                      ) : (
                        <Pressable onPress={handleResendOtp} disabled={loading} hitSlop={10}>
                          <Text style={styles.resendBtnText}>Resend Code</Text>
                        </Pressable>
                      )}
                    </View>

                    <Pressable
                      testID="otp-submit-btn"
                      onPress={() => handleVerifyAndRegister()}
                      disabled={loading || otpVal.length < 6}
                      style={({ pressed }) => [
                        styles.primaryActionBtn,
                        (loading || otpVal.length < 6) && { opacity: 0.65 },
                        pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                      ]}
                    >
                      <Text style={styles.primaryActionBtnText}>
                        {loading ? 'Verifying…' : 'Verify & Create Account'}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    {/* Premium Segmented Switch */}
                    <View style={styles.segmentedControl}>
                      <Pressable
                        style={[styles.segmentBtn, mode === 'signin' && styles.segmentBtnActive]}
                        onPress={() => handleSwitchMode('signin')}
                      >
                        <Text style={[styles.segmentBtnText, mode === 'signin' && styles.segmentBtnTextActive]}>
                          Sign In
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.segmentBtn, mode === 'signup' && styles.segmentBtnActive]}
                        onPress={() => handleSwitchMode('signup')}
                      >
                        <Text style={[styles.segmentBtnText, mode === 'signup' && styles.segmentBtnTextActive]}>
                          Create Account
                        </Text>
                      </Pressable>
                    </View>

                    <Text style={styles.cardHeaderTitle} testID="signin-card-title">
                      {mode === 'signup' ? 'Start Free with Repeto' : 'Welcome Back'}
                    </Text>
                    {(!keyboardOpen || isLargeScreen) && (
                      <Text style={styles.cardHeaderSub} testID="signin-card-subtitle">
                        {mode === 'signup'
                          ? 'Keep daily routines, chores, and bills organized across all devices.'
                          : 'Sign in with your email to continue where you left off.'}
                      </Text>
                    )}

                    {/* Form Inputs */}
                    <View style={styles.formContainer}>

                      {/* Full Name field (only for signup) */}
                      {mode === 'signup' && (
                        <View style={styles.inputWrapper}>
                          <AppIcon name="person-outline" size={17} color={Colors.inkSoft} style={styles.inputIcon} />
                          <TextInput
                            style={styles.textInput}
                            placeholder="Your name"
                            placeholderTextColor={Colors.inkSoft}
                            value={nameVal}
                            onChangeText={setNameVal}
                            autoCapitalize="words"
                          />
                        </View>
                      )}

                      {/* Email Address */}
                      <View style={styles.inputWrapper}>
                        <AppIcon name="mail-outline" size={17} color={Colors.inkSoft} style={styles.inputIcon} />
                        <TextInput
                          testID="email-input"
                          style={styles.textInput}
                          placeholder="Email address"
                          placeholderTextColor={Colors.inkSoft}
                          value={emailVal}
                          onChangeText={(v) => { setEmailVal(v); setFormError(''); setResetSent(false); setIsEmailInUse(false); }}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          autoComplete="email"
                        />
                      </View>

                      {/* Password */}
                      <View style={styles.inputWrapper}>
                        <AppIcon name="lock-closed-outline" size={17} color={Colors.inkSoft} style={styles.inputIcon} />
                        <TextInput
                          testID="password-input"
                          style={[styles.textInput, { flex: 1 }]}
                          placeholder="Password"
                          placeholderTextColor={Colors.inkSoft}
                          value={passwordVal}
                          onChangeText={(v) => { setPasswordVal(v); setFormError(''); }}
                          secureTextEntry={!showPassword}
                          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        />
                        <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={10} testID="password-toggle">
                          <AppIcon
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={18}
                            color={Colors.inkSoft}
                          />
                        </Pressable>
                      </View>

                      {/* Confirm Password (only for signup) */}
                      {mode === 'signup' && (
                        <View style={styles.inputWrapper}>
                          <AppIcon name="shield-checkmark-outline" size={17} color={Colors.inkSoft} style={styles.inputIcon} />
                          <TextInput
                            style={[styles.textInput, { flex: 1 }]}
                            placeholder="Confirm password"
                            placeholderTextColor={Colors.inkSoft}
                            value={confirmPassVal}
                            onChangeText={(v) => { setConfirmPassVal(v); setFormError(''); }}
                            secureTextEntry={!showConfirmPass}
                            autoComplete="new-password"
                          />
                          <Pressable onPress={() => setShowConfirmPass(v => !v)} hitSlop={10}>
                            <AppIcon
                              name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'}
                              size={18}
                              color={Colors.inkSoft}
                            />
                          </Pressable>
                        </View>
                      )}

                      {/* Password helper */}
                      {mode === 'signup' && (
                        <Text style={styles.hintText}>
                          Password must be at least 6 characters long.
                        </Text>
                      )}

                      {/* Forgot Password Link (for Sign In mode) */}
                      {mode === 'signin' && (
                        <View style={styles.forgotPasswordContainer}>
                          <Pressable
                            testID="forgot-password-btn"
                            onPress={handleForgotPassword}
                            disabled={loading}
                          >
                            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                          </Pressable>
                        </View>
                      )}

                      {/* Error Banner */}
                      {formError ? (
                        <View style={styles.errorAlert} testID="email-error-text">
                          <AppIcon name="alert-circle-outline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.errorAlertText}>{formError}</Text>
                            {isEmailInUse ? (
                              <Pressable
                                onPress={() => {
                                  handleSwitchMode('signin');
                                  setIsEmailInUse(false);
                                }}
                                style={{ marginTop: 6 }}
                                hitSlop={8}
                              >
                                <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 13, color: Colors.indigo950, textDecorationLine: 'underline' }}>
                                  Switch to Sign In with this email →
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      ) : null}

                      {/* Reset Sent Banner */}
                      {resetSent ? (
                        <View style={styles.successAlert} testID="reset-sent-text">
                          <AppIcon name="checkmark-circle-outline" size={16} color={Colors.tealDeep} style={{ marginRight: 6 }} />
                          <Text style={styles.successAlertText}>
                            Password reset link sent! Please check your Inbox and Spam folders.
                          </Text>
                        </View>
                      ) : null}

                      {/* Terms Agreement Checkbox */}
                      <View style={styles.agreeRow} testID="signin-agree-row">
                        <Pressable
                          onPress={() => setAgreed(!agreed)}
                          style={styles.checkboxContainer}
                          hitSlop={12}
                          testID="signin-terms-checkbox"
                        >
                          <View style={[styles.checkbox, agreed && styles.checkboxActive]} testID="signin-checkbox-box">
                            {agreed && <Text style={styles.checkboxCheck} testID="signin-checkbox-check">✓</Text>}
                          </View>
                        </Pressable>
                        <Text style={styles.agreeText} testID="signin-agree-label">
                          {language === 'hi' ? 'मैं ' : 'I agree to the '}
                          <Text style={styles.linkText} onPress={() => router.push('/terms')} testID="signin-terms-link">{translate('termsOfService')}</Text>
                          {language === 'hi' ? ' और ' : ' and '}
                          <Text style={styles.linkText} onPress={() => router.push('/privacy')} testID="signin-privacy-link">{translate('privacyPolicy')}</Text>
                          {language === 'hi' ? ' से सहमत हूँ।' : '.'}
                        </Text>
                      </View>

                      {/* Primary Submit Button */}
                      <Pressable
                        testID="email-submit-btn"
                        onPress={mode === 'signup' ? handleSignUpSubmit : handleSignInSubmit}
                        disabled={loading}
                        style={({ pressed }) => [
                          styles.primaryActionBtn,
                          loading && { opacity: 0.65 },
                          pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                        ]}
                      >
                        <Text style={styles.primaryActionBtnText}>
                          {loading
                            ? (mode === 'signup' ? 'Sending code…' : 'Signing in…')
                            : (mode === 'signup' ? 'Continue' : 'Sign In')}
                        </Text>
                      </Pressable>

                    </View>
                  </>
                )}
              </View>
            </View>

          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: Colors.surfaceMuted,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  contentWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  mainLayout: {
    width: '100%',
    justifyContent: 'center',
  },
  mainLayoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    paddingVertical: 24,
  },
  infoSection: {
    width: '100%',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  infoSectionLarge: {
    flex: 1.1,
  },
  sliderContainer: {
    backgroundColor: Colors.white,
    borderColor: 'rgba(27,31,59,0.05)',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 16,
    marginVertical: 12,
    ...Shadows.sm,
  },
  slideCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slideIconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  slideContent: {
    flex: 1,
  },
  slideTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 14.5,
    color: Colors.indigo950,
    marginBottom: 4,
  },
  slideDesc: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: Colors.inkSoft,
    lineHeight: 17,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.ivoryLine,
  },
  dotActive: {
    width: 14,
    backgroundColor: Colors.marigold,
  },
  brandHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  brandHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 2,
    marginBottom: 10,
  },
  logoImage: {
    width: 76,
    height: 76,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(27,31,59,0.08)',
    backgroundColor: Colors.white,
    ...Shadows.md,
  },
  logoImageCompact: {
    width: 36,
    height: 36,
    borderRadius: 10,
    marginBottom: 0,
    borderWidth: 1,
  },
  brandTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 26,
    color: Colors.indigo950,
    letterSpacing: -0.3,
  },
  brandTitleCompact: {
    fontSize: 19,
  },
  sub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginTop: 2,
  },
  actionSection: {
    width: '100%',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  actionSectionLarge: {
    flex: 0.9,
  },
  actionCard: {
    backgroundColor: Colors.white,
    borderColor: 'rgba(27,31,59,0.06)',
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginVertical: 2,
    ...Shadows.sm,
  },
  cardHeaderTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 21,
    color: Colors.ink,
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  cardHeaderSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.inkSoft,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  info: {
    color: Colors.tealDeep,
    fontSize: 11.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  error: {
    color: Colors.clayDeep,
    fontSize: 11.5,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 16,
  },
  customGoogleBtn: {
    backgroundColor: Colors.marigoldDeep,
    borderRadius: Radius.full,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...Shadows.sm,
  },
  customGoogleBtnPressed: {
    backgroundColor: Colors.marigold,
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 14.5,
    color: Colors.white,
  },
  webHint: {
    fontSize: 11,
    color: Colors.inkFaint,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  checkboxContainer: {
    padding: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: Colors.marigoldDeep,
    backgroundColor: Colors.marigold,
  },
  checkboxCheck: {
    color: Colors.white,
    fontSize: 11,
    fontFamily: 'Manrope_800ExtraBold',
    lineHeight: 13,
  },
  agreeText: {
    fontSize: 11.5,
    color: Colors.inkSoft,
    lineHeight: 16,
    flex: 1,
    fontFamily: 'Manrope_500Medium',
  },
  linkText: {
    color: Colors.marigoldDeep,
    fontFamily: 'Manrope_700Bold',
    textDecorationLine: 'underline',
  },
  // ─── Segmented Control & Auth Form Styles ───
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F6',
    borderRadius: Radius.full,
    padding: 3,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  segmentBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.inkSoft,
  },
  segmentBtnTextActive: {
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.indigo950,
  },
  formContainer: {
    gap: 10,
    marginTop: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 10,
  },
  inputIcon: {
    flexShrink: 0,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.ink,
    fontFamily: 'Manrope_500Medium',
  },
  hintText: {
    fontSize: 11.5,
    color: Colors.inkSoft,
    fontFamily: 'Manrope_500Medium',
    marginTop: -4,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: -2,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  forgotPasswordText: {
    fontSize: 12.5,
    color: Colors.marigoldDeep,
    fontFamily: 'Manrope_700Bold',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginVertical: 2,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
    fontFamily: 'Manrope_600SemiBold',
    lineHeight: 16,
  },
  successAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginVertical: 2,
  },
  successAlertText: {
    flex: 1,
    fontSize: 12,
    color: Colors.tealDeep,
    fontFamily: 'Manrope_600SemiBold',
    lineHeight: 16,
  },
  primaryActionBtn: {
    backgroundColor: Colors.marigoldDeep,
    borderRadius: Radius.full,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...Shadows.sm,
  },
  primaryActionBtnText: {
    color: Colors.white,
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  backLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  backLinkText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: Colors.tealDeep,
  },
  otpSection: {
    width: '100%',
    paddingTop: 2,
  },
  otpBadgeContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  otpIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    marginTop: 2,
    marginBottom: 10,
    maxWidth: '92%',
  },
  emailPillText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.ink,
    flexShrink: 1,
  },
  emailPillEdit: {
    marginLeft: 8,
    padding: 2,
  },
  otpInstructionText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  resendRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  resendTimerText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.inkSoft,
  },
  resendBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.marigoldDeep,
    textDecorationLine: 'underline',
  },
});
