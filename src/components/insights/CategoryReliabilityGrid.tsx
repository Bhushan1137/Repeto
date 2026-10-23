import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { CATEGORY_MAP } from '@/constants/categories';
import { getCategoryAccent } from '@/constants/categoryHelpers';
import { AccentHex, Colors, Radius, Typography } from '@/constants/theme';
import type { CategoryInsight } from '@/domain/insights';
import type { CategoryKey } from '@/types';

interface CategoryReliabilityGridProps {
  bars: CategoryInsight[];
  language: 'en' | 'hi';
}

export function CategoryReliabilityGrid({ bars }: CategoryReliabilityGridProps) {
  if (!bars || bars.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {bars.map((bar) => {
          const catKey = bar.key as CategoryKey;
          const cat = CATEGORY_MAP[catKey] ?? CATEGORY_MAP['home'];
          const accentKey = getCategoryAccent(catKey);
          const accentColor = AccentHex[accentKey] ?? Colors.tealDeep;

          return (
            <View key={bar.key} style={styles.card}>
              <View style={styles.topRow}>
                <View style={styles.labelRow}>
                  <Text style={styles.icon}>{cat?.icon ?? '📌'}</Text>
                  <Text style={styles.title} numberOfLines={1}>
                    {bar.label}
                  </Text>
                </View>
                <View style={[styles.pctBadge, { backgroundColor: `${accentColor}18` }]}>
                  <Text style={[styles.pctText, { color: accentColor }]}>
                    {bar.percent}%
                  </Text>
                </View>
              </View>

              {/* Micro Progress Bar */}
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.min(Math.max(bar.percent, 0), 100)}%`,
                      backgroundColor: accentColor,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    padding: 12,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 6,
  },
  icon: {
    fontSize: 14,
  },
  title: {
    ...Typography.body,
    fontFamily: 'Manrope_700Bold',
    fontSize: 12.5,
    color: Colors.ink,
    flexShrink: 1,
  },
  pctBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  pctText: {
    ...Typography.caption,
    fontFamily: 'Fraunces_700Bold',
    fontSize: 11,
  },
  track: {
    height: 5,
    backgroundColor: Colors.ivoryDim,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
