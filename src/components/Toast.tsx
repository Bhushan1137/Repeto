import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Radius, Shadows, Typography } from '@/constants/theme';

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={[styles.wrap, Shadows.lg]} pointerEvents="none">
      <LinearGradient colors={[Colors.indigo950, Colors.indigo900]} style={styles.gradient}>
        <View style={styles.dot} />
        <Text style={styles.text}>{message}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    borderRadius: Radius.full,
    overflow: 'hidden',
    zIndex: 100,
    maxWidth: '88%',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(251,247,239,0.12)',
    borderRadius: Radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.marigold },
  text: { ...Typography.caption, color: Colors.onDark, fontSize: 13, flexShrink: 1 },
});
