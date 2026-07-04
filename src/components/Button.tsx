import React from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import { Colors, Radius, Typography } from '@/constants/theme';

type Variant = 'primary' | 'ghost' | 'outline' | 'dark';

interface ButtonProps {
  title: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: any;
  textStyle?: TextStyle;
}

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  style,
  textStyle,
  onPress,
  ...rest
}: ButtonProps) {
  const isOutline = variant === 'outline';
  const isDark = variant === 'dark';
  
  let mode: 'contained' | 'outlined' | 'text' = 'contained';
  let buttonColor: string = Colors.marigold;
  let textColor: string = Colors.indigo950;
  
  if (variant === 'ghost') {
    buttonColor = Colors.ivoryDim;
    textColor = Colors.ink;
  } else if (isOutline) {
    mode = 'outlined';
    buttonColor = 'transparent';
    textColor = Colors.ink;
  } else if (isDark) {
    buttonColor = Colors.indigo950;
    textColor = Colors.onDark;
  }

  return (
    <PaperButton
      mode={mode}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      contentStyle={styles.content}
      style={[
        styles.button,
        !isOutline && { backgroundColor: buttonColor },
        isOutline && styles.outlinedBorder,
        style,
      ]}
      labelStyle={[
        styles.label,
        { color: textColor },
        textStyle,
      ]}
      {...rest}
    >
      {title}
    </PaperButton>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.full,
    marginVertical: 4,
  },
  outlinedBorder: {
    borderColor: Colors.ivoryLine,
    borderWidth: 1.5,
    backgroundColor: Colors.white,
  },
  content: {
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.title,
    fontSize: 14.5,
    marginVertical: 4,
  },
});

