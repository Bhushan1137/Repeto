import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

export const ONBOARDING_STEPS = 6;

export function OnboardingProgress({ step }: { step: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: ONBOARDING_STEPS }).map((_, i) => (
        <View key={i} style={[styles.bar, i <= step && styles.barDone]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginVertical: 14 },
  bar: { flex: 1, height: 4, borderRadius: 4, backgroundColor: Colors.ivoryLine },
  barDone: { backgroundColor: Colors.marigold },
});
