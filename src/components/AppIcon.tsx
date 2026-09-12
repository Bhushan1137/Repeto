import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

export type AppIconName =
  | 'home'
  | 'home-outline'
  | 'people'
  | 'people-outline'
  | 'stats-chart'
  | 'stats-chart-outline'
  | 'person-circle'
  | 'person-circle-outline'
  | 'add'
  | 'close'
  | 'close-circle-outline'
  | 'calendar-outline'
  | 'trash-outline'
  | 'share-outline'
  | 'time-outline'
  | 'create-outline'
  | 'play-skip-forward-outline'
  | 'chevron-down-outline'
  | 'copy-outline'
  | 'search-outline'
  | 'bookmark'
  | 'bookmark-outline'
  | 'documents-outline'
  | 'archive-outline'
  | 'checkmark-circle'
  | 'checkmark-circle-outline'
  | 'checkmark-done-outline'
  | 'close-circle'
  | 'sparkles'
  | 'notifications-outline'
  | 'qr-code-outline'
  | 'filter-outline'
  | 'ellipsis-horizontal'
  | 'star-outline'
  | 'chevron-back'
  | 'chevron-forward'
  | 'chevron-up-outline'
  | 'camera-outline'
  | 'warning-outline'
  | 'send-outline'
  | 'chatbox-ellipses-outline'
  | 'mail-outline'
  | 'mail-open-outline'
  | 'eye-off-outline'
  | 'eye-outline'
  | 'logo-google'
  | 'lock-closed-outline'
  | 'person-outline'
  | 'information-circle-outline'
  | 'card-outline'
  | 'checkmark'
  | 'settings-outline'
  | 'person-remove-outline'
  | 'exit-outline'
  | 'log-out-outline'
  | 'arrow-undo-outline'
  | 'refresh-outline';

interface AppIconProps {
  name: AppIconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function AppIcon({ name, size = 22, color = '#1B1F3B', style }: AppIconProps) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
