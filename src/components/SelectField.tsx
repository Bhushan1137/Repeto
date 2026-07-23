import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Text, TextInput as PaperInput, HelperText, TouchableRipple, Card } from 'react-native-paper';
import { Colors, Radius, Typography } from '@/constants/theme';
import { AppIcon } from '@/components/AppIcon';

export interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string | number = string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  hint?: string;
  error?: string;
  testID?: string;
}

export function SelectField<T extends string | number = string>({
  label,
  value,
  options,
  onChange,
  hint,
  error,
  testID,
}: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable onPress={() => setOpen(true)} testID={testID ? `${testID}-trigger` : undefined}>
        <View pointerEvents="none">
          <PaperInput
            mode="outlined"
            label={label}
            value={selected?.label ?? '—'}
            error={!!error}
            editable={false}
            outlineColor={Colors.ivoryLine}
            activeOutlineColor={Colors.marigoldDeep}
            textColor={Colors.ink}
            style={styles.input}
            right={<PaperInput.Icon icon={() => <AppIcon name="chevron-down-outline" size={18} color={Colors.inkSoft} />} />}
            theme={{
              colors: {
                background: Colors.white,
              },
            }}
          />
        </View>
      </Pressable>
      
      {error ? (
        <HelperText type="error" visible={!!error} style={styles.helperError}>
          {error}
        </HelperText>
      ) : hint ? (
        <HelperText type="info" visible={!!hint} style={styles.helperHint}>
          {hint}
        </HelperText>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <Card style={styles.sheet} mode="elevated">
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{label}</Text>
          <ScrollView style={styles.optionsList} keyboardShouldPersistTaps="handled">
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <TouchableRipple
                  key={String(opt.value)}
                  style={[styles.option, active && styles.optionActive]}
                  testID={testID ? `${testID}-option-${opt.value}` : undefined}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  borderless
                >
                  <View style={styles.optionInner}>
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{opt.label}</Text>
                    {active ? <Text style={styles.check}>✓</Text> : null}
                  </View>
                </TouchableRipple>
              );
            })}
          </ScrollView>
        </Card>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  input: {
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
  },
  helperError: {
    paddingHorizontal: 8,
    marginTop: 2,
    fontSize: 12,
    color: Colors.clayDeep,
    fontFamily: 'Manrope_600SemiBold',
  },
  helperHint: {
    paddingHorizontal: 8,
    marginTop: 2,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(23,27,54,0.45)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: '60%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    elevation: 8,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.ivoryLine,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
    color: Colors.ink,
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  optionsList: { paddingHorizontal: 12 },
  option: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  optionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  optionActive: { backgroundColor: 'rgba(232,163,61,0.06)', borderRadius: Radius.sm },
  optionText: { fontFamily: 'Manrope_600SemiBold', fontSize: 14.5, color: Colors.ink },
  optionTextActive: { fontFamily: 'Manrope_700Bold', color: Colors.marigoldDeep },
  check: { color: Colors.teal, fontSize: 16, fontFamily: 'Manrope_800ExtraBold' },
});

