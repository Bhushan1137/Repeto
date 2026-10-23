import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

interface IconPickerStripProps {
  options: string[];
  selectedIcon: string | null;
  defaultIcon: string;
  onSelectIcon: (icon: string | null) => void;
}

export function IconPickerStrip({
  options,
  selectedIcon,
  defaultIcon,
  onSelectIcon,
}: IconPickerStripProps) {
  const activeIcon = selectedIcon || defaultIcon;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {options.map((emoji) => {
          const isSelected = activeIcon === emoji;
          return (
            <TouchableOpacity
              key={emoji}
              onPress={() => onSelectIcon(emoji === defaultIcon ? null : emoji)}
              style={[
                styles.emojiChip,
                isSelected && styles.emojiChipSelected,
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  scrollContent: {
    paddingHorizontal: 2,
    gap: 8,
  },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiChipSelected: {
    borderColor: Colors.tealDeep,
    backgroundColor: '#E6F4F1',
  },
  emojiText: {
    fontSize: 22,
  },
});
