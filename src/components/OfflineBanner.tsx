import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useNetworkStatus } from '@/providers/NetworkProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { Typography } from '@/constants/theme';

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const { translate } = useTranslation();

  if (isOnline) {
    return null;
  }

  return (
    <View style={styles.bannerContainer} testID="offline-banner">
      <Text style={styles.bannerText}>
        {translate('offlineBannerTitle')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    width: '100%',
    ...Platform.select({
      web: {
        position: 'sticky' as any,
        top: 0,
      },
    }),
  },
  bannerText: {
    ...Typography.caption,
    color: '#92400E',
    fontWeight: '700',
    textAlign: 'center',
  },
});
