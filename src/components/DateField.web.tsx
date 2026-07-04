import React, { useState } from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import {
  dateFieldStyles as styles,
  formatDisplayDate,
  parseDate,
  type DateFieldProps,
} from '@/components/dateFieldShared';

export function DateField({ label, value, onChange, hint, minimumDate }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(parseDate(value));

  const commit = (date: Date) => {
    onChange(date.toISOString().slice(0, 10));
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.trigger}
        onPress={() => {
          setTemp(parseDate(value));
          setOpen(true);
        }}
      >
        <Text style={styles.triggerText}>📅 {formatDisplayDate(value)}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {open ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.webSheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <input
              type="date"
              value={value ?? temp.toISOString().slice(0, 10)}
              min={minimumDate?.toISOString().slice(0, 10)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => commit(new Date(e.target.value))}
              style={{ fontSize: 16, padding: 12, width: '100%' } as React.CSSProperties}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

export type { DateFieldProps };
