import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TouchableOpacity } from 'react-native';
import {
  timeFieldStyles as styles,
  formatTime,
  parseTime,
  toTimeString,
  type TimeFieldProps,
} from '@/components/timeFieldShared';
import { Colors } from '@/constants/theme';

export function TimeField({ label, value, onChange, hint }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [temp, setTemp] = useState(parseTime(value));

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
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.trigger}
        onPress={() => {
          setTemp(parseTime(value));
          setOpen(true);
        }}
      >
        <Text style={styles.triggerText}>🕐  {formatTime(value)}</Text>
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

              {/* Time input */}
              <input
                type="time"
                value={value ?? toTimeString(temp)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (e.target.value) {
                    onChange(e.target.value.slice(0, 5));
                    setOpen(false);
                  }
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

export type { TimeFieldProps };
