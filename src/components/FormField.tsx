import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput as PaperInput, HelperText } from 'react-native-paper';
import { Colors } from '@/constants/theme';

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad' | 'number-pad';
  maxLength?: number;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  style?: any;
  testID?: string;
}

export function FormField({
  label,
  error,
  hint,
  style,
  editable = true,
  testID,
  ...props
}: FormFieldProps) {
  return (
    <View style={styles.wrap} testID={testID}>
      <PaperInput
        mode="outlined"
        label={label}
        error={!!error}
        editable={editable}
        outlineColor={Colors.ivoryLine}
        activeOutlineColor={Colors.marigoldDeep}
        textColor={Colors.ink}
        style={[
          styles.input,
          !editable && styles.inputDisabled,
          style,
        ]}
        theme={{
          colors: {
            background: Colors.white,
          },
        }}
        {...props}
      />
      {error ? (
        <HelperText type="error" visible={!!error} style={styles.helperError}>
          {error}
        </HelperText>
      ) : hint ? (
        <HelperText type="info" visible={!!hint} style={styles.helperHint}>
          {hint}
        </HelperText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  input: {
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
  },
  inputDisabled: {
    backgroundColor: Colors.ivoryDim,
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
});

