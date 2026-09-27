import React, { useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { Colors, Radius } from '@/constants/theme';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export function OtpInput({
  length = 6,
  value = '',
  onChange,
  onComplete,
  disabled = false,
  error = false,
}: OtpInputProps) {
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const digits = value.split('').slice(0, length);

  // Pad digits array with empty strings up to length
  while (digits.length < length) {
    digits.push('');
  }

  useEffect(() => {
    // Auto-focus first input if empty on mount
    if (!value && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, []);

  const handleChangeText = (text: string, index: number) => {
    if (disabled) return;

    // Handle full paste (e.g. user pastes "482915")
    const cleanNumbers = text.replace(/[^0-9]/g, '');
    if (cleanNumbers.length > 1) {
      const pastedDigits = cleanNumbers.slice(0, length);
      onChange(pastedDigits);
      if (pastedDigits.length === length) {
        onComplete?.(pastedDigits);
        inputRefs.current[length - 1]?.focus();
      } else {
        inputRefs.current[pastedDigits.length]?.focus();
      }
      return;
    }

    // Single digit input
    const char = cleanNumbers.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    const combined = newDigits.join('');
    onChange(combined);

    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (!char && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (combined.length === length && !newDigits.includes('')) {
      onComplete?.(combined);
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (disabled) return;

    if (e.nativeEvent.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Current box is already empty; clear previous and move focus back
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current box
        const newDigits = [...digits];
        newDigits[index] = '';
        onChange(newDigits.join(''));
      }
    }
  };

  return (
    <View style={styles.container}>
      {digits.map((digit, index) => {
        const isFilled = Boolean(digit);
        return (
          <Pressable
            key={index}
            onPress={() => {
              const firstEmptyIndex = digits.findIndex((d) => !d);
              const targetIndex = firstEmptyIndex !== -1 && firstEmptyIndex < index ? firstEmptyIndex : index;
              inputRefs.current[targetIndex]?.focus();
            }}
            style={[
              styles.cellWrapper,
              isFilled && styles.cellWrapperFilled,
              error && styles.cellWrapperError,
              disabled && styles.cellWrapperDisabled,
            ]}
          >
            <TextInput
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[styles.input, isFilled && styles.inputFilled]}
              keyboardType="number-pad"
              maxLength={length} // Allow pasting full code
              value={digit}
              onChangeText={(text) => handleChangeText(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              editable={!disabled}
              selectTextOnFocus
              textAlign="center"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginVertical: 12,
  },
  cellWrapper: {
    width: 44,
    height: 52,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellWrapperFilled: {
    borderColor: Colors.marigoldDeep,
    backgroundColor: Colors.white,
  },
  cellWrapperError: {
    borderColor: Colors.clay,
    backgroundColor: '#FEF2F2',
  },
  cellWrapperDisabled: {
    opacity: 0.5,
  },
  input: {
    width: '100%',
    height: '100%',
    fontSize: 22,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.ink,
    textAlign: 'center',
    padding: 0,
  },
  inputFilled: {
    color: Colors.indigo950,
  },
});
