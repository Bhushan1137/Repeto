import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { PresetLibrarySheet } from '@/components/profile/PresetLibrarySheet';

export default function PresetsScreen() {
  const router = useRouter();
  const { language } = useTranslation();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.surface }}>
      <PresetLibrarySheet
        visible={true}
        onClose={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)');
          }
        }}
        language={language}
      />
    </View>
  );
}
