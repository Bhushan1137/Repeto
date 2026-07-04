import React from 'react';
import { Switch } from 'react-native-paper';
import { Colors } from '@/constants/theme';

interface ToggleProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
}

export function Toggle({ value, onValueChange }: ToggleProps) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      color={Colors.teal}
    />
  );
}

