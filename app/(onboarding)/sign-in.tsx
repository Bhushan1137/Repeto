import { AppIcon } from '@/components/AppIcon';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/providers/AuthProvider';
import { sendPasswordResetEmail } from '@/services/firebase/auth';
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

  // Form state
  const [nameVal, setNameVal] = useState('');
  const [emailVal, setEmailVal] = useState('');
  const [passwordVal, setPasswordVal] = useState('');
  const [confirmPassVal, setConfirmPassVal] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

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

  const handleInputFocus = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const isLargeScreen = width > 768;

  const handleSwitchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setFormError('');
    setResetSent(false);
  };

  const handleSignInSubmit = async () => {
    if (!agreed) {
      setFormError(translate('agreeRequired'));
      return;
    }
    if (!emailVal.trim() || !passwordVal) {
      setFormError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setFormError('');
    setResetSent(false);
    try {
      const res = await signInWithEmail(emailVal.trim(), passwordVal);
      if (res.ok && res.isDeleted) {
        return;
      }
      if (!res.ok) {
        setFormError(res.message || 'Sign-in failed. Please check your credentials.');
      }
    } catch {
      setFormError('Sign-in failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async () => {
    if (!agreed) {
      setFormError(translate('agreeRequired'));
      return;
    }
    if (!emailVal.trim() || !passwordVal) {
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
    setLoading(true);
    setFormError('');
    try {
      const res = await signUpWithEmail(emailVal.trim(), passwordVal, nameVal.trim());
      if (!res.ok) {
        setFormError(res.message || 'Sign-up failed. Please try again.');
      }
    } catch {
      setFormError('Sign-up failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!emailVal.trim()) {
      setFormError('Please enter your email above to receive a reset link.');
      return;
    }
    setLoading(true);
    setFormError('');
    try {
      await sendPasswordResetEmail(emailVal.trim());
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
            paddingBottom: Math.max(insets.bottom, 16) + (keyboardOpen ? 300 : 32),
            justifyContent: keyboardOpen ? 'flex-start' : 'center',
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={true}
      >
        <View style={[styles.contentWrapper, { maxWidth: isLargeScreen ? 820 : 440 }]}>

          {/* 1. Progress Bar aligned at the top */}
          {(!keyboardOpen || isLargeScreen) && <OnboardingProgress step={0} />}

          {/* Compact Brand Header for Mobile (or Large Header on Desktop) */}
          {(!keyboardOpen || isLargeScreen) && (
            <View style={styles.brandHeader}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.brandTitle}>Repeto</Text>
              <Text style={styles.sub}>Never forget what repeats</Text>
            </View>
          )}

          {/* 2. Main Layout Container */}
          <View style={[styles.mainLayout, isLargeScreen && styles.mainLayoutRow, keyboardOpen && { justifyContent: 'flex-start' }]}>

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
                <Text style={styles.cardHeaderSub} testID="signin-card-subtitle">
                  {mode === 'signup'
                    ? 'Keep daily routines, chores, and bills organized across all devices.'
                    : 'Sign in with your email to continue where you left off.'}
                </Text>

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
                        onFocus={handleInputFocus}
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
                      onChangeText={(v) => { setEmailVal(v); setFormError(''); setResetSent(false); }}
                      onFocus={handleInputFocus}
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
                      onFocus={handleInputFocus}
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
                        onFocus={handleInputFocus}
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
                      <Text style={styles.errorAlertText}>{formError}</Text>
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
                        ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
                        : (mode === 'signup' ? 'Create Account' : 'Sign In')}
                    </Text>
                  </Pressable>

                  {/* 
                  Google Sign-In button temporarily commented out per user request:
                  <Pressable onPress={handleSignIn} ...>
                    <Text>Continue with Google</Text>
                  </Pressable> 
                */}

                </View>
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
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  mainLayout: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
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
    marginTop: 4,
    marginBottom: 8,
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    marginBottom: 4,
    ...Shadows.sm,
  },
  brandTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 17,
    color: Colors.indigo950,
    letterSpacing: -0.2,
  },
  sub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11.5,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginTop: 1,
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
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginVertical: 4,
    ...Shadows.sm,
  },
  cardHeaderTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 14.5,
    color: Colors.indigo950,
    marginBottom: 3,
    textAlign: 'center',
  },
  cardHeaderSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11.5,
    color: Colors.inkSoft,
    lineHeight: 15.5,
    textAlign: 'center',
    marginBottom: 10,
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
    outlineStyle: 'none',
  } as any,
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
    borderRadius: Radius.md,
    paddingVertical: 13.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    ...Shadows.sm,
  },
  primaryActionBtnText: {
    color: Colors.white,
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
