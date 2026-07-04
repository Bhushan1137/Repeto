import React, { useCallback } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  Keyboard,
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import type { CategoryKey, TaskGroup } from '@/types';
import type { FilterState } from '@/hooks/useFilteredTasks';
import { CATEGORIES } from '@/constants/categories';
import { Colors, Radius, Typography } from '@/constants/theme';
import { AppIcon } from '@/components/AppIcon';

interface TaskFilterBarProps {
  filter: FilterState;
  onChange: (next: FilterState) => void;
  language: 'en' | 'hi';
}

const GROUP_CHIPS: { key: TaskGroup | 'all'; labelEn: string; labelHi: string }[] = [
  { key: 'all',     labelEn: 'All',     labelHi: 'सभी' },
  { key: 'overdue', labelEn: 'Overdue', labelHi: 'देर' },
  { key: 'today',   labelEn: 'Today',   labelHi: 'आज' },
  { key: 'week',    labelEn: 'This Week', labelHi: 'इस हफ्ते' },
  { key: 'month',   labelEn: 'Month',   labelHi: 'महीना' },
];

export function TaskFilterBar({ filter, onChange, language }: TaskFilterBarProps) {
  const isFiltered =
    filter.query.trim() !== '' || filter.group !== 'all' || filter.category !== 'all';

  const clearAll = useCallback(() => {
    Keyboard.dismiss();
    onChange({ query: '', group: 'all', category: 'all' });
  }, [onChange]);

  return (
    <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOutUp.duration(180)}>
      {/* Search input */}
      <View style={styles.searchRow}>
        <AppIcon name="search-outline" size={18} color={Colors.inkFaint} />
        <TextInput
          style={styles.searchInput}
          placeholder={language === 'hi' ? 'खोजें...' : 'Search tasks...'}
          placeholderTextColor={Colors.inkFaint}
          value={filter.query}
          onChangeText={(q) => onChange({ ...filter, query: q })}
          returnKeyType="search"
          autoCorrect={false}
        />
        {filter.query.length > 0 && (
          <Pressable onPress={() => onChange({ ...filter, query: '' })} hitSlop={8}>
            <AppIcon name="close-circle-outline" size={16} color={Colors.inkFaint} />
          </Pressable>
        )}
      </View>

      {/* Due group chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {GROUP_CHIPS.map((chip) => {
          const active = filter.group === chip.key;
          return (
            <Pressable
              key={chip.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange({ ...filter, group: chip.key })}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {language === 'hi' ? chip.labelHi : chip.labelEn}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <Pressable
          style={[styles.chip, filter.category === 'all' && styles.chipActive]}
          onPress={() => onChange({ ...filter, category: 'all' })}
        >
          <Text style={[styles.chipText, filter.category === 'all' && styles.chipTextActive]}>
            {language === 'hi' ? 'सभी श्रेणियाँ' : 'All Categories'}
          </Text>
        </Pressable>
        {CATEGORIES.map((cat) => {
          const active = filter.category === cat.key;
          return (
            <Pressable
              key={cat.key}
              style={[styles.chip, active && styles.chipCategoryActive]}
              onPress={() =>
                onChange({ ...filter, category: active ? 'all' : (cat.key as CategoryKey) })
              }
            >
              <Text style={styles.chipCategoryEmoji}>{cat.icon}</Text>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {language === 'hi' ? cat.labelHi : cat.labelEn}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Clear all filter hint */}
      {isFiltered && (
        <Pressable style={styles.clearRow} onPress={clearAll}>
          <Text style={styles.clearText}>
            {language === 'hi' ? 'फ़िल्टर साफ़ करें' : 'Clear filters'}
          </Text>
          <AppIcon name="close" size={12} color={Colors.marigoldDeep} />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: Colors.ink,
    padding: 0,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: Colors.indigo950,
    borderColor: Colors.indigo950,
  },
  chipCategoryActive: {
    backgroundColor: Colors.marigold,
    borderColor: Colors.marigoldDeep,
  },
  chipText: {
    ...Typography.caption,
    color: Colors.inkSoft,
    fontSize: 12,
  },
  chipTextActive: {
    color: Colors.white,
  },
  chipCategoryEmoji: {
    fontSize: 12,
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    paddingBottom: 10,
  },
  clearText: {
    ...Typography.caption,
    color: Colors.marigoldDeep,
    fontSize: 12,
  },
});
