import { AppIcon } from '@/components/AppIcon';
import { DateField } from '@/components/DateField';
import { FormField } from '@/components/FormField';
import { RepeatExamplesStrip } from '@/components/RepeatExamplesStrip';
import { CategoryPickerModal } from '@/components/taskForm/CategoryPickerModal';
import { IconPickerStrip } from '@/components/taskForm/IconPickerStrip';
import { RecurrencePickerModal } from '@/components/taskForm/RecurrencePickerModal';
import { TimeField } from '@/components/TimeField';
import { formatTime } from '@/components/timeFieldShared';
import { CATEGORY_MAP } from '@/constants/categories';
import { getCategoryFormConfig } from '@/constants/categoryFormConfig';
import { getCategoryLabel } from '@/constants/categoryHelpers';
import { Colors, Radius } from '@/constants/theme';
import { parseTaskInput } from '@/domain/parser';
import { computeInitialDueDate, daysUntilDue, frequencyLabelFromRule } from '@/domain/recurrence';
import {
  buildRecurrenceRule,
  type TaskFormErrors,
  type TaskFormState,
} from '@/domain/taskForm';
import type { TranslationKey } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { useTasks } from '@/providers/TaskProvider';
import type { CategoryKey, Language, SharedMember } from '@/types';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Card, Text, TouchableRipple } from 'react-native-paper';

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
  editingTaskId: _editingTaskId,
  sharedMembers,
}: TaskFormFieldsProps) {
  const { user: _user } = useAuth();
  const { tasks: _tasks } = useTasks();

  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [smartInputText, setSmartInputText] = useState('');

  const applyParsedTask = (textToParse: string) => {
    if (!textToParse.trim()) return;
    const res = parseTaskInput(textToParse, language);
    if (!res) return;

    const patch: Partial<TaskFormState> = {};
    if (res.title) patch.title = res.title;
    if (res.amount !== undefined) {
      patch.amountText = String(res.amount);
      patch.finance = true;
    }
    if (res.icon) patch.icon = res.icon;
    if (res.reminderTime) patch.reminderTime = res.reminderTime;
    if (res.recurrence) {
      patch.recurrenceType = res.recurrence.type;
      if (res.recurrence.interval) patch.interval = res.recurrence.interval;
      if (res.recurrence.dayOfMonth) patch.dayOfMonth = res.recurrence.dayOfMonth;
      if (res.recurrence.weekday) patch.weekday = res.recurrence.weekday;
    }
    if (res.category) {
      onCategoryChange(res.category);
    }
    onChange(patch);
  };

  useEffect(() => {
    if (sharedMembers !== undefined && sharedMembers.length === 0 && state.assignedTo !== null) {
      onChange({ assignedTo: null });
    }
  }, [sharedMembers, state.assignedTo, onChange]);

  const config = getCategoryFormConfig(state.category);
  const previewRule = buildRecurrenceRule(state);
  const previewLabel = frequencyLabelFromRule(previewRule, language);

  const defaultIcon = CATEGORY_MAP[state.category].icon;
  const emojiOptions = useMemo(() => {
    const baseEmojis = ['🏠', '💳', '🏍️', '📄', '🔥', '💧', '🧹', '🍳', '💊', '☀️', '📺', '💪', '🍬', '🎁', '🏫', '📝', '🚗', '💅', '🍖', '🩺', '📈', '📁', '🏊', '🚌', '🛒', '⚡', '📶', '🔑', '🧼', '🧺', '🪴'];
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
    const patch: Partial<TaskFormState> = {
      recurrenceType: config.recurrenceType,
      reminderTime: config.reminderTime,
      ...(config.interval !== undefined && { interval: config.interval }),
      ...(config.intervalUnit !== undefined && { intervalUnit: config.intervalUnit }),
      ...(config.dayOfMonth !== undefined && { dayOfMonth: config.dayOfMonth }),
      ...(config.weekday !== undefined && { weekday: config.weekday }),
    };

    const rule = buildRecurrenceRule({ ...state, ...patch });
    const nextDueIso = computeInitialDueDate(rule, state.startDate, config.reminderTime);
    patch.startDate = nextDueIso.slice(0, 10);

    onChange(patch);
  };

  const calculatedNextDue = useMemo(() => {
    return computeInitialDueDate(previewRule, state.startDate, state.reminderTime);
  }, [previewRule, state.startDate, state.reminderTime]);

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

        {/* Prominent Smart Natural Language Input Bar */}
        <Card style={styles.smartCard} mode="elevated">
          <Card.Content style={styles.smartCardContent}>
            <View style={styles.smartHeaderRow}>
              <Text style={styles.smartBadge}>⚡ {language === 'hi' ? 'स्मार्ट इनपुट' : 'Smart Input'}</Text>
            </View>
            <View style={styles.smartInputWrap}>
              <AppIcon name="sparkles" size={18} color={Colors.marigoldDeep} />
              <TextInput
                style={styles.smartTextInput}
                placeholder={
                  language === 'hi'
                    ? 'कार्य, समय और राशि भरने के लिए लिखें (उदा. "किराया ₹15000 हर महीने 5 तारीख को")'
                    : 'Type to auto-fill title, repeat & amount (e.g. "Rent ₹15000 monthly on 5th")'
                }
                placeholderTextColor={Colors.inkFaint}
                value={smartInputText}
                onChangeText={(text) => {
                  setSmartInputText(text);
                  applyParsedTask(text);
                }}
              />
              {smartInputText.length > 0 && (
                <Pressable onPress={() => setSmartInputText('')}>
                  <AppIcon name="close-circle" size={18} color={Colors.inkFaint} />
                </Pressable>
              )}
            </View>

            {/* Smart Prompt Suggestions */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.smartPromptScroll}>
              <Pressable
                style={styles.smartPromptChip}
                onPress={() => {
                  const t = language === 'hi' ? 'किराया ₹15000 हर महीने 5 तारीख को' : 'House Rent ₹15000 monthly on 5th';
                  setSmartInputText(t);
                  applyParsedTask(t);
                }}
              >
                <Text style={styles.smartPromptText}>🏠 {language === 'hi' ? 'किराया ₹15000' : 'Rent ₹15,000'}</Text>
              </Pressable>
              <Pressable
                style={styles.smartPromptChip}
                onPress={() => {
                  const t = language === 'hi' ? 'कामवाली वेतन ₹5000 हर महीने 1 तारीख को' : 'Maid salary ₹5000 monthly on 1st';
                  setSmartInputText(t);
                  applyParsedTask(t);
                }}
              >
                <Text style={styles.smartPromptText}>🧹 {language === 'hi' ? 'कामवाली ₹5000' : 'Maid ₹5,000'}</Text>
              </Pressable>
              <Pressable
                style={styles.smartPromptChip}
                onPress={() => {
                  const t = language === 'hi' ? 'पानी का बिल ₹500 हर 2 महीने' : 'Water bill ₹500 every 2 months';
                  setSmartInputText(t);
                  applyParsedTask(t);
                }}
              >
                <Text style={styles.smartPromptText}>💧 {language === 'hi' ? 'पानी बिल ₹500' : 'Water bill ₹500'}</Text>
              </Pressable>
            </ScrollView>
          </Card.Content>
        </Card>

        <FormField
          label={translate('presetTitle')}
          value={state.title}
          onChangeText={(title) => onChange({ title: title.slice(0, 60) })}
          placeholder={translate(config.titlePlaceholder)}
          maxLength={60}
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
        <IconPickerStrip
          options={emojiOptions}
          selectedIcon={state.icon}
          defaultIcon={defaultIcon}
          onSelectIcon={(icon) => onChange({ icon })}
        />
      </View>

      {/* ── SECTION 2: SCHEDULE & RECURRENCE ── */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeaderTitle}>{language === 'hi' ? '2. समय सारणी एवं पुनरावृत्ति' : '2. Schedule & Repeat'}</Text>

        <View style={styles.dateTimeRow}>
          <View style={styles.dateCol}>
            <DateField
              label={language === 'hi' ? 'तारीख' : 'Date'}
              value={state.startDate || new Date().toISOString().slice(0, 10)}
              onChange={(startDate) => {
                const patch: Partial<TaskFormState> = { startDate };
                try {
                  const d = new Date(startDate);
                  if (!isNaN(d.getTime())) {
                    const dayOfMonth = d.getDate();
                    const weekday = d.getDay();
                    const nthWeekday = Math.ceil(dayOfMonth / 7);

                    if (state.recurrenceType === 'monthDay') {
                      patch.dayOfMonth = dayOfMonth;
                    } else if (state.recurrenceType === 'weekly') {
                      patch.weekday = weekday;
                    } else if (state.recurrenceType === 'nthWeekday') {
                      patch.nthWeekday = nthWeekday;
                      patch.weekday = weekday;
                    }
                  }
                } catch {
                  // ignore date parsing error
                }
                onChange(patch);
              }}
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
        <View style={styles.summaryBox}>
          <View style={styles.summaryIconWrapper}>
            <AppIcon name="checkmark-done-outline" size={16} color={Colors.tealDeep} />
          </View>
          <View style={styles.summaryTextWrapper}>
            <Text style={styles.summaryTitle}>{language === 'hi' ? 'अनुसूची सारांश' : 'Schedule Summary'}</Text>
            <Text style={styles.summarySub}>
              {language === 'hi'
                ? `आपको ${previewLabel} पर ${formatTime(state.reminderTime || '09:00')} बजे याद दिलाया जाएगा।`
                : `You'll be reminded ${previewLabel} at ${formatTime(state.reminderTime || '09:00')}.`}
              {state.amountText ? ` Amount: ₹${state.amountText}` : ''}
            </Text>
          </View>
        </View>

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
              onChangeText={(val) => {
                const cleaned = val.replace(/\D/g, '').slice(0, 7);
                onChange({ amountText: cleaned });
              }}
              placeholder={language === 'hi' ? 'राशि प्रविष्ट करें (उदा. ₹1,500)' : 'Enter amount (e.g. ₹1,500)'}
              keyboardType="number-pad"
              maxLength={7}
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
      <CategoryPickerModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        selectedCategory={state.category}
        onSelectCategory={onCategoryChange}
        language={language}
        translate={translate}
      />

      {/* Recurrence Selection Modal */}
      <RecurrencePickerModal
        visible={showRecurrenceModal}
        onClose={() => setShowRecurrenceModal(false)}
        state={state}
        onChange={onChange}
        allowed={allowed}
        language={language}
        translate={translate}
        dateNum={dateNum}
        weekdayIndex={weekdayIndex}
        weekdayNameStr={weekdayNameStr}
        monthNameStr={monthNameStr}
        nth={nth}
        nthStr={nthStr}
      />
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

  // Schedule Summary Card / Box
  summaryBox: {
    backgroundColor: 'rgba(62, 124, 106, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(62, 124, 106, 0.2)',
    borderRadius: Radius.md,
    marginBottom: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(62, 124, 106, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTextWrapper: { flex: 1, gap: 2 },
  summaryTitle: {
    fontSize: 12.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.tealDeep,
  },
  summarySub: {
    fontSize: 12,
    color: Colors.inkSoft,
    lineHeight: 17,
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

  // Smart Input Styles
  smartCard: {
    backgroundColor: '#FFFBF0',
    borderColor: '#F5C56E',
    borderWidth: 1.5,
    borderRadius: Radius.md,
    marginBottom: 14,
    elevation: 2,
  },
  smartCardContent: {
    padding: 12,
  },
  smartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  smartBadge: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 12,
    color: Colors.marigoldDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  smartHint: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
  },
  smartInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    marginBottom: 8,
  },
  smartTextInput: {
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13.5,
    color: Colors.ink,
    paddingVertical: 4,
  },
  smartPromptScroll: {
    flexDirection: 'row',
  },
  smartPromptChip: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E8A33D40',
    borderRadius: Radius.xs,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
  },
  smartPromptText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.ink,
  },
});
