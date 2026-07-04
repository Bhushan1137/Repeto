import React, { useState } from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
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

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.trigger}
        onPress={() => {
          setTemp(parseTime(value));
          setOpen(true);
        }}
      >
        <Text style={styles.triggerText}>🕐 {formatTime(value)}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {open ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.webSheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <input
              type="time"
              value={value ?? toTimeString(temp)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                onChange(e.target.value.slice(0, 5));
                setOpen(false);
              }}
              style={{ fontSize: 16, padding: 12, width: '100%' } as React.CSSProperties}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

export type { TimeFieldProps };
