import React from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions, Pressable } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { CATEGORIES } from '@/constants/categories';
import { Colors, Radius } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/Button';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { AppIcon } from '@/components/AppIcon';
import type { CategoryKey } from '@/types';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CategoriesScreen() {
  const router = useRouter();
  const { categories, toggleCategory, buildSuggestions } = useOnboarding();
  const { translate, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Responsive columns: 4 cols if screen width > 360, otherwise 3 cols
  const numColumns = width > 360 ? 4 : 3;
  // Calculate pixel width accounting for 16px padding each side and 8px gaps between cards
  const horizontalPadding = 32; // 16px × 2 sides
  const gapTotal = (numColumns - 1) * 8;
  const cardWidth = Math.floor((width - horizontalPadding - gapTotal) / numColumns);

  const handleContinue = () => {
    buildSuggestions();
    router.push('/(onboarding)/suggestions');
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 16) + 16,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        },
      ]}
      showsVerticalScrollIndicator={false}
      testID="categories-screen-scroll"
    >
      <OnboardingProgress step={3} />
      
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} testID="categories-title">{translate('whatRepeats')}</Text>
          <View style={styles.infoRow} testID="categories-info-row">
            <AppIcon name="checkmark-circle-outline" size={16} color={Colors.tealDeep} />
            <Text style={styles.infoText} testID="categories-info-text">{translate('youCanChangeAnytime')}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => {
            const allKeys = CATEGORIES.map((c) => c.key);
            if (categories.length === allKeys.length) {
              allKeys.forEach((k) => {
                if (categories.includes(k as CategoryKey)) toggleCategory(k as CategoryKey);
              });
            } else {
              allKeys.forEach((k) => {
                if (!categories.includes(k as CategoryKey)) toggleCategory(k as CategoryKey);
              });
            }
          }}
          style={styles.selectAllBtn}
        >
          <Text style={styles.selectAllText}>
            {categories.length === CATEGORIES.length
              ? (language === 'hi' ? 'सभी हटाएं' : 'Clear All')
              : (language === 'hi' ? 'सभी चुनें' : 'Select All')}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sub} testID="categories-subtitle">{translate('whatRepeatsSub')}</Text>

      <View style={styles.grid} testID="categories-grid">
        {CATEGORIES.map((cat) => {
          const active = categories.includes(cat.key);
          const label = language === 'hi' ? cat.labelHi : cat.labelEn;
          const hint = language === 'hi' ? cat.hintHi : cat.hintEn;

          return (
            <View
              key={cat.key}
              style={[styles.catCard, { width: cardWidth }, active ? styles.catCardActive : styles.catCardInactive]}
              testID={`categories-card-${cat.key}`}
            >
              <TouchableRipple
                onPress={() => toggleCategory(cat.key as CategoryKey)}
                style={styles.cardRipple}
                testID={`categories-chip-${cat.key}`}
                borderless
              >
                <View style={styles.cardContent} testID={`categories-card-content-${cat.key}`}>
                  {/* Selection Indicator */}
                  <View style={[styles.indicator, active && styles.indicatorActive]} testID={`categories-indicator-${cat.key}`}>
                    {active ? (
                      <Text style={styles.indicatorCheck}>✓</Text>
                    ) : (
                      <View style={styles.indicatorUnchecked} />
                    )}
                  </View>

                  <View style={styles.iconWrap} testID={`categories-icon-wrap-${cat.key}`}>
                    <Text style={styles.icon}>{cat.icon}</Text>
                  </View>
                  <Text style={styles.catLabel} numberOfLines={1}>{label}</Text>
                  {hint ? (
                    <Text style={styles.catHint} numberOfLines={2}>
                      {hint}
                    </Text>
                  ) : null}
                </View>
              </TouchableRipple>
            </View>
          );
        })}
      </View>

      <View style={styles.ctaRow} testID="categories-cta-row">
        <Button
          title={translate('skipForNow')}
          variant="ghost"
          style={styles.skipBtn}
          onPress={() => {
            buildSuggestions();
            router.push('/(onboarding)/suggestions');
          }}
          testID="categories-skip-btn"
        />
        <Button
          title={language === 'hi' ? 'टास्क चुनें →' : 'Review Suggestions →'}
          style={[styles.cta, categories.length === 0 ? styles.disabled : undefined]}
          disabled={categories.length === 0}
          onPress={handleContinue}
          testID="categories-continue-btn"
        />
      </View>

      <View style={styles.privacyFooter} testID="categories-privacy-footer">
        <AppIcon name="lock-closed-outline" size={14} color={Colors.inkFaint} />
        <Text style={styles.privacyText} testID="categories-privacy-text">{translate('privacyNotice')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 56, paddingBottom: 40, backgroundColor: Colors.surfaceMuted },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 10 },
  selectAllBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: Colors.ivoryDim, marginTop: 4 },
  selectAllText: { fontFamily: 'Manrope_700Bold', fontSize: 11.5, color: Colors.marigoldDeep },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 22, color: Colors.ink, marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  infoText: { fontSize: 12, color: Colors.tealDeep, fontFamily: 'Manrope_600SemiBold' },
  sub: { fontSize: 13, color: Colors.inkSoft, marginBottom: 18, fontFamily: 'Manrope_400Regular' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' },
  catCard: {
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    marginBottom: 8,
  },
  catCardInactive: {
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    backgroundColor: Colors.white,
  },
  catCardActive: {
    borderWidth: 1.5,
    borderColor: Colors.teal,
    backgroundColor: 'rgba(62,124,106,0.06)',
  },
  cardRipple: {
    padding: 10,
  },
  cardContent: {
    gap: 4,
    alignItems: 'flex-start',
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorActive: {
    backgroundColor: Colors.teal,
  },
  indicatorCheck: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  indicatorUnchecked: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.inkFaint,
    opacity: 0.5,
  },
  iconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted },
  icon: { fontSize: 16 },
  catLabel: { fontFamily: 'Manrope_700Bold', fontSize: 12, color: Colors.ink, marginTop: 4 },
  catHint: { fontSize: 9, color: Colors.inkFaint, lineHeight: 11, minHeight: 22 },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  skipBtn: {
    flex: 1,
  },
  cta: {
    flex: 1.2,
  },
  disabled: { opacity: 0.4 },
  privacyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 32,
    opacity: 0.7,
  },
  privacyText: {
    fontSize: 11.5,
    color: Colors.inkFaint,
    fontFamily: 'Manrope_600SemiBold',
  },
});

