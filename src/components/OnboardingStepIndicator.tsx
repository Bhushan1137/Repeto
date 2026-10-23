import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors, Radius } from '@/constants/theme';
import { AppIcon } from '@/components/AppIcon';

interface OnboardingStepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
  stepLabel?: string;
  onBack?: () => void;
  testID?: string;
}

export function OnboardingStepIndicator({
  currentStep,
  totalSteps = 5,
  stepLabel,
  onBack,
  testID = 'onboarding-step-indicator',
}: OnboardingStepIndicatorProps) {
  const progressPercent = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn} testID={`${testID}-back-btn`}>
            <AppIcon name="chevron-back" size={20} color={Colors.indigo950} />
          </Pressable>
        ) : (
          <View style={styles.placeholderBtn} />
        )}

        <View style={styles.badgeContainer}>
          <Text style={styles.stepBadgeText}>
            Step {currentStep} of {totalSteps}
            {stepLabel ? ` · ${stepLabel}` : ''}
          </Text>
        </View>

        <View style={styles.placeholderBtn} />
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: Colors.surfaceMuted,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderBtn: {
    width: 32,
    height: 32,
  },
  badgeContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    alignItems: 'center',
  },
  stepBadgeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.indigo950,
    letterSpacing: 0.1,
  },
  progressTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(27, 31, 59, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.marigoldDeep,
    borderRadius: 2.5,
  },
});
