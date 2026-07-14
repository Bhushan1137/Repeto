import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { CATEGORIES } from '@/constants/categories';
import { AccentHex, Colors, Radius } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/Button';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import type { CategoryKey } from '@/types';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CategoriesScreen() {
  const router = useRouter();
  const { categories, toggleCategory, buildSuggestions } = useOnboarding();
  const { translate, language } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 16) + 16,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        },
      ]}
    >
      <OnboardingProgress step={3} />
      <Text style={styles.title}>{translate('whatRepeats')}</Text>
      <Text style={styles.sub}>{translate('whatRepeatsSub')}</Text>

      <View style={styles.grid}>
        {CATEGORIES.map((cat) => {
          const active = categories.includes(cat.key);
          return (
            <Card
              key={cat.key}
              style={[styles.catCard, active && styles.catCardActive]}
              mode="elevated"
            >
              <TouchableRipple
                onPress={() => toggleCategory(cat.key as CategoryKey)}
                style={styles.cardRipple}
                borderless
              >
                <View style={styles.cardContent}>
                  <View style={[styles.iconWrap, { backgroundColor: `${AccentHex[cat.accent]}18` }]}>
                    <Text style={styles.icon}>{cat.icon}</Text>
                  </View>
                  <Text style={styles.catLabel}>{language === 'hi' ? cat.labelHi : cat.labelEn}</Text>
                </View>
              </TouchableRipple>
            </Card>
          );
        })}
      </View>

      <Button
        title={translate('continueBtn')}
        style={[styles.cta, categories.length === 0 ? styles.disabled : undefined]}
        disabled={categories.length === 0}
        onPress={() => {
          buildSuggestions();
          router.push('/(onboarding)/suggestions');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 56, paddingBottom: 40, backgroundColor: Colors.surfaceMuted },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 24, color: Colors.ink, marginTop: 14, marginBottom: 4 },
  sub: { fontSize: 13.5, color: Colors.inkSoft, marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCard: {
    width: '47%',
    flexGrow: 1,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    elevation: 1,
  },
  catCardActive: {
    borderWidth: 1.5,
    borderColor: Colors.marigold,
    backgroundColor: 'rgba(232,163,61,0.04)',
    elevation: 0,
  },
  cardRipple: {
    padding: 14,
  },
  cardContent: {
    gap: 8,
  },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 17 },
  catLabel: { fontFamily: 'Manrope_700Bold', fontSize: 12.5, color: Colors.ink, lineHeight: 16 },
  cta: { marginTop: 22 },
  disabled: { opacity: 0.4 },
});

