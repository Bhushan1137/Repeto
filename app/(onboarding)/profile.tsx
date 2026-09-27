import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/context/OnboardingProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { validateName, validatePhone, formatPhone } from '@/domain/validation';
import type { TranslationKey } from '@/i18n';
import { Colors } from '@/constants/theme';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingStepIndicator } from '@/components/OnboardingStepIndicator';

export default function ProfileScreen() {
  const router = useRouter();
  const { language, setName: setCtxName, setPhone: setCtxPhone, setEmail: setCtxEmail, email: ctxEmail } = useOnboarding();
  const { user, updateUser } = useAuth();
  const { translate } = useTranslation(language);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone?.replace('+91 ', '') ?? '');
  const [email, setEmail] = useState(user?.email || ctxEmail || '');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (user?.name && !name) setName(user.name);
    const resolvedEmail = user?.email || ctxEmail || '';
    if (resolvedEmail && !email) setEmail(resolvedEmail);
    if (resolvedEmail) setCtxEmail(resolvedEmail);
  }, [user?.name, user?.email, ctxEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContinue = async () => {
    const nameResult = validateName(name);
    const phoneResult = validatePhone(phone);
    const nextErrors: typeof errors = {};

    if (!nameResult.valid && nameResult.error) {
      nextErrors.name = translate(nameResult.error as TranslationKey);
    }
    if (!phoneResult.valid && phoneResult.error) {
      nextErrors.phone = translate(phoneResult.error as TranslationKey);
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const formattedPhone = formatPhone(phone);
      const finalEmail = user?.email || email || ctxEmail || '';
      await updateUser({
        name: name.trim(),
        phone: formattedPhone || undefined,
        email: finalEmail,
        language,
        profileComplete: true,
      });
      setCtxName(name.trim());
      setCtxPhone(formattedPhone);
      setCtxEmail(finalEmail);
      router.replace('/(onboarding)/categories');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.surfaceMuted }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={{ paddingTop: Math.max(insets.top, 16) }}>
        <OnboardingStepIndicator
          currentStep={2}
          totalSteps={5}
          stepLabel={language === 'hi' ? 'प्रोफ़ाइल' : 'Profile'}
          onBack={() => router.replace('/(onboarding)/language')}
        />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 24) + 80,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        testID="profile-screen-scroll"
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {name.trim() ? name.trim().slice(0, 2).toUpperCase() : '👤'}
            </Text>
          </View>
          <Text style={styles.title} testID="profile-title">{translate('profileTitle')}</Text>
          <Text style={styles.sub} testID="profile-subtitle">{translate('profileSub')}</Text>
        </View>

        <FormField
          label={translate('fullName')}
          value={name}
          onChangeText={setName}
          placeholder={language === 'hi' ? 'उदा. राहुल शर्मा' : 'e.g. Rahul Sharma'}
          autoCapitalize="words"
          error={errors.name}
          testID="profile-name-input"
        />

        <FormField
          label={translate('email')}
          value={user?.email || email || ctxEmail || ''}
          editable={false}
          error={undefined}
          hint={translate('emailFromGoogle')}
          testID="profile-email-input"
        />

        <FormField
          label={translate('mobileNumber')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={10}
          error={errors.phone}
          hint={translate('phoneRequiredHint')}
          testID="profile-phone-input"
        />

        <Button
          title={language === 'hi' ? 'श्रेणियां चुनें →' : 'Continue to Categories →'}
          style={styles.cta}
          loading={loading}
          onPress={handleContinue}
          testID="profile-continue-btn"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 56, paddingBottom: 40, backgroundColor: Colors.surfaceMuted },
  avatarSection: { alignItems: 'center', marginBottom: 16 },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    elevation: 2,
  },
  avatarText: { fontFamily: 'Manrope_800ExtraBold', fontSize: 22, color: Colors.white },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 24, color: Colors.ink, marginTop: 4, marginBottom: 4, textAlign: 'center' },
  sub: { fontFamily: 'Manrope_500Medium', fontSize: 13.5, color: Colors.inkSoft, marginBottom: 14, textAlign: 'center', maxWidth: 300 },
  cta: { marginTop: 16, height: 48, borderRadius: 24 },
});

