import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import type { CategoryKey, Language, RecurrenceType } from '@/types';
import type { TranslationKey } from '@/i18n';
import { FormField } from '@/components/FormField';
import { SettingRow } from '@/components/SettingRow';
import { SelectField } from '@/components/SelectField';
import { DateField } from '@/components/DateField';
import { TimeField } from '@/components/TimeField';
import { Colors, Radius, Typography } from '@/constants/theme';
import { frequencyLabelFromRule } from '@/domain/recurrence';
import { getCategoryLabel } from '@/constants/categoryHelpers';
import { CATEGORIES, CATEGORY_GROUPS, CATEGORY_MAP } from '@/constants/categories';
import { getCategoryFormConfig } from '@/constants/categoryFormConfig';
import {
  buildRecurrenceRule,
  dayOfMonthOptions,
  intervalPresets,
  nthLabel,
  recurrenceTypeLabel,
  weekdayLabel,
  type TaskFormErrors,
  type TaskFormState,
  findSchedulingConflicts,
} from '@/domain/taskForm';
import { useAuth } from '@/providers/AuthProvider';
import { useTasks } from '@/providers/TaskProvider';

interface TaskFormFieldsProps {
  language: Language;
  translate: (key: TranslationKey, params?: Record<string, string | number>) => string;
  state: TaskFormState;
  onChange: (patch: Partial<TaskFormState>) => void;
  onCategoryChange: (category: CategoryKey) => void;
  errors?: TaskFormErrors;
  editingTaskId?: string;
}

