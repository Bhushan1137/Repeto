import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Colors, Radius } from '@/constants/theme';

export interface RecurrenceOption {
  key: string;
  label: string;
  rule: object;
}

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
  const [temp, setTemp] = useState(value);
  const [confirmedDate, setConfirmedDate] = useState<Date | null>(null);

  const cancelLabel = language === 'hi' ? 'रद्द करें' : 'Cancel';
  const doneLabel = language === 'hi' ? 'हो गया' : 'Done';
  const choosePatterLabel =
    language === 'hi' ? 'आवृत्ति चुनें' : 'Choose how often';
  const dateSubLabel =
    language === 'hi'
      ? confirmedDate
        ? `तारीख: ${confirmedDate.toLocaleDateString('hi-IN', { weekday: 'long', day: 'numeric', month: 'short' })}`
        : ''
      : confirmedDate
      ? `Based on: ${confirmedDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}`
      : '';

  const onPickerChange = (_: DateTimePickerEvent, date?: Date) => {
    if (!date) {
      if (Platform.OS === 'android') onClose();
      return;
    }
    setTemp(date);
    if (Platform.OS === 'android') {
      if (options && options.length > 0) {
        setConfirmedDate(date);
        onConfirm(date);
      } else {
        onConfirm(date);
      }
    }
  };

  const handleDone = () => {
    if (options && options.length > 0) {
      setConfirmedDate(temp);
      onConfirm(temp);
    } else {
      onConfirm(temp);
    }
  };

  if (!visible) return null;

  const showOptions = options && options.length > 0 && confirmedDate !== null;

  if (Platform.OS === 'ios') {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.iosSheet}>
          <View style={styles.iosBar}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancel}>{cancelLabel}</Text>
            </TouchableOpacity>
            {!showOptions && (
              <TouchableOpacity onPress={handleDone}>
                <Text style={styles.done}>{doneLabel}</Text>
              </TouchableOpacity>
            )}
          </View>

          {!showOptions && (
            <DateTimePicker
              value={temp}
              mode="date"
              display="spinner"
              onChange={onPickerChange}
            />
          )}

          {options && options.length > 0 && !showOptions && (
            <TouchableOpacity style={styles.doneButtonRow} onPress={handleDone}>
              <Text style={styles.doneButtonText}>
                {language === 'hi' ? 'आगे बढ़ें →' : 'Next →'}
              </Text>
            </TouchableOpacity>
          )}

          {showOptions && (
            <View style={styles.optionsSection}>
              <Text style={styles.optionsTitle}>{choosePatterLabel}</Text>
              {dateSubLabel ? <Text style={styles.optionsSub}>{dateSubLabel}</Text> : null}
              <ScrollView showsVerticalScrollIndicator={false}>
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
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    );
  }

  // Android: show inline picker directly (system spinner handles it)
  return (
    <DateTimePicker
      value={value}
      mode="date"
      display="default"
      onChange={onPickerChange}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 27, 54, 0.45)',
  },
  iosSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
    maxHeight: '75%',
  },
  iosBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  cancel: {
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.inkSoft,
    fontSize: 15,
  },
  done: {
    fontFamily: 'Manrope_700Bold',
    color: Colors.tealDeep,
    fontSize: 15,
  },
  doneButtonRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryLine,
    marginTop: 4,
  },
  doneButtonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: Colors.tealDeep,
  },
  optionsSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    flex: 1,
  },
  optionsTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 16,
    color: Colors.indigo950,
    marginBottom: 4,
  },
  optionsSub: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: Colors.inkSoft,
    marginBottom: 14,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.ivoryDim,
    borderRadius: Radius.sm,
    marginBottom: 8,
  },
  optionLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: Colors.indigo950,
    flex: 1,
  },
  optionArrow: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 20,
    color: Colors.marigold,
    marginLeft: 8,
  },
});
