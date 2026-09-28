import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity, Text } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { Colors, Radius } from '@/constants/theme';
import type { Language } from '@/types';

interface AlarmToggleRowProps {
  value: boolean;
  onChange: (value: boolean) => void;
  language?: Language;
}

export function AlarmToggleRow({ value, onChange, language = 'en' }: AlarmToggleRowProps) {
  if (Platform.OS !== 'android') {
    return null;
  }

  const isHi = language === 'hi';

  return (
    <TouchableOpacity
      style={[styles.container, value && styles.containerActive]}
      onPress={() => onChange(!value)}
      activeOpacity={0.8}
      testID="alarm-mode-toggle"
    >
      <View style={[styles.iconWrapper, value && styles.iconWrapperActive]}>
        <AppIcon
          name={value ? 'alarm-outline' : 'notifications-outline'}
          size={20}
          color={value ? Colors.marigold : Colors.inkSoft}
        />
      </View>

      <View style={styles.textContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {isHi ? 'अलार्म मोड' : 'Alarm Mode'}
          </Text>
          {value && (
            <View style={styles.pillBadge}>
              <Text style={styles.pillBadgeText}>
                {isHi ? 'फुलस्क्रीन' : 'Fullscreen'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>
          {value
            ? isHi
              ? 'फुलस्क्रीन अलार्म — स्क्रीन लॉक होने पर भी रिंग और वेक करेगा'
              : 'Fullscreen alarm — wakes screen & rings even when locked'
            : isHi
              ? 'स्टैंडर्ड पुश नोटिफिकेशन — नोटिफिकेशन शेड में सामान्य सूचना'
              : 'Standard push notification — quiet reminder in shade'}
        </Text>
      </View>

      <View style={[styles.switchTrack, value && styles.switchTrackActive]}>
        <View style={[styles.switchThumb, value && styles.switchThumbActive]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    marginTop: 10,
  },
  containerActive: {
    borderColor: Colors.marigold,
    backgroundColor: '#FFFDF5',
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  iconWrapperActive: {
    backgroundColor: '#FEF3C7',
    borderColor: Colors.marigold,
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.ink,
  },
  pillBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.marigold,
  },
  pillBadgeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    color: '#B45309',
  },
  subtitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 2,
    lineHeight: 15,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.ivoryLine,
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: Colors.marigold,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.white,
    elevation: 1,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
});
