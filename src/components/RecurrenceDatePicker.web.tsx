import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Colors, Radius } from '@/constants/theme';
import type { RecurrenceOption } from './RecurrenceDatePicker';

interface RecurrenceDatePickerProps {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  options?: RecurrenceOption[];
  onSelectOption?: (option: RecurrenceOption) => void;
  language?: string;
}

export function RecurrenceDatePicker({
  visible,
  value,
  onClose,
  onConfirm,
  options,
  onSelectOption,
  language = 'en',
}: RecurrenceDatePickerProps) {
  const [tempDateStr, setTempDateStr] = useState(value.toISOString().slice(0, 10));
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState<Date | null>(null);

  const cancelLabel = language === 'hi' ? 'रद्द करें' : 'Cancel';
  const chooseDateLabel = language === 'hi' ? 'कैलेंडर से तारीख चुनें' : 'Choose a Date';
  const choosePatternLabel = language === 'hi' ? 'आवृत्ति चुनें' : 'Choose how often';
  const nextLabel = language === 'hi' ? 'आगे बढ़ें →' : 'Next →';
  const dateSubLabel =
    confirmedDate
      ? language === 'hi'
        ? `तारीख: ${confirmedDate.toLocaleDateString('hi-IN', { weekday: 'long', day: 'numeric', month: 'short' })}`
        : `Based on: ${confirmedDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}`
      : '';

  const commit = () => {
    const date = new Date(tempDateStr);
    if (!Number.isNaN(date.getTime())) {
      if (options && options.length > 0) {
        setConfirmedDate(date);
        onConfirm(date);
      } else {
        onConfirm(date);
      }
    }
  };

  const showOptions = options && options.length > 0 && confirmedDate !== null;

  if (!visible) return null;

  const inputStyle: React.CSSProperties = {
    fontSize: '16px',
    fontFamily: 'Manrope_600SemiBold, sans-serif',
    padding: '14px 16px',
    width: '100%',
    borderRadius: '12px',
    border: '1.5px solid',
    borderColor: isFocused ? Colors.marigold : isHovered ? Colors.marigoldLight : Colors.ivoryLine,
    backgroundColor: Colors.white,
    color: Colors.ink,
    outline: 'none',
    boxSizing: 'border-box',
    cursor: 'pointer',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxShadow: isFocused ? `0 0 0 3px ${Colors.marigold}25` : 'none',
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.modalContainer} pointerEvents="box-none">
        <View style={styles.webSheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.sheetTitle}>{showOptions ? choosePatternLabel : chooseDateLabel}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>{cancelLabel}</Text>
            </TouchableOpacity>
          </View>

          {/* Date picker section */}
          {!showOptions && (
            <>
              <input
                type="date"
                value={tempDateStr}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setTempDateStr(e.target.value);
                }}
                style={inputStyle}
              />
              {options && options.length > 0 ? (
                <TouchableOpacity style={styles.nextBtn} onPress={commit}>
                  <Text style={styles.nextBtnText}>{nextLabel}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.nextBtn} onPress={commit}>
                  <Text style={styles.nextBtnText}>{language === 'hi' ? 'पुष्टि करें' : 'Confirm'}</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Recurrence options section */}
          {showOptions && (
            <ScrollView showsVerticalScrollIndicator={false} style={styles.optionsScroll}>
              {dateSubLabel ? <Text style={styles.optionsSub}>{dateSubLabel}</Text> : null}
              {options!.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={styles.optionRow}
                  onPress={() => onSelectOption?.(opt)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  <Text style={styles.optionArrow}>›</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setConfirmedDate(null)}
              >
                <Text style={styles.backBtnText}>{language === 'hi' ? '← वापस' : '← Back'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23,27,54,0.45)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  webSheet: {
    backgroundColor: Colors.ivory,
    borderRadius: Radius.md,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    maxHeight: 520,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 17,
    color: Colors.ink,
    flex: 1,
  },
  closeBtn: {
    paddingLeft: 12,
  },
  closeBtnText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: Colors.inkSoft,
  },
  nextBtn: {
    marginTop: 14,
    backgroundColor: Colors.tealDeep,
    borderRadius: Radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  nextBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: Colors.white,
  },
  optionsScroll: {
    maxHeight: 380,
  },
  optionsSub: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: Colors.inkSoft,
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  optionLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13.5,
    color: Colors.indigo950,
    flex: 1,
  },
  optionArrow: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 20,
    color: Colors.marigold,
    marginLeft: 8,
  },
  backBtn: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  backBtnText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: Colors.inkSoft,
  },
});
