import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { CATEGORY_MAP } from '@/constants/categories';
import { Colors, Radius, Typography } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/Button';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { TaskFormSheet } from '@/components/TaskFormSheet';
import { formValuesToSuggestionPatch, suggestionToFormValues } from '@/domain/preset';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SuggestionsScreen() {
  const router = useRouter();
  const { suggestions, toggleSuggestion, updateSuggestion, language } = useOnboarding();
  const { translate } = useTranslation(language);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const acceptedCount = suggestions.filter((s) => s.accepted).length;
  const insets = useSafeAreaInsets();

  const editing = editIndex !== null ? suggestions[editIndex] : null;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 16) + 16,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
          },
        ]}
      >
        <OnboardingProgress step={4} />
        <Text style={styles.title}>{translate('suggestedForYou')}</Text>
        <Text style={styles.sub}>{translate('tasksWillBeAdded', { count: acceptedCount })}</Text>
        <Text style={styles.hint}>{translate('tapToEditPreset')}</Text>

        {suggestions.map((s, i) => {
          const cat = CATEGORY_MAP[s.category];
          const title = language === 'hi' ? s.titleHi : s.title;
          const freq = language === 'hi' ? s.freqHi : s.freq;
          return (
            <Card
              key={`preset-${i}`}
              style={[styles.rowCard, !s.accepted && styles.rowSkipped]}
              mode="elevated"
            >
              <TouchableRipple
                onPress={() => setEditIndex(i)}
                style={styles.cardRipple}
                borderless
              >
                <View style={styles.rowContent}>
                  <View style={styles.rowIconWrap}>
                    <Text style={styles.rowIcon}>{cat.icon}</Text>
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowTitle, !s.accepted && styles.skipped]}>{title}</Text>
                    <Text style={styles.rowFreq}>
                      {freq}
                      {s.amount ? ` · ₹${s.amount.toLocaleString('en-IN')}` : ''}
                    </Text>
                    <Text style={styles.editHint}>{translate('editPreset')}</Text>
                  </View>
                  <TouchableRipple
                    style={[styles.toggleBtn, s.accepted ? styles.toggleOn : styles.toggleOff]}
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleSuggestion(i);
                    }}
                    borderless
                  >
                    <Text style={styles.toggleText}>{s.accepted ? '✓' : '✕'}</Text>
                  </TouchableRipple>
                </View>
              </TouchableRipple>
            </Card>
          );
        })}

        <Button title={translate('continueBtn')} style={styles.cta} onPress={() => router.push('/(onboarding)/finish')} />
      </ScrollView>

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
  toggleOff: { backgroundColor: Colors.clay, borderColor: Colors.clay, opacity: 0.5 },
  toggleText: { color: Colors.white, fontSize: 13, textAlign: 'center' },
  cta: { marginTop: 22 },
});

