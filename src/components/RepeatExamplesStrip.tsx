import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { Colors, Radius, Typography } from '@/constants/theme';
import type { Language, RecurrenceType } from '@/types';

interface ExampleItem {
  titleEn: string;
  titleHi: string;
  subEn: string;
  subHi: string;
  icon: string;
  config: {
    recurrenceType: RecurrenceType;
    reminderTime: string;
    interval?: number;
    intervalUnit?: 'days' | 'months';
    dayOfMonth?: number;
    weekday?: number;
  };
}

interface RepeatExamplesStripProps {
  language: Language;
  onSelect: (config: ExampleItem['config']) => void;
}

export function RepeatExamplesStrip({ language, onSelect }: RepeatExamplesStripProps) {
  const examples: ExampleItem[] = useMemo(() => [
    {
      titleEn: 'Every day',
      titleHi: 'हर दिन',
      subEn: 'Remind me daily at 9:00 AM',
      subHi: 'रोज सुबह 9:00 बजे याद दिलाएं',
      icon: '☀️',
      config: { recurrenceType: 'daily', reminderTime: '09:00' },
    },
    {
      titleEn: 'Every week',
      titleHi: 'हर हफ्ते',
      subEn: 'Remind me Mon at 7:00 PM',
      subHi: 'सोमवार शाम 7:00 बजे याद दिलाएं',
      icon: '📅',
      config: { recurrenceType: 'weekly', weekday: 1, reminderTime: '19:00' },
    },
    {
      titleEn: 'Every month',
      titleHi: 'हर महीने',
      subEn: 'Remind me on the 5th at 9:00 AM',
      subHi: 'महीने की 5 तारीख सुबह 9:00 बजे',
      icon: '🗓️',
      config: { recurrenceType: 'monthDay', dayOfMonth: 5, reminderTime: '09:00' },
    },
    {
      titleEn: 'Every year',
      titleHi: 'हर साल',
      subEn: 'Remind me on 15 Aug at 10:00 AM',
      subHi: '15 अगस्त सुबह 10:00 बजे',
      icon: '🎉',
      config: { recurrenceType: 'yearly', reminderTime: '10:00' },
    },
    {
      titleEn: 'Custom',
      titleHi: 'कस्टम',
      subEn: 'Remind me every 45 days at 8:00 AM',
      subHi: 'हर 45 दिन सुबह 8:00 बजे',
      icon: '⚙️',
      config: { recurrenceType: 'interval', interval: 45, intervalUnit: 'days', reminderTime: '08:00' },
    },
  ], [language]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        {language === 'hi' ? 'सामान्य पुनरावृत्ति उदाहरण (चुनने के लिए टैप करें)' : 'Common repeat examples (Tap to select)'}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {examples.map((ex, i) => {
          const title = language === 'hi' ? ex.titleHi : ex.titleEn;
          const sub = language === 'hi' ? ex.subHi : ex.subEn;
          return (
            <Card key={i} style={styles.pillCard} mode="elevated">
              <TouchableOpacity
                onPress={() => onSelect(ex.config)}
                style={styles.pillTouchable}
                activeOpacity={0.7}
              >
                <Text style={styles.pillIcon}>{ex.icon}</Text>
                <View style={styles.textWrapper}>
                  <Text style={styles.pillTitle}>{title}</Text>
                  <Text style={styles.pillSub}>{sub}</Text>
                </View>
              </TouchableOpacity>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  scrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  pillCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    elevation: 1,
  },
  pillTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  pillIcon: {
    fontSize: 16,
  },
  textWrapper: {
    justifyContent: 'center',
  },
  pillTitle: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
  pillSub: {
    fontSize: 9.5,
    color: Colors.inkSoft,
    marginTop: 1,
    fontFamily: 'Manrope_500Medium',
  },
});
