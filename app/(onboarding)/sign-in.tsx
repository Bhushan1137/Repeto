import { AppIcon } from '@/components/AppIcon';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/providers/AuthProvider';
import { sendPasswordResetEmail } from '@/services/firebase/auth';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
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
  const { signInWithGoogle, signInWithEmail, setUser } = useAuth();
  const { translate } = useTranslation(language);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Email/password form state
  const [emailFormOpen, setEmailFormOpen] = useState(false);
  const [emailVal, setEmailVal] = useState('');
  const [passwordVal, setPasswordVal] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (emailFormOpen) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 120);
    }
  }, [emailFormOpen]);

  const handleEmailSignIn = async () => {
    if (!agreed) {
      setEmailError(translate('agreeRequired'));
      return;
    }
    if (!emailVal || !passwordVal) {
      setEmailError('Please enter your email and password.');
      return;
    }
    setEmailLoading(true);
    setEmailError('');
    setResetSent(false);
    try {
      const res = await signInWithEmail(emailVal.trim(), passwordVal);
      if (res.ok && res.isDeleted) {
        // Soft-deleted account: NavigationGuard handles routing to account-recovery
        return;
      }
      if (!res.ok) {
        setEmailError(res.message || 'Sign-in failed. Please check your credentials and try again.');
      }
    } catch {
      setEmailError('Sign-in failed. Please check your credentials and try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!emailVal.trim()) {
      setEmailError('Enter your email above, then tap "Forgot password?".');
      return;
    }
    setEmailLoading(true);
    setEmailError('');
    try {
      await sendPasswordResetEmail(emailVal.trim());
      setResetSent(true);
    } catch (e: any) {
      setEmailError('Failed to send reset email. Please check your email address and try again.');
    } finally {
      setEmailLoading(false);
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

  const isLargeScreen = width > 768;
  const currentFeature = FEATURES[activeSlide];

  const handleSignIn = async () => {
    if (!agreed) {
      setError(translate('agreeRequired'));
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    const result = await signInWithGoogle(language);
    setLoading(false);

    if (!result.ok) {
      if (result.error === 'cancelled') return;
      if (result.error === 'redirect_pending') {
        setInfo(result.message ?? translate('redirectingGoogle'));
        return;
      }
      if (result.message?.includes('Firebase Console')) {
        setError(result.message);
        return;
      }
      setError(result.message ?? translate('signInFailed'));
      return;
    }

    if (result.isDeleted) {
      // Soft-deleted account: NavigationGuard handles routing to account-recovery
      return;
    }
  };

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
            paddingTop: Math.max(insets.top, 16) + 8,
            paddingBottom: Math.max(insets.bottom, 16) + (emailFormOpen ? 160 : 24),
            justifyContent: emailFormOpen ? 'flex-start' : 'center',
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <View style={[styles.contentWrapper, { maxWidth: isLargeScreen ? 800 : 440 }]}>

        {/* 1. Progress Bar aligned at the top */}
        <OnboardingProgress step={0} />

        {/* 2. Centered Layout containing everything else */}
        <View style={[styles.mainLayout, isLargeScreen && styles.mainLayoutRow]}>

          {/* Left Column / Top Section: Brand & Product Features */}
          <View style={[styles.infoSection, isLargeScreen && styles.infoSectionLarge]}>

            <View style={styles.brandContainer}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.sub}>Never forget what repeats</Text>
            </View>

            {/* Premium Animated-like Features Slider */}
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

          {/* Right Column / Bottom Section: Action Panel */}
          <View style={[styles.actionSection, isLargeScreen && styles.actionSectionLarge]} testID="signin-action-section">
            <View style={styles.actionCard} testID="signin-action-card">
              <Text style={styles.cardHeaderTitle} testID="signin-card-title">Get Started Securely</Text>
              <Text style={styles.cardHeaderSub} testID="signin-card-subtitle">
                We&apos;ll back up your reminders securely so you never lose them, even if you switch phones.
              </Text>

              {info ? <Text style={styles.info} testID="signin-info-text">{info}</Text> : null}
              {error ? <Text style={styles.error} testID="signin-error-text">{error}</Text> : null}

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

              <Pressable
                onPress={handleSignIn}
                disabled={!agreed || loading}
                testID="signin-google-btn"
                style={({ pressed }) => [
                  styles.customGoogleBtn,
                  (!agreed || loading) && { opacity: 0.6 },
                  pressed && styles.customGoogleBtnPressed,
                ]}
              >
                <View style={styles.googleBtnContent} testID="signin-google-btn-content">
                  <AppIcon name="logo-google" size={18} color={Colors.white} style={{ marginRight: 10 }} />
                  <Text style={styles.googleBtnText} testID="signin-google-btn-text">
                    {loading ? 'Signing in...' : 'Continue with Google'}
                  </Text>
                </View>
              </Pressable>

              {Platform.OS === 'web' ? (
                <Text style={styles.webHint} testID="signin-web-hint">{translate('signInWebHint')}</Text>
              ) : null}

              {/* ─── Email/Password Sign-In (existing users) ─── */}
              <View style={styles.orDivider} testID="signin-or-divider">
                <View style={styles.orLine} />
                <Text style={styles.orText}>or</Text>
                <View style={styles.orLine} />
              </View>

              <Pressable
                onPress={() => { setEmailFormOpen(v => !v); setEmailError(''); setResetSent(false); }}
                testID="signin-email-toggle"
                style={styles.emailToggleRow}
              >
                <AppIcon
                  name={emailFormOpen ? 'mail-open-outline' : 'mail-outline'}
                  size={16}
                  color={Colors.marigoldDeep}
                />
                <Text style={styles.emailToggleText}>Sign in with email</Text>
                <AppIcon
                  name={emailFormOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color={Colors.marigoldDeep}
                />
              </Pressable>

              {emailFormOpen && (
                <View style={styles.emailForm} testID="signin-email-form">
                  <Text style={styles.emailSubHint}>
                    Existing accounts only. New users must continue with Google above.
                  </Text>
                  {/* Email input */}
                  <View style={styles.inputWrapper}>
                    <AppIcon name="mail-outline" size={16} color={Colors.inkSoft} style={styles.inputIcon} />
                    <TextInput
                      testID="email-input"
                      style={styles.emailInput}
                      placeholder="your@email.com"
                      placeholderTextColor={Colors.inkSoft}
                      value={emailVal}
                      onChangeText={v => { setEmailVal(v); setEmailError(''); setResetSent(false); }}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                    />
                  </View>

                  {/* Password input */}
                  <View style={styles.inputWrapper}>
                    <AppIcon name="lock-closed-outline" size={16} color={Colors.inkSoft} style={styles.inputIcon} />
                    <TextInput
                      testID="password-input"
                      style={[styles.emailInput, { flex: 1 }]}
                      placeholder="Password"
                      placeholderTextColor={Colors.inkSoft}
                      value={passwordVal}
                      onChangeText={v => { setPasswordVal(v); setEmailError(''); }}
                      secureTextEntry={!showPassword}
                      autoComplete="current-password"
                    />
                    <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={8} testID="password-toggle">
                      <AppIcon
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={Colors.inkSoft}
                      />
                    </Pressable>
                  </View>

                  {/* Error / reset-sent message */}
                  {emailError ? (
                    <Text style={styles.emailError} testID="email-error-text">{emailError}</Text>
                  ) : null}
                  {resetSent ? (
                    <Text style={styles.resetSentText} testID="reset-sent-text">
                      ✓ If an account exists, a reset link was sent. Please check your Inbox and Spam folders.
                    </Text>
                  ) : null}

                  {/* Sign In button */}
                  <Pressable
                    testID="email-submit-btn"
                    onPress={() => handleEmailSignIn()}
                    disabled={emailLoading}
                    style={({ pressed }) => [
                      styles.emailSignInBtn,
                      emailLoading && { opacity: 0.6 },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.emailSignInBtnText}>
                      {emailLoading ? 'Signing in…' : 'Sign In'}
                    </Text>
                  </Pressable>

                  {/* Forgot password */}
                  <Pressable
                    testID="forgot-password-btn"
                    onPress={handleForgotPassword}
                    disabled={emailLoading}
                    style={styles.forgotPasswordRow}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Premium True Ghost Back Button */}
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(onboarding)/language');
                }
              }}
              testID="signin-back-btn"
              style={({ pressed }) => [
                styles.customBackBtn,
                pressed && { opacity: 0.6 }
              ]}
            >
              <Text style={styles.customBackBtnText} testID="signin-back-btn-text">
                {translate('backBtn')}
              </Text>
            </Pressable>
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
  brandContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: Radius.md,
    marginBottom: 10,
    ...Shadows.sm,
  },
  sub: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  actionSection: {
    width: '100%',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  actionSectionLarge: {
    flex: 0.9,
  },
  actionCard: {
    backgroundColor: Colors.white,
    borderColor: 'rgba(27,31,59,0.05)',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 16,
    marginVertical: 8,
    ...Shadows.sm,
  },
  cardHeaderTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 14.5,
    color: Colors.indigo950,
    marginBottom: 4,
    textAlign: 'center',
  },
  cardHeaderSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11.5,
    color: Colors.inkSoft,
    lineHeight: 16,
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
  customBackBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  customBackBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13.5,
    color: Colors.inkSoft,
  },
  // ─── Email/Password form styles ───
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 8,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.ivoryLine,
  },
  orText: {
    fontSize: 12,
    color: Colors.inkSoft,
    fontFamily: 'Manrope_500Medium',
  },
  emailToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  emailToggleText: {
    fontSize: 13.5,
    color: Colors.marigoldDeep,
    fontFamily: 'Manrope_700Bold',
  },
  emailForm: {
    gap: 10,
    marginTop: 4,
    paddingTop: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  inputIcon: {
    flexShrink: 0,
  },
  emailInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.ink,
    fontFamily: 'Manrope_500Medium',
    outlineStyle: 'none',
  } as any,
  emailSubHint: {
    fontSize: 11.5,
    color: Colors.inkFaint,
    fontFamily: 'Manrope_500Medium',
    textAlign: 'center',
    marginBottom: 4,
  },
  emailError: {
    fontSize: 12,
    color: '#e53e3e',
    fontFamily: 'Manrope_500Medium',
    textAlign: 'center',
  },
  resetSentText: {
    fontSize: 12,
    color: Colors.tealDeep,
    fontFamily: 'Manrope_600SemiBold',
    textAlign: 'center',
  },
  emailSignInBtn: {
    backgroundColor: Colors.marigoldDeep,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 2,
    ...Shadows.sm,
  },
  emailSignInBtnText: {
    color: Colors.white,
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  forgotPasswordRow: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  forgotPasswordText: {
    fontSize: 12.5,
    color: Colors.inkSoft,
    fontFamily: 'Manrope_500Medium',
    textDecorationLine: 'underline',
  },
});
