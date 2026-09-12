import React from 'react';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import { Colors, Radius, Typography } from '@/constants/theme';

type Variant = 'primary' | 'ghost' | 'outline' | 'dark';

interface ButtonProps {
  title: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
  testID?: string;
}

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  compact,
  style,
  contentStyle,
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
      textColor={textColor}
      disabled={disabled || loading}
      onPress={onPress}
      contentStyle={[
        styles.content,
        compact && styles.compactContent,
        contentStyle,
      ]}
      style={[
        styles.button,
        compact && styles.compactButton,
        !isOutline && { backgroundColor: buttonColor },
        isOutline && styles.outlinedBorder,
        (disabled || loading) && { opacity: 0.8 },
        style,
      ]}
      labelStyle={[
        styles.label,
        compact && styles.compactLabel,
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
  compactButton: {
    borderRadius: Radius.full,
    marginVertical: 0,
    minHeight: 32,
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
  compactContent: {
    paddingVertical: 0,
    height: 32,
    paddingHorizontal: 8,
  },
  label: {
    ...Typography.title,
    fontSize: 14.5,
    marginVertical: 4,
  },
  compactLabel: {
    fontSize: 12.5,
    marginVertical: 0,
    marginHorizontal: 4,
    lineHeight: 16,
  },
});

