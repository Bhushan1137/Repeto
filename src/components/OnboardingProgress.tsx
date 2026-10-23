import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';

export const ONBOARDING_STEPS = 6;

export function OnboardingProgress({ step }: { step: number }) {
  const { translate } = useTranslation();

  // Map onboarding step (0-5) to header indexes (0-4)
  // Step 0 & 1 -> Get Started (0)
  // Step 2 -> Your Profile (1)
  // Step 3 -> Choose Categories (2)
  // Step 4 -> Set Preferences (3)
  // Step 5 -> You're All Set (4)
  const getActiveHeaderIndex = (s: number) => {
    if (s <= 1) return 0;
    if (s === 2) return 1;
    if (s === 3) return 2;
    if (s === 4) return 3;
    return 4;
  };

  const activeHeader = getActiveHeaderIndex(step);

  const steps = [
    { label: translate('stepGetStarted'), index: 0 },
    { label: translate('stepYourProfile'), index: 1 },
    { label: translate('stepChooseCategories'), index: 2 },
    { label: translate('stepSetPreferences'), index: 3 },
    { label: translate('stepFinish'), index: 4 },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.labelsRow}>
        {steps.map((item) => {
          const isActive = item.index === activeHeader;
          return (
            <View key={item.index} style={styles.labelWrapper}>
              <Text style={[styles.labelText, isActive && styles.labelTextActive]}>
                {item.label}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </View>
          );
        })}
      </View>
      <View style={styles.row}>
        {Array.from({ length: ONBOARDING_STEPS }).map((_, i) => (
          <View key={i} style={[styles.bar, i <= step && styles.barDone]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 4,
  },
  labelWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  labelText: {
    fontSize: 10,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  labelTextActive: {
    color: Colors.marigoldDeep,
    fontFamily: 'Manrope_800ExtraBold',
  },
  activeIndicator: {
    height: 2.5,
    backgroundColor: Colors.marigoldDeep,
    width: '65%',
    marginTop: 4,
    borderRadius: 2,
  },
  row: { flexDirection: 'row', gap: 6, marginVertical: 6 },
  bar: { flex: 1, height: 4, borderRadius: 4, backgroundColor: Colors.ivoryLine },
  barDone: { backgroundColor: Colors.marigoldDeep },
});
