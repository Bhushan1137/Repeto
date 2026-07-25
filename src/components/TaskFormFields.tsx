import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import type { CategoryKey, Language, SharedMember } from '@/types';
import type { TranslationKey } from '@/i18n';
import { FormField } from '@/components/FormField';
import { SelectField } from '@/components/SelectField';
import { DateField } from '@/components/DateField';
import { TimeField } from '@/components/TimeField';
import { Colors, Radius, Typography } from '@/constants/theme';
import { computeNextDueDate, daysUntilDue, frequencyLabelFromRule } from '@/domain/recurrence';
import { getCategoryLabel } from '@/constants/categoryHelpers';
import { CATEGORIES, CATEGORY_GROUPS, CATEGORY_MAP } from '@/constants/categories';
import { getCategoryFormConfig } from '@/constants/categoryFormConfig';
import {
  buildRecurrenceRule,
  type TaskFormErrors,
  type TaskFormState,
  findSchedulingConflicts,
} from '@/domain/taskForm';
import { useAuth } from '@/providers/AuthProvider';
import { useTasks } from '@/providers/TaskProvider';
import { AppIcon } from '@/components/AppIcon';
import { RepeatExamplesStrip } from '@/components/RepeatExamplesStrip';
import { Button } from '@/components/Button';

interface TaskFormFieldsProps {
  language: Language;
  translate: (key: TranslationKey, params?: Record<string, string | number>) => string;
  state: TaskFormState;
  onChange: (patch: Partial<TaskFormState>) => void;
  onCategoryChange: (category: CategoryKey) => void;
  errors?: TaskFormErrors;
  editingTaskId?: string;
  onTriggerCalendarPicker?: () => void;
  sharedMembers?: SharedMember[];
}

