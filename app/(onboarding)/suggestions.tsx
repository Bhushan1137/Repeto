import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { CATEGORY_MAP } from '@/constants/categories';
import { Colors, Radius } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/Button';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { TaskFormSheet } from '@/components/TaskFormSheet';
import { formValuesToSuggestionPatch, suggestionToFormValues } from '@/domain/preset';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SuggestionsScreen() {
  const router = useRouter();
  const { suggestions, toggleSuggestion, updateSuggestion, language, categories } = useOnboarding();
  const { translate } = useTranslation(language);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const acceptedCount = suggestions.filter((s) => s.accepted).length;
  const insets = useSafeAreaInsets();

  const editing = editIndex !== null ? suggestions[editIndex] : null;

  // Group suggestions by selected category to match requirements
  const groupedSuggestions = categories.map((catKey) => {
    const items = suggestions
      .map((s, idx) => ({ s, idx }))
      .filter((item) => item.s.category === catKey);
    return {
      categoryKey: catKey,
      items,
    };
  }).filter((group) => group.items.length > 0);

  return (
    <View style={styles.screen} testID="suggestions-screen-root">
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 16) + 16,
            paddingBottom: 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        testID="suggestions-screen-scroll"
      >
        <OnboardingProgress step={4} />
        <Text style={styles.title} testID="suggestions-title">{translate('suggestedForYou')}</Text>
        <Text style={styles.sub} testID="suggestions-subtitle">{translate('tasksWillBeAdded', { count: acceptedCount })}</Text>
        <Text style={styles.hint} testID="suggestions-hint">{translate('tapToEditPreset')}</Text>

        {groupedSuggestions.map((group) => {
          const cat = CATEGORY_MAP[group.categoryKey];
          const catLabel = language === 'hi' ? cat.labelHi : cat.labelEn;

          return (
            <View key={group.categoryKey} style={styles.sectionBlock} testID={`suggestions-section-${group.categoryKey}`}>
              <Text style={styles.sectionHeader} testID={`suggestions-section-header-${group.categoryKey}`}>{catLabel}</Text>
              
              {group.items.map(({ s, idx }) => {
                const title = language === 'hi' ? s.titleHi : s.title;
                const freq = language === 'hi' ? s.freqHi : s.freq;
                return (
                  <Card
                    key={`preset-${idx}`}
                    style={[styles.rowCard, !s.accepted && styles.rowSkipped]}
                    mode="elevated"
                    testID={`suggestions-card-${idx}`}
                  >
                    <TouchableRipple
                      onPress={() => setEditIndex(idx)}
                      style={styles.cardRipple}
                      testID={`suggestions-card-ripple-${idx}`}
                      borderless
                    >
                      <View style={styles.rowContent} testID={`suggestions-row-content-${idx}`}>
                        <View style={styles.rowIconWrap} testID={`suggestions-icon-wrap-${idx}`}>
                          <Text style={styles.rowIcon}>{cat.icon}</Text>
                        </View>
                        <View style={styles.rowInfo} testID={`suggestions-row-info-${idx}`}>
                          <Text style={[styles.rowTitle, !s.accepted && styles.skipped]} testID={`suggestions-row-title-${idx}`}>{title}</Text>
                          <Text style={styles.rowFreq} testID={`suggestions-row-freq-${idx}`}>
                            {freq}
                            {s.amount ? ` · ₹${s.amount.toLocaleString('en-IN')}` : ''}
                          </Text>
                          <Text style={styles.editHint} testID={`suggestions-row-edit-hint-${idx}`}>{translate('editPreset')}</Text>
                        </View>
                        <View onStartShouldSetResponder={() => true} testID={`suggestions-toggle-wrapper-${idx}`}>
                          <TouchableRipple
                            style={[styles.toggleBtn, s.accepted ? styles.toggleOn : styles.toggleOff]}
                            onPress={() => toggleSuggestion(idx)}
                            testID={`suggestions-toggle-btn-${idx}`}
                            borderless
                          >
                            <Text style={styles.toggleText}>{s.accepted ? '✓' : '✕'}</Text>
                          </TouchableRipple>
                        </View>
                      </View>
                    </TouchableRipple>
                  </Card>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* Sticky Bottom Footer for Continue & Skip CTA Buttons */}
      <View
        style={[
          styles.stickyFooter,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
        testID="suggestions-cta-row"
      >
        <Button
          title={translate('skipSuggestions')}
          variant="ghost"
          style={styles.skipBtn}
          onPress={() => router.push('/(onboarding)/finish')}
          testID="suggestions-skip-btn"
        />
        <Button
          title={
            language === 'hi'
              ? `${acceptedCount} कार्य शेड्यूल करें →`
              : `Add ${acceptedCount} Tasks →`
          }
          style={styles.ctaBtn}
          disabled={acceptedCount === 0}
          onPress={() => router.push('/(onboarding)/finish')}
          testID="suggestions-continue-btn"
        />
      </View>

      <TaskFormSheet
        visible={editIndex !== null}
        language={language}
        translate={translate}
        heading={translate('editPreset')}
        initial={editing ? suggestionToFormValues(editing, language) : null}
        mode="edit"
        saveLabel={translate('savePreset')}
        onClose={() => setEditIndex(null)}
        onSave={(values) => {
          if (editIndex === null) return;
          updateSuggestion(editIndex, formValuesToSuggestionPatch(values, language));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.surfaceMuted },
  container: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 24, color: Colors.ink, marginTop: 14, marginBottom: 4 },
  sub: { fontSize: 13.5, color: Colors.inkSoft, marginBottom: 4 },
  hint: { fontSize: 12, color: Colors.tealDeep, marginBottom: 12 },
  rowCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 1,
  },
  rowSkipped: { opacity: 0.55 },
  cardRipple: {
    padding: 14,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcon: { fontSize: 18 },
  rowInfo: { flex: 1 },
  rowTitle: { fontFamily: 'Manrope_700Bold', fontSize: 13.5, color: Colors.ink },
  skipped: { textDecorationLine: 'line-through', opacity: 0.4 },
  rowFreq: { fontSize: 11.5, color: Colors.inkSoft, marginTop: 2 },
  editHint: { fontSize: 10.5, color: Colors.inkFaint, marginTop: 4, fontFamily: 'Manrope_600SemiBold' },
  toggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  toggleOn: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  toggleOff: { backgroundColor: Colors.clay, borderColor: Colors.clay },
  toggleText: { color: Colors.white, fontSize: 13, textAlign: 'center' },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: Colors.surfaceMuted,
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryLine,
    gap: 12,
    elevation: 8,
  },
  skipBtn: {
    flex: 1,
  },
  ctaBtn: {
    flex: 1.2,
  },
  sectionBlock: {
    marginTop: 18,
    marginBottom: 6,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 2,
  },
});

