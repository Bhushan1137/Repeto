import React from 'react';
import { Switch } from 'react-native-paper';
import { Colors } from '@/constants/theme';

interface ToggleProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  testID?: string;
}

export function Toggle({ value, onValueChange, testID }: ToggleProps) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      color={Colors.teal}
      testID={testID}
    />
  );
}

