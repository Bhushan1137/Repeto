import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import type { CategoryKey, Language, RecurrenceType, SharedMember } from '@/types';
import type { TranslationKey } from '@/i18n';
import { FormField } from '@/components/FormField';
import { SettingRow } from '@/components/SettingRow';
import { SelectField } from '@/components/SelectField';
import { DateField } from '@/components/DateField';
import { TimeField } from '@/components/TimeField';
import { Colors, Radius, Shadows, Typography } from '@/constants/theme';
import { frequencyLabelFromRule } from '@/domain/recurrence';
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
    const baseEmojis = ['🏠', '💳', '🏍️', '📄', '🔥', '💧', '🧹', '🍳', '💊', '☀️', '📺', '💪', '🍬', '🎁', '🏫', '📝', '💇', '💅', '🍖', '🩺', '📈', '📁', '🏊', '🚌', '🛒', '⚡', '📶', '🔑', '🧼', '🧺', '🪴'];
    return [defaultIcon, ...baseEmojis.filter((e) => e !== defaultIcon)];
  }, [defaultIcon]);

  // Handle reminder date details
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

  // Check if current recurrence type is allowed in config
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

  return (
    <View>
      {/* 1. Basic Details */}
      <FormField
        label={translate('presetTitle')}
        value={state.title}
        onChangeText={(title) => onChange({ title })}
        placeholder={translate(config.titlePlaceholder)}
        error={errors?.title}
      />

      <Text style={styles.sectionLabel}>{translate('parseCategory')}</Text>
      
      {/* Dropdown Card Trigger */}
      <Card style={styles.dropdownCard} mode="elevated">
        <TouchableRipple onPress={() => setShowCategoryModal(true)} style={styles.dropdownRipple} borderless>
          <View style={styles.dropdownRow}>
            <View style={styles.dropdownLeft}>
              <Text style={styles.dropdownEmoji}>{CATEGORY_MAP[state.category].icon}</Text>
              <Text style={styles.dropdownText}>
                {getCategoryLabel(state.category, language)}
              </Text>
            </View>
            <AppIcon name="chevron-down-outline" size={20} color={Colors.inkSoft} />
          </View>
        </TouchableRipple>
      </Card>

      {config.subtitle ? <Text style={styles.catHint}>{translate(config.subtitle)}</Text> : null}

      <Text style={styles.sectionLabel}>{language === 'hi' ? 'कार्य इमोजी (वैकल्पिक)' : 'Task Emoji (Optional)'}</Text>
      <View style={styles.emojiContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
          {emojiOptions.map((emoji) => {
            const isActive = state.icon === emoji || (!state.icon && emoji === defaultIcon);
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

      {/* Category Selection Popup Modal */}
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

      {/* 2. Date & Time Reminder Section */}
      <Text style={styles.sectionLabel}>{translate('firstReminderLabel')}</Text>
      <Text style={styles.subText}>{translate('firstReminderSub')}</Text>
      <View style={styles.dateTimeRow}>
        <View style={styles.dateCol}>
          <DateField
            label={language === 'hi' ? 'तारीख' : 'Date'}
            value={state.startDate || new Date().toISOString().slice(0, 10)}
            onChange={(startDate) => onChange({ startDate })}
          />
        </View>
        <View style={styles.timeCol}>
          <TimeField
            label={language === 'hi' ? 'समय' : 'Time'}
            value={state.reminderTime || '09:00'}
            onChange={(reminderTime) => onChange({ reminderTime })}
          />
        </View>
      </View>

      {/* 3. Recurrence Selector clickable row */}
      <Text style={styles.sectionLabel}>{translate('howOften')}</Text>
      <Card style={styles.recurrenceCard} mode="elevated">
        <TouchableRipple onPress={() => setShowRecurrenceModal(true)} style={styles.recurrenceRipple} borderless>
          <View style={styles.recurrenceRow}>
            <View style={styles.recurrenceLeft}>
              <Text style={styles.recurrenceTitle}>{translate('howDoesItRepeat')}</Text>
              <Text style={styles.recurrenceSub}>{translate('howDoesItRepeatSub')}</Text>
              <Text style={styles.recurrenceValue}>{previewLabel}</Text>
            </View>
            <AppIcon name="chevron-forward" size={24} color={Colors.marigold} />
          </View>
        </TouchableRipple>
      </Card>

      {/* Recurrence Selection Overlay Modal */}
      <Modal visible={showRecurrenceModal} transparent animationType="slide" onRequestClose={() => setShowRecurrenceModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowRecurrenceModal(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.modalTitle}>{translate('howDoesItRepeat')}</Text>
            <Text style={styles.modalSub}>{translate('howDoesItRepeatSub')}</Text>

            {/* Recurrence Radio Group */}
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

                {/* Sub option for monthly: nthWeekday */}
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

      {/* 4. Summary Card */}
      <Card style={styles.summaryCard} mode="elevated">
        <View style={styles.summaryContent}>
          <AppIcon name="checkmark-done-outline" size={20} color={Colors.tealDeep} />
          <View style={styles.summaryTextWrapper}>
            <Text style={styles.summaryTitle}>{language === 'hi' ? 'अनुसूची सारांश' : 'Summary'}</Text>
            <Text style={styles.summarySub}>
              {language === 'hi' 
                ? `आपको ${previewLabel} पर ${state.reminderTime || '09:00'} बजे याद दिलाया जाएगा।` 
                : `You'll be reminded ${previewLabel} at ${state.reminderTime || '09:00'}.`}
              {state.amountText ? ` Amount: ₹${state.amountText}` : ''}
            </Text>
          </View>
        </View>
      </Card>

      {/* 5. Common Repeat Examples Strip */}
      <RepeatExamplesStrip language={language} onSelect={handleSelectExample} />

      {/* 6. Amount and Custom Options */}
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
          flat={true}
        />
      ) : null}

      {user && sharedMembers && sharedMembers.length > 0 && (
        <SelectField
          label={language === 'hi' ? 'किसे सौंपें' : 'Assign to'}
          value={state.assignedTo ?? ''}
          options={assignOptions}
          onChange={(assignedTo) => onChange({ assignedTo: assignedTo || null })}
        />
      )}

      {/* 7. Edit Note */}
      <View style={styles.editNoteContainer}>
        <AppIcon name="chatbox-ellipses-outline" size={18} color={Colors.inkFaint} />
        <View style={styles.editNoteTextWrapper}>
          <Text style={styles.editNoteTitle}>{translate('editPauseNote')}</Text>
          <Text style={styles.editNoteSub}>{translate('editPauseNoteSub')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkSoft,
    marginTop: 18,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  subText: {
    fontSize: 11,
    color: Colors.inkFaint,
    marginBottom: 8,
    fontFamily: 'Manrope_400Regular',
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
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catChip: {
    width: '31%',
    minWidth: 90,
    flexGrow: 1,
    borderRadius: Radius.sm,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    elevation: 1,
  },
  catChipActive: {
    borderWidth: 1.5,
    borderColor: Colors.teal,
    backgroundColor: 'rgba(62,124,106,0.04)',
    elevation: 0,
  },
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
  emojiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  emojiList: {
    gap: 8,
    paddingVertical: 2,
  },
  emojiBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 18,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  dateCol: {
    flex: 1.3,
  },
  timeCol: {
    flex: 1,
  },
  recurrenceCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    elevation: 1,
    marginBottom: 12,
  },
  recurrenceRipple: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  recurrenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recurrenceLeft: {
    flex: 1,
    gap: 2,
  },
  recurrenceTitle: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
  recurrenceSub: {
    fontSize: 11,
    color: Colors.inkSoft,
  },
  recurrenceValue: {
    fontSize: 13,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.marigoldDeep,
    marginTop: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 27, 54, 0.45)',
  },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceMuted,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
    elevation: 16,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.ivoryLine,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Fraunces_700Bold',
    color: Colors.ink,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: Colors.inkSoft,
    marginBottom: 20,
    fontFamily: 'Manrope_400Regular',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    marginBottom: 10,
    gap: 12,
    elevation: 0.5,
  },
  radioOptionNested: {
    marginLeft: 24,
    backgroundColor: 'rgba(62,124,106,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(62,124,106,0.1)',
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
  radioText: {
    flex: 1,
    gap: 2,
  },
  radioOptionTitle: {
    fontSize: 13.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
  radioOptionSub: {
    fontSize: 10.5,
    color: Colors.inkSoft,
  },
  monthlyBlock: {
    marginBottom: 4,
  },
  customBlock: {
    marginBottom: 4,
  },
  customFields: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    padding: 14,
    marginLeft: 24,
    marginBottom: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(232,163,61,0.1)',
  },
  modalDoneBtn: {
    marginTop: 16,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: 'rgba(62,124,106,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(62,124,106,0.15)',
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 6,
    elevation: 0,
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  summaryTextWrapper: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    fontSize: 12.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.tealDeep,
  },
  summarySub: {
    fontSize: 11.5,
    color: Colors.inkSoft,
    lineHeight: 15,
    fontFamily: 'Manrope_600SemiBold',
  },
  editNoteContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    padding: 12,
    gap: 10,
    marginTop: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 0.5,
  },
  editNoteTextWrapper: {
    flex: 1,
    gap: 1,
  },
  editNoteTitle: {
    fontSize: 11.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
  editNoteSub: {
    fontSize: 10,
    color: Colors.inkSoft,
    fontFamily: 'Manrope_500Medium',
  },
  dropdownCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    marginBottom: 16,
    elevation: 1,
    overflow: 'hidden',
  },
  dropdownRipple: {
    paddingVertical: 12,
    paddingHorizontal: 14,
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
  dropdownEmoji: {
    fontSize: 18,
  },
  dropdownText: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.ink,
  },
});

