import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  timeFieldStyles as styles,
  formatTime,
  parseTime,
  toTimeString,
  type TimeFieldProps,
} from '@/components/timeFieldShared';

export function TimeField({ label, value, onChange, hint }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(parseTime(value));

  const commit = (date: Date) => {
    onChange(toTimeString(date));
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
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => {
          setTemp(parseTime(value));
          setOpen(true);
        }}
      >
        <Text style={styles.triggerText}>🕐  {formatTime(value)}</Text>
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
            <DateTimePicker value={temp} mode="time" display="spinner" onChange={onPickerChange} />
          </View>
        </Modal>
      ) : open ? (
        <DateTimePicker value={temp} mode="time" display="default" onChange={onPickerChange} />
      ) : null}
    </View>
  );
}

export type { TimeFieldProps };