export function TaskFormFields({
  language,
  translate,
  state,
  onChange,
  onCategoryChange,
  errors,
  editingTaskId,
}: TaskFormFieldsProps) {
  const { user } = useAuth();
  const { tasks } = useTasks();

  const conflicts = useMemo(() => {
    return findSchedulingConflicts(state, tasks, editingTaskId);
  }, [state, tasks, editingTaskId]);
  const config = getCategoryFormConfig(state.category);
  const previewRule = buildRecurrenceRule(state);
  const previewLabel = frequencyLabelFromRule(previewRule, language);

  const assignOptions = useMemo(() => {
    const opts = [{ value: '', label: language === 'hi' ? 'कोई नहीं' : 'Unassigned' }];
    if (user) {
      opts.push({ value: user.id, label: language === 'hi' ? `आप (${user.name})` : `You (${user.name})` });
      for (const m of user.householdMembers ?? []) {
        if (m.userId) {
          opts.push({ value: m.userId, label: m.name });
        } else if (m.code) {
          opts.push({ value: m.code, label: m.name });
        }
      }
    }
    return opts;
  }, [user, language]);

  const recurrenceOptions = useMemo(
    () =>
      config.allowedRecurrenceTypes.map((type) => ({
        value: type,
        label: recurrenceTypeLabel(type, language),
      })),
    [config.allowedRecurrenceTypes, language]
  );

  const weekdayOptions = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5, 6].map((d) => ({
        value: d,
        label: weekdayLabel(d, language),
      })),
    [language]
  );

  const dayOptions = useMemo(
    () =>
      dayOfMonthOptions().map((d) => ({
        value: d.value,
        label: language === 'hi' ? `${d.labelHi} तारीख` : `Day ${d.labelEn}`,
      })),
    [language]
  );

  const nthOptions = useMemo(
    () =>
      [1, 2, 3, 4].map((n) => ({
        value: n,
        label: nthLabel(n, language),
      })),
    [language]
  );

  const intervalUnitOptions = useMemo(
    () => [
      { value: 'days' as const, label: translate('intervalDays') },
      { value: 'months' as const, label: translate('intervalMonths') },
    ],
    [translate]
  );

  return (
    <View>
      <Text style={styles.sectionLabel}>{translate('parseCategory')}</Text>
      {CATEGORY_GROUPS.map((group) => (
        <View key={group.key} style={styles.groupBlock}>
          <Text style={styles.groupLabel}>{language === 'hi' ? group.labelHi : group.labelEn}</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.filter((c) => c.group === group.key).map((cat) => {
              const active = state.category === cat.key;
              return (
                <Card
                  key={cat.key}
                  style={[styles.catChip, active && styles.catChipActive]}
                  mode="elevated"
                >
                  <TouchableRipple
                    onPress={() => onCategoryChange(cat.key)}
                    style={styles.catChipInner}
                    borderless
                  >
                    <View style={styles.catContent}>
                      <Text style={styles.catChipIcon}>{cat.icon}</Text>
                      <Text style={[styles.catChipText, active && styles.catChipTextActive]} numberOfLines={2}>
                        {getCategoryLabel(cat.key, language)}
                      </Text>
                    </View>
                  </TouchableRipple>
                </Card>
              );
            })}
          </View>
        </View>
      ))}

      {config.subtitle ? <Text style={styles.catHint}>{translate(config.subtitle)}</Text> : null}

      <FormField
        label={translate('presetTitle')}
        value={state.title}
        onChangeText={(title) => onChange({ title })}
        placeholder={translate(config.titlePlaceholder)}
        error={errors?.title}
      />

      <Text style={styles.sectionLabel}>{language === 'hi' ? 'कार्य इमोजी (वैकल्पिक)' : 'Task Emoji (Optional)'}</Text>
      <View style={styles.emojiContainer}>
        <View style={styles.activeEmojiBadge}>
          <Text style={styles.activeEmojiText}>{state.icon || CATEGORY_MAP[state.category].icon}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
          {['🏠', '💳', '🏍️', '📄', '🔥', '💧', '🧹', '🍳', '💊', '☀️', '📺', '💪', '🍬', '🎁', '🏫', '📝', '💇', '💅', '🍖', '🩺', '📈', '📁', '🏊', '🚌', '🛒', '⚡', '📶', '🔑', '🧼', '🧺', '🪴'].map((emoji) => {
            const isActive = state.icon === emoji;
            return (
              <TouchableRipple
                key={emoji}
                onPress={() => onChange({ icon: emoji })}
                style={[styles.emojiBtn, isActive && styles.emojiBtnActive]}
                borderless
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableRipple>
            );
          })}
        </ScrollView>
      </View>

      <SelectField<RecurrenceType>
        label={translate('howOften')}
        value={state.recurrenceType}
        options={recurrenceOptions}
        onChange={(recurrenceType) => onChange({ recurrenceType })}
        hint={translate('recurrencePreview', { label: previewLabel })}
        error={errors?.recurrence}
      />

      {state.recurrenceType === 'weekly' || state.recurrenceType === 'nthWeekday' ? (
        <SelectField
          label={translate('pickWeekday')}
          value={state.weekday}
          options={weekdayOptions}
          onChange={(weekday) => onChange({ weekday })}
        />
      ) : null}

      {state.recurrenceType === 'nthWeekday' ? (
        <SelectField
          label={translate('pickNth')}
          value={state.nthWeekday}
          options={nthOptions}
          onChange={(nthWeekday) => onChange({ nthWeekday })}
        />
      ) : null}

      {state.recurrenceType === 'monthDay' ? (
        <SelectField
          label={translate('pickDayOfMonth')}
          value={state.dayOfMonth}
          options={dayOptions}
          onChange={(dayOfMonth) => onChange({ dayOfMonth })}
        />
      ) : null}

      {state.recurrenceType === 'interval' ? (
        <>
          <View style={styles.intervalRow}>
            {intervalPresets(state.category).map((n) => {
              const active =
                state.interval === n &&
                state.intervalUnit === (state.category === 'vehicle' || state.category === 'education' ? 'months' : 'days');
              const unit =
                state.category === 'vehicle' || (state.category === 'education' && n >= 3)
                  ? 'months'
                  : 'days';
              return (
                <Card
                  key={n}
                  style={[styles.presetChip, active && styles.presetChipActive]}
                  mode="elevated"
                >
                  <TouchableRipple
                    onPress={() => onChange({ interval: n, intervalUnit: unit })}
                    style={styles.presetChipInner}
                    borderless
                  >
                    <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                      {n} {unit === 'months' ? (language === 'hi' ? 'महीने' : 'mo') : language === 'hi' ? 'दिन' : 'd'}
                    </Text>
                  </TouchableRipple>
                </Card>
              );
            })}
          </View>
          <FormField
            label={translate('customInterval')}
            value={String(state.interval)}
            onChangeText={(v) => onChange({ interval: Math.max(1, parseInt(v.replace(/\D/g, ''), 10) || 1) })}
            keyboardType="number-pad"
          />
          <SelectField
            label={translate('intervalUnit')}
            value={state.intervalUnit}
            options={intervalUnitOptions}
            onChange={(intervalUnit) => onChange({ intervalUnit })}
          />
        </>
      ) : null}

      {config.showStartDate ? (
        <DateField
          label={translate('festivalDate')}
          value={state.startDate}
          onChange={(startDate) => onChange({ startDate })}
          hint={translate('festivalDateHint')}
        />
      ) : null}

      {config.showReminderTime ? (
        <View style={styles.timeFieldContainer}>
          <TimeField
            label={translate('reminderTime')}
            value={state.reminderTime}
            onChange={(reminderTime) => onChange({ reminderTime })}
            hint={translate('reminderTimeHint')}
          />
          {conflicts.length > 0 && (
            <Text style={styles.conflictText}>
              ⚠️ {language === 'hi'
                ? `संभावित टकराव: यह "${conflicts[0].title}" के करीब अनुसूचित है।`
                : `Scheduling conflict: Close to "${conflicts[0].title}".`}
            </Text>
          )}
        </View>
      ) : null}

      {config.showAmount ? (
        <FormField
          label={translate('presetAmount')}
          value={state.amountText}
          onChangeText={(amountText) => onChange({ amountText })}
          placeholder="3500"
          keyboardType="number-pad"
          hint={translate('presetAmountOptional')}
          error={errors?.amount}
        />
      ) : null}

      {config.showFinance ? (
        <SettingRow
          label={translate('tagFinance')}
          sub={translate('tagFinanceSub')}
          value={state.finance}
          onValueChange={(finance) => onChange({ finance })}
        />
      ) : null}

      {user && user.householdMembers && user.householdMembers.length > 0 && (
        <SelectField
          label={language === 'hi' ? 'किसे सौंपें' : 'Assign to'}
          value={state.assignedTo ?? ''}
          options={assignOptions}
          onChange={(assignedTo) => onChange({ assignedTo: assignedTo || null })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkSoft,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  groupBlock: { marginBottom: 12 },
  groupLabel: {
    fontSize: 10.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkFaint,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    width: '31%',
    minWidth: 96,
    flexGrow: 1,
    borderRadius: Radius.sm,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
    elevation: 1,
  },
  catChipActive: { borderColor: Colors.marigold, backgroundColor: 'rgba(232,163,61,0.04)' },
  catChipInner: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  catContent: {
    alignItems: 'center',
  },
  catChipIcon: { fontSize: 20, marginBottom: 4 },
  catChipText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 10.5,
    color: Colors.inkSoft,
    textAlign: 'center',
    lineHeight: 14,
  },
  catChipTextActive: { color: Colors.ink, fontFamily: 'Manrope_700Bold' },
  catHint: { fontSize: 12, color: Colors.tealDeep, marginBottom: 12, lineHeight: 18 },
  intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  presetChip: {
    borderRadius: 999,
    backgroundColor: Colors.ivoryDim,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
    elevation: 0.5,
  },
  presetChipActive: { borderColor: Colors.marigold, backgroundColor: 'rgba(232,163,61,0.1)' },
  presetChipInner: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  presetChipText: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: Colors.inkSoft },
  presetChipTextActive: { color: Colors.ink, fontFamily: 'Manrope_700Bold' },
  timeFieldContainer: {
    marginBottom: 12,
  },
  conflictText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.clay,
    marginTop: 4,
    marginLeft: 4,
  },
  emojiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  activeEmojiBadge: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(232,163,61,0.08)',
    borderWidth: 1.5,
    borderColor: Colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeEmojiText: {
    fontSize: 26,
  },
  emojiList: {
    gap: 8,
    paddingVertical: 2,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.ivoryDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  emojiBtnActive: {
    borderColor: Colors.marigold,
    backgroundColor: 'rgba(232,163,61,0.08)',
  },
  emojiText: {
    fontSize: 20,
  },
});

