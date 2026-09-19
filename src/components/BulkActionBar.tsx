import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius } from '@/constants/theme';
import { AppIcon } from '@/components/AppIcon';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount?: number;
  completableCount?: number;
  snoozableCount?: number;
  isAllSelected?: boolean;
  onSelectAll?: () => void;
  onClear: () => void;
  onComplete: () => void;
  onSnooze: () => void;
  onDisabledComplete?: () => void;
  onDisabledSnooze?: () => void;
  onSkip?: () => void;
  onDelete: () => void;
  language: 'en' | 'hi';
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  completableCount,
  snoozableCount,
  isAllSelected,
  onSelectAll,
  onClear,
  onComplete,
  onSnooze,
  onDisabledComplete,
  onDisabledSnooze,
  onSkip,
  onDelete,
  language,
}: BulkActionBarProps) {
  const insets = useSafeAreaInsets();
  const isDoneDisabled =
    completableCount === undefined ||
    selectedCount === 0 ||
    completableCount === 0;

  const isSnoozeDisabled =
    snoozableCount === undefined ||
    selectedCount === 0 ||
    snoozableCount === 0;

  const doneLabel =
    completableCount !== undefined && completableCount > 0 && completableCount < selectedCount
      ? (language === 'hi' ? `पूरा करें (${completableCount})` : `Done (${completableCount})`)
      : (language === 'hi' ? 'पूरा करें' : 'Done');

  const snoozeLabel =
    snoozableCount !== undefined && snoozableCount > 0 && snoozableCount < selectedCount
      ? (language === 'hi' ? `सणूज़ (${snoozableCount})` : `Snooze (${snoozableCount})`)
      : (language === 'hi' ? 'सणूज़' : 'Snooze');

  const bottomOffset = Math.max(insets.bottom, 12) + (Platform.OS === 'ios' ? 96 : 90);

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18).stiffness(140)}
      exiting={SlideOutDown.duration(180)}
      style={[styles.container, { bottom: bottomOffset }]}
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
                size={15}
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
            <AppIcon name="close" size={17} color={Colors.inkSoft} />
          </Pressable>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={[
            styles.actionBtn,
            styles.actionBtnDone,
            isDoneDisabled && styles.actionBtnDisabled,
          ]}
          onPress={isDoneDisabled ? onDisabledComplete : onComplete}
          disabled={isDoneDisabled && !onDisabledComplete}
        >
          <AppIcon
            name="checkmark-done-outline"
            size={18}
            color={isDoneDisabled ? Colors.inkFaint : Colors.tealDeep}
          />
          <Text
            style={[
              styles.btnLabel,
              { color: isDoneDisabled ? Colors.inkFaint : Colors.tealDeep },
            ]}
          >
            {doneLabel}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.actionBtn,
            styles.actionBtnSnooze,
            isSnoozeDisabled && styles.actionBtnDisabled,
          ]}
          onPress={isSnoozeDisabled ? onDisabledSnooze : onSnooze}
          disabled={isSnoozeDisabled && !onDisabledSnooze}
        >
          <AppIcon
            name="time-outline"
            size={18}
            color={isSnoozeDisabled ? Colors.inkFaint : Colors.marigoldDeep}
          />
          <Text
            style={[
              styles.btnLabel,
              { color: isSnoozeDisabled ? Colors.inkFaint : Colors.marigoldDeep },
            ]}
          >
            {snoozeLabel}
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
    left: 16,
    right: 16,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(23, 27, 54, 0.08)',
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 14,
    color: Colors.ink,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
  },
  selectAllText: {
    fontSize: 11.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.tealDeep,
  },
  closeBtn: {
    padding: 4,
    borderRadius: Radius.full,
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
    gap: 5,
    paddingVertical: 9,
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
  actionBtnDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    opacity: 0.45,
  },
  btnLabel: {
    fontSize: 11.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
});
