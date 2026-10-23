import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  dateFieldStyles as styles,
  formatDisplayDate,
  parseDate,
  type DateFieldProps,
} from '@/components/dateFieldShared';

export function DateField({ label, value, onChange, hint, minimumDate, testID }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(parseDate(value));

  const commit = (date: Date) => {
    onChange(date.toISOString().slice(0, 10));
    setOpen(false);
  };

  const onPickerChange = (_: DateTimePickerEvent, date?: Date) => {
    if (!date) {
      if (Platform.OS === 'android') setOpen(false);
      return;
    }
    setTemp(date);
    if (Platform.OS === 'android') commit(date);
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.trigger}
        testID={testID ? `${testID}-trigger` : undefined}
        onPress={() => {
          setTemp(parseDate(value));
          setOpen(true);
        }}
      >
        <Text style={styles.triggerText}>📅  {formatDisplayDate(value)}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.iosSheet}>
            <View style={styles.iosBar}>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => commit(temp)}>
                <Text style={styles.done}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={temp}
              mode="date"
              display="spinner"
              minimumDate={minimumDate}
              onChange={onPickerChange}
            />
          </View>
        </Modal>
      ) : open ? (
        <DateTimePicker
          value={temp}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={onPickerChange}
        />
      ) : null}
    </View>
  );
}

export type { DateFieldProps };
