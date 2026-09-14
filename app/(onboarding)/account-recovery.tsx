import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/Button';
import { Colors, Radius, Shadows, Typography } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useTranslation } from '@/hooks/useTranslation';

export default function AccountRecoveryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { deletedAccountInfo, restoreAccount, freshStartAccount, signOut, language, languageSelected } = useAuth();
  const { translate } = useTranslation(language);

  const [loading, setLoading] = useState<'restore' | 'fresh' | 'signout' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Compute grace period info
  const { isWithinGrace, daysRemaining, formattedDeletedDate } = useMemo(() => {
    if (!deletedAccountInfo) {
      return { isWithinGrace: true, daysRemaining: 30, formattedDeletedDate: '' };
    }

    const dDate = new Date(deletedAccountInfo.deletedAt);
    const dateStr = !isNaN(dDate.getTime())
      ? dDate.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '';

    let withinGrace = true;
    let days = 30;

    if (deletedAccountInfo.purgeAfter) {
      const purgeDate = new Date(deletedAccountInfo.purgeAfter);
      if (!isNaN(purgeDate.getTime())) {
        const diffMs = purgeDate.getTime() - Date.now();
        days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        withinGrace = days > 0;
      }
    }

    return {
      isWithinGrace: withinGrace,
      daysRemaining: days,
      formattedDeletedDate: dateStr,
    };
  }, [deletedAccountInfo, language]);

  const handleRestore = async () => {
    try {
      setError(null);
      setLoading('restore');
      const res = await restoreAccount();
      if (!res.ok) {
        setError(res.error || translate('recoveryError'));
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : translate('recoveryError'));
    } finally {
      setLoading(null);
    }
  };

  const handleFreshStart = () => {
    const title = language === 'hi' ? 'नए सिरे से शुरू करें?' : 'Start Fresh?';
    const message =
      language === 'hi'
        ? 'आपका पिछला सारा डेटा (टास्क, सूचनाएं) स्थायी रूप से हटा दिया जाएगा। यह क्रिया पूर्ववत नहीं की जा सकती।'
        : 'All your previous data (tasks, routines, history) will be permanently deleted. This cannot be undone.';
    const confirmText = language === 'hi' ? 'हाँ, मिटाएं' : 'Yes, Delete & Start Fresh';
    const cancelText = language === 'hi' ? 'रद्द करें' : 'Cancel';

    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        executeFreshStart();
      }
    } else {
      Alert.alert(title, message, [
        { text: cancelText, style: 'cancel' },
        { text: confirmText, style: 'destructive', onPress: executeFreshStart },
      ]);
    }
  };

  const executeFreshStart = async () => {
    try {
      setError(null);
      setLoading('fresh');
      const res = await freshStartAccount();
      if (!res.ok) {
        setError(res.error || translate('recoveryError'));
      } else {
        if (!languageSelected) {
          router.replace('/(onboarding)/language');
        } else {
          router.replace('/(onboarding)/profile');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : translate('recoveryError'));
    } finally {
      setLoading(null);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading('signout');
      await signOut();
    } finally {
      setLoading(null);
    }
  };

  const subtitleText = isWithinGrace
    ? translate('recoverySubWithinGrace')
        .replace('{date}', formattedDeletedDate || (language === 'hi' ? 'हाल ही में' : 'recently'))
        .replace('{days}', String(daysRemaining))
    : translate('recoverySubExpired');

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 24) + 16,
          paddingBottom: Math.max(insets.bottom, 24) + 24,
        },
      ]}
      showsVerticalScrollIndicator={false}
      testID="account-recovery-scroll"
    >
      {/* Icon Badge */}
      <View style={styles.badgeContainer}>
        <View style={styles.badge}>
          <AppIcon name="shield-outline" size={38} color={Colors.marigoldDeep} />
        </View>
      </View>

      {/* Hero Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{translate('recoveryTitle')}</Text>
        <Text style={styles.subtitle}>{subtitleText}</Text>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorCard}>
          <AppIcon name="warning-outline" size={20} color={Colors.clay} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Action Options */}
      <View style={styles.cardsContainer}>
        {/* Option 1: Restore Account (Only if within grace period) */}
        {isWithinGrace && (
          <View style={[styles.card, styles.restoreCard]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: Colors.tealLight }]}>
                <AppIcon name="refresh-outline" size={24} color={Colors.white} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>{translate('recoveryRestoreBtn')}</Text>
                <Text style={styles.cardSub}>{translate('recoveryRestoreSub')}</Text>
              </View>
            </View>

            <Button
              title={loading === 'restore' ? translate('recoveryRestoring') : translate('recoveryRestoreBtn')}
              loading={loading === 'restore'}
              disabled={loading !== null}
              onPress={handleRestore}
              style={styles.actionBtn}
              testID="recovery-restore-button"
            />
          </View>
        )}

        {/* Option 2: Fresh Start */}
        <View style={[styles.card, !isWithinGrace && styles.primaryExpiredCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBadge, { backgroundColor: Colors.marigoldLight }]}>
              <AppIcon name="sparkles" size={24} color={Colors.indigo950} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>{translate('recoveryFreshBtn')}</Text>
              <Text style={styles.cardSub}>{translate('recoveryFreshSub')}</Text>
            </View>
          </View>

          <Button
            title={loading === 'fresh' ? translate('recoveryPurging') : translate('recoveryFreshBtn')}
            variant={isWithinGrace ? 'outline' : 'primary'}
            loading={loading === 'fresh'}
            disabled={loading !== null}
            onPress={handleFreshStart}
            style={styles.actionBtn}
            testID="recovery-fresh-start-button"
          />
        </View>
      </View>

      {/* Cancel / Sign Out Footer */}
      <View style={styles.footer}>
        <Button
          title={language === 'hi' ? 'अलग खाते से साइन इन करें' : 'Sign In with Another Account'}
          variant="ghost"
          disabled={loading !== null}
          loading={loading === 'signout'}
          onPress={handleSignOut}
          testID="recovery-signout-button"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.marigoldLight,
    borderWidth: 2,
    borderColor: Colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    ...Typography.displayMd,
    fontSize: 26,
    color: Colors.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    ...Typography.body,
    fontSize: 14.5,
    lineHeight: 22,
    color: Colors.inkSoft,
    textAlign: 'center',
    maxWidth: 340,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderColor: Colors.clay,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.clay,
    fontSize: 13,
    flex: 1,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    ...Shadows.sm,
  },
  restoreCard: {
    borderColor: Colors.teal,
    borderWidth: 1.5,
  },
  primaryExpiredCard: {
    borderColor: Colors.marigold,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 14,
  },
  cardIconBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    ...Typography.title,
    fontSize: 16,
    color: Colors.ink,
    marginBottom: 3,
  },
  cardSub: {
    ...Typography.caption,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.inkSoft,
  },
  actionBtn: {
    marginTop: 4,
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
  },
});