export function TaskFormFields({
  language,
  translate,
  state,
  onChange,
  onCategoryChange,
  errors,
  editingTaskId,
  sharedMembers,
}: TaskFormFieldsProps) {
  const { user } = useAuth();
  const { tasks } = useTasks();

  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => {
    if (sharedMembers !== undefined && sharedMembers.length === 0 && state.assignedTo !== null) {
      onChange({ assignedTo: null });
    }
  }, [sharedMembers, state.assignedTo, onChange]);

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
      
      const list = sharedMembers !== undefined 
        ? sharedMembers 
        : (user.householdMembers ?? []);

      for (const m of list) {
        const val = ('userId' in m && m.userId) ? m.userId : (('code' in m && m.code) ? m.code : ('phone' in m ? m.phone : undefined));
        if (val) {
          opts.push({ value: val, label: m.name });
        }
      }
    }
    return opts;
  }, [user, language, sharedMembers]);

  const defaultIcon = CATEGORY_MAP[state.category].icon;
  const emojiOptions = useMemo(() => {
    const baseEmojis = ['🏠', '💳', '🏍️', '📄', '🔥', '💧', '🧹', '🍳', '💊', '☀️', '📺', '💪', '🍬', '🎁', '🏫', '📝', '<ctrl42>', '💅', '🍖', '🩺', '📈', '📁', '🏊', '🚌', '🛒', '⚡', '📶', '🔑', '🧼', '🧺', '🪴'];
    return [defaultIcon, ...baseEmojis.filter((e) => e !== defaultIcon)];
  }, [defaultIcon]);

  const dateRef = useMemo(() => {
    return state.startDate ? new Date(state.startDate) : new Date();
  }, [state.startDate]);

  const dateNum = dateRef.getDate();
  const weekdayIndex = dateRef.getDay();
  const weekdayNameStr = useMemo(() => {
    const en = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const hi = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
    return language === 'hi' ? hi[weekdayIndex] : en[weekdayIndex];
  }, [weekdayIndex, language]);

  const monthNameStr = useMemo(() => {
    return dateRef.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', { month: 'short' });
  }, [dateRef, language]);

  const nth = Math.ceil(dateNum / 7);
  const nthStr = useMemo(() => {
    if (language === 'hi') return `${nth}वां`;
    const suffix = ['th', 'st', 'nd', 'rd'];
    const v = nth % 100;
    return `${nth}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`;
  }, [nth, language]);

  const allowed = config.allowedRecurrenceTypes;

  const handleSelectExample = (config: any) => {
    onChange({
      recurrenceType: config.recurrenceType,
      reminderTime: config.reminderTime,
      ...(config.interval !== undefined && { interval: config.interval }),
      ...(config.intervalUnit !== undefined && { intervalUnit: config.intervalUnit }),
      ...(config.dayOfMonth !== undefined && { dayOfMonth: config.dayOfMonth }),
      ...(config.weekday !== undefined && { weekday: config.weekday }),
    });
  };

  const calculatedNextDue = useMemo(() => {
    const baseDate = state.startDate ? new Date(state.startDate) : new Date();
    return computeNextDueDate(previewRule, baseDate);
  }, [previewRule, state.startDate]);

  const formattedNextDue = useMemo(() => {
    try {
      const d = new Date(calculatedNextDue);
      const dateStr = d.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const daysLeft = daysUntilDue(calculatedNextDue);
      const dueDaysStr = daysLeft === 0
        ? (language === 'hi' ? 'आज' : 'Today')
        : daysLeft === 1
        ? (language === 'hi' ? 'कल' : 'Tomorrow')
        : (language === 'hi' ? `${daysLeft} दिनों में` : `in ${daysLeft} days`);
      return `${dateStr} (${dueDaysStr})`;
    } catch {
      return calculatedNextDue.slice(0, 10);
    }
  }, [calculatedNextDue, language]);

  return (
    <View style={styles.formRoot}>

      {/* ── SECTION 1: TASK IDENTITY ── */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeaderTitle}>{language === 'hi' ? '1. कार्य विवरण' : '1. Task Details'}</Text>
        
        <FormField
          label={translate('presetTitle')}
          value={state.title}
          onChangeText={(title) => onChange({ title })}
          placeholder={translate(config.titlePlaceholder)}
          error={errors?.title}
          testID="task-title-input"
        />

        <Text style={styles.fieldLabel}>{translate('parseCategory')}</Text>
        <Card style={styles.dropdownCard} mode="elevated" testID="task-category-trigger">
          <TouchableRipple onPress={() => setShowCategoryModal(true)} style={styles.dropdownRipple} borderless>
            <View style={styles.dropdownRow}>
              <View style={styles.dropdownLeft}>
                <Text style={styles.dropdownEmoji}>{CATEGORY_MAP[state.category].icon}</Text>
                <Text style={styles.dropdownText}>
                  {getCategoryLabel(state.category, language)}
                </Text>
              </View>
              <AppIcon name="chevron-down-outline" size={18} color={Colors.inkSoft} />
            </View>
          </TouchableRipple>
        </Card>

        {config.subtitle ? <Text style={styles.catHint}>{translate(config.subtitle)}</Text> : null}

        <Text style={styles.fieldLabel}>{language === 'hi' ? 'इमोजी चुनें (वैकल्पिक)' : 'Choose Emoji (Optional)'}</Text>
        <View style={styles.emojiContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
            {emojiOptions.map((emoji) => {
              const isActive = state.icon === emoji || (!state.icon && emoji === defaultIcon);
              return (
                <TouchableRipple
                  key={emoji}
                  onPress={() => onChange({ icon: emoji })}
                  testID={`task-emoji-btn-${emoji}`}
                  style={[styles.emojiBtn, isActive && styles.emojiBtnActive]}
                  borderless
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableRipple>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* ── SECTION 2: SCHEDULE & RECURRENCE ── */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeaderTitle}>{language === 'hi' ? '2. समय सारणी एवं पुनरावृत्ति' : '2. Schedule & Repeat'}</Text>

        <View style={styles.dateTimeRow}>
          <View style={styles.dateCol}>
            <DateField
              label={language === 'hi' ? 'तारीख' : 'Date'}
              value={state.startDate || new Date().toISOString().slice(0, 10)}
              onChange={(startDate) => onChange({ startDate })}
              testID="task-date-picker"
            />
          </View>
          <View style={styles.timeCol}>
            <TimeField
              label={language === 'hi' ? 'समय' : 'Time'}
              value={state.reminderTime || '09:00'}
              onChange={(reminderTime) => onChange({ reminderTime })}
              testID="task-time-picker"
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>{translate('howOften')}</Text>
        <Card style={styles.recurrenceCard} mode="elevated" testID="task-recurrence-trigger">
          <TouchableRipple onPress={() => setShowRecurrenceModal(true)} style={styles.recurrenceRipple} borderless>
            <View style={styles.recurrenceRow}>
              <View style={styles.recurrenceLeft}>
                <Text style={styles.recurrenceTitle}>{translate('howDoesItRepeat')}</Text>
                <Text style={styles.recurrenceSub}>{translate('howDoesItRepeatSub')}</Text>
                <Text style={styles.recurrenceValue}>{previewLabel}</Text>

                {/* Live Calculator Preview Badge */}
                <View style={styles.nextDueBadge}>
                  <AppIcon name="calendar-outline" size={13} color={Colors.tealDeep} />
                  <Text style={styles.nextDueBadgeText}>
                    {language === 'hi' ? `अगली देय तिथि: ${formattedNextDue}` : `Next due: ${formattedNextDue}`}
                  </Text>
                </View>
              </View>
              <AppIcon name="chevron-forward" size={20} color={Colors.marigold} />
            </View>
          </TouchableRipple>
        </Card>

        {/* Schedule Summary Box */}
        <Card style={styles.summaryCard} mode="elevated">
          <View style={styles.summaryContent}>
            <AppIcon name="checkmark-done-outline" size={18} color={Colors.tealDeep} />
            <View style={styles.summaryTextWrapper}>
              <Text style={styles.summaryTitle}>{language === 'hi' ? 'अनुसूची सारांश' : 'Schedule Summary'}</Text>
              <Text style={styles.summarySub}>
                {language === 'hi' 
                  ? `आपको ${previewLabel} पर ${state.reminderTime || '09:00'} बजे याद दिलाया जाएगा।` 
                  : `You'll be reminded ${previewLabel} at ${state.reminderTime || '09:00'}.`}
                {state.amountText ? ` Amount: ₹${state.amountText}` : ''}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Presets Strip */}
        <RepeatExamplesStrip language={language} onSelect={handleSelectExample} />
      </View>

      {/* ── SECTION 3: FINANCE & EXPENSES ── */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeaderTitle}>{language === 'hi' ? '3. वित्त एवं बजट' : '3. Finance & Expenses'}</Text>

        {/* Finance Toggle Row */}
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => onChange({ finance: !state.finance })}
          activeOpacity={0.8}
        >
          <View style={styles.toggleTextCol}>
            <Text style={styles.toggleTitle}>
              {language === 'hi' ? 'वित्तीय कार्य के रूप में टैग करें' : 'Tag as Financial Task'}
            </Text>
            <Text style={styles.toggleSub}>
              {language === 'hi'
                ? 'मासिक बजट और व्यय अनुमान में शामिल करें'
                : 'Include in monthly spend forecast and budget analytics'}
            </Text>
          </View>
          <View style={[styles.switchTrack, state.finance && styles.switchTrackActive]}>
            <View style={[styles.switchThumb, state.finance && styles.switchThumbActive]} />
          </View>
        </TouchableOpacity>

        {/* Amount Field — Revealed ONLY when Tag as Finance is ON */}
        {state.finance && (
          <View style={{ marginTop: 12 }}>
            <FormField
              label={language === 'hi' ? 'राशि (₹)' : 'Amount (₹)'}
              value={state.amountText}
              onChangeText={(amountText) => onChange({ amountText })}
              placeholder={language === 'hi' ? 'राशि प्रविष्ट करें (उदा. ₹1,500)' : 'Enter amount (e.g. ₹1,500)'}
              keyboardType="number-pad"
              error={errors?.amount}
              testID="task-amount-input"
            />
          </View>
        )}
      </View>

      {/* ── SECTION 4: NOTES (OPTIONAL) ── */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeaderTitle}>{language === 'hi' ? '4. नोट (वैकल्पिक)' : '4. Notes (Optional)'}</Text>
        <FormField
          label={language === 'hi' ? 'अतिरिक्त विवरण या निर्देश' : 'Additional Details or Instructions'}
          value={state.note}
          onChangeText={(note) => onChange({ note })}
          placeholder={language === 'hi' ? 'जैसे: खाता विवरण, मीटर नंबर, आदि...' : 'e.g., Account ID, meter number, instructions...'}
          multiline
          testID="task-note-input"
        />
      </View>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowCategoryModal(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.modalTitle}>{translate('parseCategory')}</Text>
            <Text style={styles.modalSub}>
              {language === 'hi' ? 'अपने कार्य के लिए श्रेणी चुनें' : 'Choose a category for your task'}
            </Text>

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
                          onPress={() => {
                            onCategoryChange(cat.key);
                            setShowCategoryModal(false);
                          }}
                          testID={`task-category-chip-${cat.key}`}
                          style={styles.catChipInner}
                          borderless
                        >
                          <View style={styles.catContent}>
                            <Text style={styles.catChipIcon}>{cat.icon}</Text>
                            <Text style={[styles.catChipText, active && styles.catChipTextActive]} numberOfLines={1}>
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
          </ScrollView>
        </View>
      </Modal>

      {/* Recurrence Selection Modal */}
      <Modal visible={showRecurrenceModal} transparent animationType="slide" onRequestClose={() => setShowRecurrenceModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowRecurrenceModal(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.modalTitle}>{translate('howDoesItRepeat')}</Text>
            <Text style={styles.modalSub}>{translate('howDoesItRepeatSub')}</Text>

            {/* Recurrence Options */}
            {allowed.includes('daily') && (
              <TouchableOpacity style={styles.radioOption} onPress={() => onChange({ recurrenceType: 'daily' })} activeOpacity={0.7}>
                <View style={[styles.radioCircle, state.recurrenceType === 'daily' && styles.radioCircleActive]}>
                  {state.recurrenceType === 'daily' && <View style={styles.radioInnerCircle} />}
                </View>
                <View style={styles.radioText}>
                  <Text style={styles.radioOptionTitle}>{language === 'hi' ? 'हर दिन' : 'Every day'}</Text>
                  <Text style={styles.radioOptionSub}>{language === 'hi' ? 'प्रतिदिन पुनरावृत्ति' : 'Repeats every day'}</Text>
                </View>
              </TouchableOpacity>
            )}

            {allowed.includes('weekly') && (
              <TouchableOpacity style={styles.radioOption} onPress={() => onChange({ recurrenceType: 'weekly', weekday: weekdayIndex })} activeOpacity={0.7}>
                <View style={[styles.radioCircle, state.recurrenceType === 'weekly' && styles.radioCircleActive]}>
                  {state.recurrenceType === 'weekly' && <View style={styles.radioInnerCircle} />}
                </View>
                <View style={styles.radioText}>
                  <Text style={styles.radioOptionTitle}>{language === 'hi' ? 'हर हफ्ते' : 'Every week'}</Text>
                  <Text style={styles.radioOptionSub}>{language === 'hi' ? `${weekdayNameStr} को दोहराता है` : `Repeats every week on ${weekdayNameStr}`}</Text>
                </View>
              </TouchableOpacity>
            )}

            {(allowed.includes('monthDay') || allowed.includes('monthly') || allowed.includes('nthWeekday')) && (
              <View style={styles.monthlyBlock}>
                <TouchableOpacity style={styles.radioOption} onPress={() => onChange({ recurrenceType: 'monthDay', dayOfMonth: dateNum })} activeOpacity={0.7}>
                  <View style={[styles.radioCircle, state.recurrenceType === 'monthDay' && styles.radioCircleActive]}>
                    {state.recurrenceType === 'monthDay' && <View style={styles.radioInnerCircle} />}
                  </View>
                  <View style={styles.radioText}>
                    <Text style={styles.radioOptionTitle}>{language === 'hi' ? 'हर महीने' : 'Every month'}</Text>
                    <Text style={styles.radioOptionSub}>
                      {language === 'hi' ? `हर महीने की ${dateNum} तारीख को` : `Repeats every month on the ${dateNum} day`}
                    </Text>
                  </View>
                </TouchableOpacity>

                {allowed.includes('nthWeekday') && (
                  <TouchableOpacity
                    style={[styles.radioOption, styles.radioOptionNested]}
                    onPress={() => onChange({ recurrenceType: 'nthWeekday', nthWeekday: nth, weekday: weekdayIndex })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.radioCircle, state.recurrenceType === 'nthWeekday' && styles.radioCircleActive]}>
                      {state.recurrenceType === 'nthWeekday' && <View style={styles.radioInnerCircle} />}
                    </View>
                    <View style={styles.radioText}>
                      <Text style={styles.radioOptionTitle}>
                        {language === 'hi' ? `हर महीने का ${nthStr} ${weekdayNameStr}` : `Every ${nthStr} ${weekdayNameStr}`}
                      </Text>
                      <Text style={styles.radioOptionSub}>
                        {language === 'hi' ? 'दिन के स्थान के आधार पर' : 'Repeats based on day position'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {allowed.includes('yearly') && (
              <TouchableOpacity style={styles.radioOption} onPress={() => onChange({ recurrenceType: 'yearly' })} activeOpacity={0.7}>
                <View style={[styles.radioCircle, state.recurrenceType === 'yearly' && styles.radioCircleActive]}>
                  {state.recurrenceType === 'yearly' && <View style={styles.radioInnerCircle} />}
                </View>
                <View style={styles.radioText}>
                  <Text style={styles.radioOptionTitle}>{language === 'hi' ? 'हर साल' : 'Every year'}</Text>
                  <Text style={styles.radioOptionSub}>
                    {language === 'hi' ? `${dateNum} ${monthNameStr} को हर साल` : `Repeats every year on ${monthNameStr} ${dateNum}`}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {allowed.includes('interval') && (
              <View style={styles.customBlock}>
                <TouchableOpacity style={styles.radioOption} onPress={() => onChange({ recurrenceType: 'interval' })} activeOpacity={0.7}>
                  <View style={[styles.radioCircle, state.recurrenceType === 'interval' && styles.radioCircleActive]}>
                    {state.recurrenceType === 'interval' && <View style={styles.radioInnerCircle} />}
                  </View>
                  <View style={styles.radioText}>
                    <Text style={styles.radioOptionTitle}>{language === 'hi' ? 'कस्टम अंतराल' : 'Custom interval'}</Text>
                    <Text style={styles.radioOptionSub}>{language === 'hi' ? 'हर कुछ दिन या महीने' : 'Set a custom repeat pattern'}</Text>
                  </View>
                </TouchableOpacity>

                {state.recurrenceType === 'interval' && (
                  <View style={styles.customFields}>
                    <FormField
                      label={translate('customInterval')}
                      value={String(state.interval)}
                      onChangeText={(v) => {
                        onChange({ recurrenceType: 'interval', interval: Math.max(1, parseInt(v.replace(/\D/g, ''), 10) || 1) });
                      }}
                      keyboardType="number-pad"
                    />
                    <SelectField
                      label={translate('intervalUnit')}
                      value={state.intervalUnit}
                      options={[
                        { value: 'days' as const, label: translate('intervalDays') },
                        { value: 'months' as const, label: translate('intervalMonths') },
                      ]}
                      onChange={(intervalUnit) => onChange({ recurrenceType: 'interval', intervalUnit })}
                    />
                  </View>
                )}
              </View>
            )}

            <Button
              title={language === 'hi' ? 'सहेजें' : 'Done'}
              onPress={() => setShowRecurrenceModal(false)}
              style={styles.modalDoneBtn}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Uniform Spacing & Card Styles ──────────────────────────────────────────

const styles = StyleSheet.create({
  formRoot: { gap: 18 },

  // Section Grouping Container
  sectionBlock: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  sectionHeaderTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  fieldLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 10,
  },
  subText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: Colors.inkSoft,
    marginBottom: 10,
  },

  // Category Dropdown
  dropdownCard: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    marginBottom: 8,
    elevation: 0.5,
    overflow: 'hidden',
  },
  dropdownRipple: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownEmoji: { fontSize: 18 },
  dropdownText: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.ink,
  },
  catHint: {
    fontSize: 11.5,
    color: Colors.inkSoft,
    fontFamily: 'Manrope_500Medium',
    marginBottom: 10,
  },

  // Emoji Scroll List
  emojiContainer: {
    marginBottom: 4,
  },
  emojiList: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  emojiBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  emojiBtnActive: {
    backgroundColor: Colors.marigold,
    borderColor: Colors.marigoldDeep,
  },
  emojiText: { fontSize: 18 },

  // Date & Time Row
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  dateCol: { flex: 1 },
  timeCol: { flex: 1 },

  // Recurrence Trigger Card
  recurrenceCard: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    marginBottom: 10,
    elevation: 0.5,
    overflow: 'hidden',
  },
  recurrenceRipple: {
    padding: 12,
  },
  recurrenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recurrenceLeft: { flex: 1, gap: 2 },
  recurrenceTitle: {
    fontSize: 13.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
  recurrenceSub: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    color: Colors.inkSoft,
  },
  recurrenceValue: {
    fontSize: 13,
    fontFamily: 'Fraunces_700Bold',
    color: Colors.marigoldDeep,
    marginTop: 2,
  },
  nextDueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    backgroundColor: 'rgba(62, 124, 106, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    alignSelf: 'flex-start',
  },
  nextDueBadgeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.tealDeep,
  },

  // Schedule Summary Card
  summaryCard: {
    backgroundColor: 'rgba(62,124,106,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(62,124,106,0.18)',
    borderRadius: Radius.sm,
    marginBottom: 10,
    overflow: 'hidden',
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  summaryTextWrapper: { flex: 1, gap: 2 },
  summaryTitle: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: Colors.tealDeep,
  },
  summarySub: {
    fontSize: 11.5,
    color: Colors.inkSoft,
    lineHeight: 16,
    fontFamily: 'Manrope_500Medium',
  },

  // Modal Styles
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    elevation: 16,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.ivoryLine,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Fraunces_700Bold',
    color: Colors.ink,
    marginBottom: 2,
  },
  modalSub: {
    fontSize: 12.5,
    color: Colors.inkSoft,
    marginBottom: 16,
    fontFamily: 'Manrope_500Medium',
  },
  groupBlock: { marginBottom: 14 },
  groupLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    width: '48%',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 0.5,
    overflow: 'hidden',
  },
  catChipActive: {
    backgroundColor: Colors.marigold,
    borderColor: Colors.marigoldDeep,
  },
  catChipInner: { padding: 10 },
  catContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catChipIcon: { fontSize: 16 },
  catChipText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: Colors.ink,
    flex: 1,
  },
  catChipTextActive: {
    fontFamily: 'Manrope_800ExtraBold',
    color: '#FFF',
  },

  // Radio Options
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  radioOptionNested: {
    marginLeft: 20,
    backgroundColor: 'rgba(62,124,106,0.03)',
    borderColor: 'rgba(62,124,106,0.15)',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: Colors.marigold,
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.marigold,
  },
  radioText: { flex: 1, gap: 2 },
  radioOptionTitle: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
  radioOptionSub: {
    fontSize: 11,
    color: Colors.inkSoft,
  },
  monthlyBlock: { marginBottom: 2 },
  customBlock: { marginBottom: 2 },
  customFields: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    padding: 12,
    marginLeft: 20,
    marginBottom: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  modalDoneBtn: { marginTop: 12 },

  // Toggle Switch Styles
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  toggleTextCol: { flex: 1, paddingRight: 10 },
  toggleTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.ink,
  },
  toggleSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 2,
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
