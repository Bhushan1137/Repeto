import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TouchableOpacity } from 'react-native';
import {
  dateFieldStyles as styles,
  formatDisplayDate,
  parseDate,
  type DateFieldProps,
} from '@/components/dateFieldShared';
import { Colors } from '@/constants/theme';

export function DateField({ label, value, onChange, hint, minimumDate, testID }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [temp, setTemp] = useState(parseDate(value));

  const commit = (date: Date) => {
    onChange(date.toISOString().slice(0, 10));
    setOpen(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: '15px',
    fontFamily: 'Manrope_600SemiBold, sans-serif',
    padding: '13px 14px',
    borderRadius: '10px',
    border: `1.5px solid ${isFocused ? Colors.marigold : Colors.ivoryLine}`,
    backgroundColor: Colors.white,
    color: Colors.ink,
    outline: 'none',
    boxSizing: 'border-box',
    cursor: 'pointer',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
    boxShadow: isFocused ? `0 0 0 3px ${Colors.marigold}22` : 'none',
    marginTop: '4px',
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.trigger}
        testID={testID ? `${testID}-trigger` : undefined}
        onPress={() => {
          setTemp(parseDate(value));
          setOpen(true);
        }}
      >
        <Text style={styles.triggerText}>📅  {formatDisplayDate(value)}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {open ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.webSheet} pointerEvents="box-none">
            <View style={styles.webCard}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={styles.sheetTitle}>{label}</Text>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: Colors.inkSoft }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Date input */}
              <input
                type="date"
                value={value ?? temp.toISOString().slice(0, 10)}
                min={minimumDate?.toISOString().slice(0, 10)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (e.target.value) commit(new Date(e.target.value));
                }}
                style={inputStyle}
              />

              {hint ? (
                <Text style={{ ...styles.hint, marginTop: 10 }}>{hint}</Text>
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

export type { DateFieldProps };
