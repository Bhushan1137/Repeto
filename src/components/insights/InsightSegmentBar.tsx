import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors, Radius, Typography } from '@/constants/theme';

export type InsightSegment = 'overview' | 'finances' | 'habits';

interface InsightSegmentBarProps {
  activeSegment: InsightSegment;
  onChangeSegment: (segment: InsightSegment) => void;
  language: 'en' | 'hi';
}

export function InsightSegmentBar({
  activeSegment,
  onChangeSegment,
  language,
}: InsightSegmentBarProps) {
  const isHi = language === 'hi';

  const segments: { key: InsightSegment; label: string; icon: string }[] = [
    {
      key: 'overview',
      label: isHi ? 'सारांश' : 'Overview',
      icon: '⚡',
    },
    {
      key: 'finances',
      label: isHi ? 'वित्त' : 'Finances',
      icon: '💰',
    },
    {
      key: 'habits',
      label: isHi ? 'आदतें' : 'Habits',
      icon: '🔥',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        {segments.map((seg) => {
          const isActive = activeSegment === seg.key;
          return (
            <TouchableOpacity
              key={seg.key}
              onPress={() => onChangeSegment(seg.key)}
              activeOpacity={0.75}
              style={[styles.segmentBtn, isActive && styles.segmentBtnActive]}
            >
              <Text style={{ fontSize: 13, marginRight: 5 }}>{seg.icon}</Text>
              <Text
                style={[
                  styles.segmentLabel,
                  isActive && styles.segmentLabelActive,
                ]}
                numberOfLines={1}
              >
                {seg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
  },
  segmentBtnActive: {
    backgroundColor: Colors.indigo950,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentLabel: {
    ...Typography.caption,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: Colors.inkSoft,
  },
  segmentLabelActive: {
    color: Colors.white,
    fontFamily: 'Manrope_700Bold',
  },
});
