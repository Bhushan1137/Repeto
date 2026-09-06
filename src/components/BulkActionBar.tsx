import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Colors, Radius, Typography } from '@/constants/theme';
import { AppIcon } from '@/components/AppIcon';

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onComplete: () => void;
  onSnooze: () => void;
  onDelete: () => void;
  language: 'en' | 'hi';
}

export function BulkActionBar({
  selectedCount,
  onClear,
  onComplete,
  onSnooze,
  onDelete,
  language,
}: BulkActionBarProps) {
  return (
    <Animated.View
      entering={SlideInDown.duration(250)}
      exiting={SlideOutDown.duration(200)}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.countText}>
          {language === 'hi'
            ? `${selectedCount} चुने गए`
            : `${selectedCount} selected`}
        </Text>
        <Pressable onPress={onClear} hitSlop={12} style={styles.closeBtn}>
          <AppIcon name="close" size={18} color={Colors.inkSoft} />
        </Pressable>
      </View>
      <View style={styles.buttonRow}>
        <Pressable style={styles.actionBtn} onPress={onComplete}>
          <AppIcon name="checkmark-done-outline" size={20} color={Colors.tealDeep} />
          <Text style={styles.btnLabel}>
            {language === 'hi' ? 'पूरा करें' : 'Done'}
          </Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={onSnooze}>
          <AppIcon name="time-outline" size={20} color={Colors.marigoldDeep} />
          <Text style={styles.btnLabel}>
            {language === 'hi' ? 'सूझें' : 'Snooze'}
          </Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={onDelete}>
          <AppIcon name="trash-outline" size={20} color={Colors.clayDeep} />
          <Text style={styles.btnLabel}>
            {language === 'hi' ? 'हटाएं' : 'Delete'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  countText: {
    ...Typography.title,
    fontSize: 14,
    color: Colors.ink,
  },
  closeBtn: {
    padding: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  btnLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
});
