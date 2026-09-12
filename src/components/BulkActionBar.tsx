import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Colors, Radius, Typography } from '@/constants/theme';
import { AppIcon } from '@/components/AppIcon';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount?: number;
  isAllSelected?: boolean;
  onSelectAll?: () => void;
  onClear: () => void;
  onComplete: () => void;
  onSnooze: () => void;
  onSkip?: () => void;
  onDelete: () => void;
  language: 'en' | 'hi';
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  isAllSelected,
  onSelectAll,
  onClear,
  onComplete,
  onSnooze,
  onSkip,
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
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {language === 'hi'
              ? `${selectedCount} चुने गए`
              : `${selectedCount} selected`}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {onSelectAll && (
            <Pressable onPress={onSelectAll} hitSlop={8} style={styles.selectAllBtn}>
              <AppIcon
                name={isAllSelected ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={16}
                color={Colors.tealDeep}
              />
              <Text style={styles.selectAllText}>
                {isAllSelected
                  ? (language === 'hi' ? 'सभी हटाएं' : 'Deselect All')
                  : (language === 'hi' ? `सभी चुनें ${totalCount ? `(${totalCount})` : ''}` : `Select All ${totalCount ? `(${totalCount})` : ''}`)}
              </Text>
            </Pressable>
          )}

          <Pressable onPress={onClear} hitSlop={12} style={styles.closeBtn}>
            <AppIcon name="close" size={18} color={Colors.inkSoft} />
          </Pressable>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Pressable style={[styles.actionBtn, styles.actionBtnDone]} onPress={onComplete}>
          <AppIcon name="checkmark-done-outline" size={18} color={Colors.tealDeep} />
          <Text style={[styles.btnLabel, { color: Colors.tealDeep }]}>
            {language === 'hi' ? 'पूरा करें' : 'Done'}
          </Text>
        </Pressable>

        <Pressable style={[styles.actionBtn, styles.actionBtnSnooze]} onPress={onSnooze}>
          <AppIcon name="time-outline" size={18} color={Colors.marigoldDeep} />
          <Text style={[styles.btnLabel, { color: Colors.marigoldDeep }]}>
            {language === 'hi' ? 'सणूज़' : 'Snooze'}
          </Text>
        </Pressable>

        {onSkip && (
          <Pressable style={[styles.actionBtn, styles.actionBtnSkip]} onPress={onSkip}>
            <AppIcon name="play-skip-forward-outline" size={18} color="#4F46E5" />
            <Text style={[styles.btnLabel, { color: '#4F46E5' }]}>
              {language === 'hi' ? 'छोड़ें' : 'Skip'}
            </Text>
          </Pressable>
        )}

        <Pressable style={[styles.actionBtn, styles.actionBtnDelete]} onPress={onDelete}>
          <AppIcon name="trash-outline" size={18} color={Colors.clayDeep} />
          <Text style={[styles.btnLabel, { color: Colors.clayDeep }]}>
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
    bottom: Platform.OS === 'ios' ? 96 : 84,
    left: 16,
    right: 16,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: Colors.marigold,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    zIndex: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countText: {
    ...Typography.title,
    fontSize: 14,
    fontFamily: 'Fraunces_700Bold',
    color: Colors.ink,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.ivory,
    borderWidth: 1,
    borderColor: Colors.marigold,
  },
  selectAllText: {
    ...Typography.caption,
    fontSize: 11.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.tealDeep,
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
  actionBtnDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  actionBtnSnooze: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  actionBtnSkip: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  actionBtnDelete: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  btnLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
});
