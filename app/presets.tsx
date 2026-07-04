import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { CATEGORY_MAP, CATEGORIES } from '@/constants/categories';
import { Colors, Radius, Typography } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useTasks } from '@/providers/TaskProvider';
import { TaskFormSheet } from '@/components/TaskFormSheet';
import { ScreenShell } from '@/components/ScreenShell';
import { getAllPresets, presetToFormValues, type PresetListItem } from '@/domain/preset';
import type { CategoryKey } from '@/types';

export default function PresetsScreen() {
  const router = useRouter();
  const { translate, language } = useTranslation();
  const { addPresetTask } = useTasks();
  const [filter, setFilter] = useState<CategoryKey | 'all'>('all');
  const [draft, setDraft] = useState<{ preset: PresetListItem; values: ReturnType<typeof presetToFormValues> } | null>(null);

  const items = useMemo(() => {
    const all = getAllPresets();
    if (filter === 'all') return all;
    return all.filter((p) => p.category === filter);
  }, [filter]);

  const openPreset = (preset: PresetListItem) => {
    setDraft({ preset, values: presetToFormValues(preset, language) });
  };

  const handleSave = async (values: Parameters<typeof addPresetTask>[0]) => {
    const ok = await addPresetTask(values);
    if (ok) setDraft(null);
  };

  return (
    <View style={styles.root}>
      <ScreenShell
        title={translate('presetLibraryTitle')}
        subtitle={translate('presetLibrarySub')}
        headerExtra={
          <TouchableRipple onPress={() => router.back()} style={styles.backBtn} borderless>
            <Text style={styles.backText}>← {translate('backBtn')}</Text>
          </TouchableRipple>
        }
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent}>
          <FilterChip label={translate('allCategories')} active={filter === 'all'} onPress={() => setFilter('all')} />
          {CATEGORIES.map((cat) => (
            <FilterChip
              key={cat.key}
              label={`${cat.icon} ${language === 'hi' ? cat.labelHi : cat.labelEn}`}
              active={filter === cat.key}
              onPress={() => setFilter(cat.key)}
            />
          ))}
        </ScrollView>

        {items.map((preset) => {
          const cat = CATEGORY_MAP[preset.category];
          const title = language === 'hi' ? preset.titleHi : preset.title;
          const freq = language === 'hi' ? preset.freqHi : preset.freq;
          return (
            <Card key={preset.id} style={styles.rowCard} mode="elevated">
              <TouchableRipple onPress={() => openPreset(preset)} style={styles.cardRipple} borderless>
                <View style={styles.rowContent}>
                  <View style={[styles.rowIconWrap, { backgroundColor: `${Colors.teal}14` }]}>
                    <Text style={styles.rowIcon}>{cat.icon}</Text>
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{title}</Text>
                    <Text style={styles.rowFreq}>
                      {freq}
                      {preset.amount ? ` · ₹${preset.amount.toLocaleString('en-IN')}` : ''}
                    </Text>
                  </View>
                  <View style={styles.addBtn}>
                    <Text style={styles.addIcon}>+</Text>
                  </View>
                </View>
              </TouchableRipple>
            </Card>
          );
        })}
      </ScreenShell>

      <TaskFormSheet
        visible={!!draft}
        language={language}
        translate={translate}
        heading={translate('addFromPreset')}
        initial={draft?.values ?? null}
        mode="create"
        onClose={() => setDraft(null)}
        onSave={handleSave}
      />
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Card style={[styles.chipCard, active && styles.chipActive]} mode="elevated">
      <TouchableRipple style={styles.chipRipple} onPress={onPress} borderless>
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </TouchableRipple>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backBtn: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 4, paddingHorizontal: 8, borderRadius: Radius.xs },
  backText: { ...Typography.caption, color: Colors.onDarkMuted, fontFamily: 'Manrope_700Bold' },
  filters: { marginBottom: 16, maxHeight: 44 },
  filtersContent: { gap: 8, paddingRight: 16, paddingVertical: 4 },
  chipCard: {
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
    elevation: 1,
  },
  chipActive: { borderColor: Colors.marigold, backgroundColor: 'rgba(232,163,61,0.08)' },
  chipRipple: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipText: { ...Typography.caption, color: Colors.inkSoft },
  chipTextActive: { color: Colors.ink, fontFamily: 'Manrope_700Bold' },
  rowCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 1.5,
  },
  cardRipple: {
    padding: 14,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowIcon: { fontSize: 20 },
  rowInfo: { flex: 1 },
  rowTitle: { ...Typography.title, fontSize: 14, color: Colors.ink },
  rowFreq: { ...Typography.caption, color: Colors.inkSoft, marginTop: 2 },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(232,163,61,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: { fontSize: 20, color: Colors.marigoldDeep, fontFamily: 'Manrope_800ExtraBold', lineHeight: 22 },
});
