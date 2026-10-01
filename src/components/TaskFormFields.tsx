import { AppIcon } from '@/components/AppIcon';
import { DateField } from '@/components/DateField';
import { FormField } from '@/components/FormField';
import { RepeatExamplesStrip } from '@/components/RepeatExamplesStrip';
import { AlarmToggleRow } from '@/components/taskForm/AlarmToggleRow';
import { CategoryPickerModal } from '@/components/taskForm/CategoryPickerModal';
import { IconPickerStrip } from '@/components/taskForm/IconPickerStrip';
import { RecurrencePickerModal } from '@/components/taskForm/RecurrencePickerModal';
import { TimeField } from '@/components/TimeField';
import { CATEGORY_MAP } from '@/constants/categories';
import { getCategoryFormConfig } from '@/constants/categoryFormConfig';
import { getCategoryLabel } from '@/constants/categoryHelpers';
import { Colors, Radius } from '@/constants/theme';
import { parseTaskInput } from '@/domain/parser';
import { computeInitialDueDate, daysUntilDue, frequencyLabelFromRule } from '@/domain/recurrence';
import {
  buildRecurrenceRule,
  getDefaultDoseTimes,
  validateSmartTitle,
  type TaskFormErrors,
  type TaskFormState,
} from '@/domain/taskForm';
import type { TranslationKey } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { useTasks } from '@/providers/TaskProvider';
import type { CategoryKey, DetectedToken, Language, SharedMember } from '@/types';
import { formatTime12 } from '@/utils/timeFormat';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
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
  const [detectedTokens, setDetectedTokens] = useState<DetectedToken[]>([]);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);

  const defaultCurrentTime = useMemo(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, []);

  const liveTitleValidation = useMemo(() => {
    if (!titleTouched && !state.title) return { isValid: true };
    return validateSmartTitle(state.title, language);
  }, [state.title, titleTouched, language]);

  const cleanTitleCandidate = useMemo(() => {
    if (!state.title || !state.title.trim()) return '';
    const res = parseTaskInput(state.title, language);
    return res.title;
  }, [state.title, language]);

  const handleTitleChange = (rawText: string) => {
    setTitleTouched(true);
    const text = rawText.slice(0, 80);
    if (text.trim()) {
      const res = parseTaskInput(text, language);
      const patch: Partial<TaskFormState> = { title: text };

      if (res.amount !== undefined) {
        patch.amountText = String(res.amount);
        patch.finance = true;
      }
      if (res.icon) patch.icon = res.icon;
      if (res.reminderTime) patch.reminderTime = res.reminderTime;
      if (res.isMultiTime && res.timesPerDay) {
        patch.isMultiTime = true;
        patch.timesPerDay = res.timesPerDay;
        patch.reminderTimes = res.reminderTimes;
      }
      if (res.recurrence) {
        patch.recurrenceType = res.recurrence.type;
        if (res.recurrence.interval) patch.interval = res.recurrence.interval;
        if (res.recurrence.intervalUnit) patch.intervalUnit = res.recurrence.intervalUnit;
        if (res.recurrence.dayOfMonth) patch.dayOfMonth = res.recurrence.dayOfMonth;
        if (res.recurrence.weekday !== undefined) patch.weekday = res.recurrence.weekday;
      }
      if (res.alarmEnabled !== undefined) {
        patch.alarmEnabled = res.alarmEnabled;
      }
      if (res.category && res.category !== state.category) {
        onCategoryChange(res.category);
      }
      onChange(patch);
      setDetectedTokens(res.detectedTokens ?? []);
    } else {
      onChange({ title: text });
      setDetectedTokens([]);
    }
  };

  const applyInspirationPrompt = (fullPrompt: string) => {
    const res = parseTaskInput(fullPrompt, language);
    const patch: Partial<TaskFormState> = {
      title: res.title,
    };
    if (res.amount !== undefined) {
      patch.amountText = String(res.amount);
      patch.finance = true;
    }
    if (res.icon) patch.icon = res.icon;
    if (res.reminderTime) patch.reminderTime = res.reminderTime;
    if (res.isMultiTime && res.timesPerDay) {
      patch.isMultiTime = true;
      patch.timesPerDay = res.timesPerDay;
      patch.reminderTimes = res.reminderTimes;
    }
    if (res.recurrence) {
      patch.recurrenceType = res.recurrence.type;
      if (res.recurrence.interval) patch.interval = res.recurrence.interval;
      if (res.recurrence.intervalUnit) patch.intervalUnit = res.recurrence.intervalUnit;
      if (res.recurrence.dayOfMonth) patch.dayOfMonth = res.recurrence.dayOfMonth;
      if (res.recurrence.weekday !== undefined) patch.weekday = res.recurrence.weekday;
    }
    if (res.alarmEnabled !== undefined) {
      patch.alarmEnabled = res.alarmEnabled;
    }
    if (res.category && res.category !== state.category) {
      onCategoryChange(res.category);
    }
    onChange(patch);
    setDetectedTokens(res.detectedTokens ?? []);
  };

  const dismissToken = (tokenId: string) => {
    setDetectedTokens((prev) => prev.filter((t) => t.id !== tokenId));
    if (tokenId === 'amount') {
      onChange({ amountText: '', finance: false });
    } else if (tokenId === 'time') {
      onChange({ reminderTime: null });
    } else if (tokenId === 'doses') {
      onChange({ isMultiTime: false, timesPerDay: 1 });
    } else if (tokenId === 'recurrence') {
      onChange({ recurrenceType: 'monthly', interval: 1, dayOfMonth: 1 });
    } else if (tokenId === 'alarm') {
      onChange({ alarmEnabled: !state.alarmEnabled });
    }
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
    return computeInitialDueDate(
      previewRule,
      state.startDate,
      state.reminderTime,
      new Date(),
      state.isMultiTime ? state.reminderTimes : undefined
    );
  }, [previewRule, state.startDate, state.reminderTime, state.isMultiTime, state.reminderTimes]);

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

  const summaryTimesStr = useMemo(() => {
    if (state.isMultiTime && state.timesPerDay > 1 && state.reminderTimes && state.reminderTimes.length > 0) {
      return state.reminderTimes
        .slice(0, state.timesPerDay)
        .map((t) => formatTime12(t))
        .join(', ');
    }
    return formatTime12(state.reminderTime || '09:00');
  }, [state.isMultiTime, state.timesPerDay, state.reminderTimes, state.reminderTime]);

  return (
    <View style={styles.formRoot}>

      {/* ── SECTION 1: TASK IDENTITY ── */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeNum}>1</Text>
          </View>
          <Text style={styles.sectionHeaderTitle}>{language === 'hi' ? 'कार्य विवरण' : 'Task Details'}</Text>
        </View>

        {/* Unified Smart Title Input */}
        <View style={styles.smartTitleHeader}>
          <Text style={styles.fieldLabel}>{translate('presetTitle')}</Text>
          <View style={styles.smartPillBadge}>
            <AppIcon name="sparkles" size={11} color={Colors.marigoldDeep} />
            <Text style={styles.smartPillText}>
              {language === 'hi' ? 'स्मार्ट ऑटो-फिल' : 'Smart Auto-Fill'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.titleInputContainer,
            isTitleFocused && styles.titleInputFocused,
            ((errors?.title) || (titleTouched && !liveTitleValidation.isValid)) && styles.titleInputError,
          ]}
        >
          <AppIcon
            name="create-outline"
            size={18}
            color={isTitleFocused ? Colors.marigoldDeep : Colors.inkSoft}
            style={styles.titleInputIcon}
          />
          <TextInput
            style={styles.titleTextInput}
            value={state.title}
            onChangeText={handleTitleChange}
            onFocus={() => setIsTitleFocused(true)}
            onBlur={() => {
              setIsTitleFocused(false);
              setTitleTouched(true);
            }}
            placeholder={
              language === 'hi'
                ? 'उदा. "पौधों को पानी रोज़", "किराया ₹15000 हर महीने 5 तारीख"'
                : 'e.g. "Water plants daily at 8am", "Rent ₹15,000 monthly 5th"'
            }
            placeholderTextColor={Colors.inkFaint}
            maxLength={80}
            testID="task-title-input"
          />
          {state.title.length > 0 && (
            <TouchableOpacity onPress={() => handleTitleChange('')} hitSlop={8}>
              <AppIcon name="close-circle" size={18} color={Colors.inkFaint} />
            </TouchableOpacity>
          )}
        </View>
        {errors?.title ? (
          <Text style={styles.errorText}>{errors.title}</Text>
        ) : titleTouched && !liveTitleValidation.isValid && liveTitleValidation.error ? (
          <Text style={styles.smartGuidanceText}>💡 {liveTitleValidation.error}</Text>
        ) : liveTitleValidation.warning ? (
          <Text style={styles.smartWarningText}>{liveTitleValidation.warning}</Text>
        ) : null}

        {/* Live Detected Tokens Badges */}
        {detectedTokens.length > 0 && (
          <View style={styles.detectedContainer}>
            <View style={styles.detectedHeader}>
              <Text style={styles.detectedTitle}>
                ⚡ {language === 'hi' ? 'ऑटो-पहचाने गए फ़ील्ड:' : 'Auto-detected:'}
              </Text>
              {cleanTitleCandidate && cleanTitleCandidate !== state.title && (
                <TouchableOpacity
                  style={styles.cleanTitleBtn}
                  onPress={() => onChange({ title: cleanTitleCandidate })}
                >
                  <Text style={styles.cleanTitleBtnText}>
                    ✂️ {language === 'hi' ? `नाम: "${cleanTitleCandidate}"` : `Keep clean: "${cleanTitleCandidate}"`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detectedTokensRow}>
              {detectedTokens.map((token) => (
                <View key={token.id} style={styles.tokenBadge}>
                  <Text style={styles.tokenBadgeText}>
                    {token.icon} {token.label}
                  </Text>
                  {token.id !== 'category' && (
                    <TouchableOpacity onPress={() => dismissToken(token.id)} hitSlop={6} style={styles.tokenCloseBtn}>
                      <Text style={styles.tokenCloseText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Quick Inspiration Pills */}
        <View style={styles.inspirationContainer}>
          <Text style={styles.inspirationLabel}>
            💡 {language === 'hi' ? 'त्वरित सुझाव (1-टैप):' : 'Quick Suggestions (1-tap):'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inspirationScroll}>
            <TouchableOpacity
              style={styles.inspirationChip}
              onPress={() => applyInspirationPrompt(language === 'hi' ? 'पौधों को पानी रोज़ सुबह 8 बजे' : 'Water plants daily at 8am')}
            >
              <Text style={styles.inspirationChipText}>🪴 {language === 'hi' ? 'पौधे (रोज़)' : 'Water plants (Daily)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inspirationChip}
              onPress={() => applyInspirationPrompt(language === 'hi' ? 'किराया ₹15000 हर महीने 5 तारीख' : 'House Rent ₹15,000 monthly on 5th')}
            >
              <Text style={styles.inspirationChipText}>🏠 {language === 'hi' ? 'किराया ₹15,000 (5 तारीख)' : 'Rent ₹15,000 (5th)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inspirationChip}
              onPress={() => applyInspirationPrompt(language === 'hi' ? 'जिम कसरत रोज़ सुबह 7 बजे' : 'Gym workout daily at 7am')}
            >
              <Text style={styles.inspirationChipText}>💪 {language === 'hi' ? 'जिम (रोज़ 7am)' : 'Gym (Daily 7am)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inspirationChip}
              onPress={() => applyInspirationPrompt(language === 'hi' ? 'कामवाली वेतन ₹4000 हर महीने 1 तारीख' : 'Maid salary ₹4000 monthly on 1st')}
            >
              <Text style={styles.inspirationChipText}>🧹 {language === 'hi' ? 'कामवाली ₹4,000 (1 तारीख)' : 'Maid ₹4,000 (1st)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inspirationChip}
              onPress={() => applyInspirationPrompt(language === 'hi' ? 'दवा दिन में 2 बार सुबह 8 बजे' : 'Medicine twice daily at 8am')}
            >
              <Text style={styles.inspirationChipText}>💊 {language === 'hi' ? 'दवा (2 बार रोज़)' : 'Medicine (2x daily)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inspirationChip}
              onPress={() => applyInspirationPrompt(language === 'hi' ? 'वाईफाई बिल ₹800 हर महीने 15 तारीख' : 'Wifi bill ₹800 monthly on 15th')}
            >
              <Text style={styles.inspirationChipText}>📶 {language === 'hi' ? 'वाईफाई ₹800 (15 तारीख)' : 'Wifi ₹800 (15th)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inspirationChip}
              onPress={() => applyInspirationPrompt(language === 'hi' ? 'विटामिन डी हर रविवार सुबह 10 बजे' : 'Vitamin D every sunday at 10am')}
            >
              <Text style={styles.inspirationChipText}>☀️ {language === 'hi' ? 'विटामिन डी (रविवार)' : 'Vitamin D (Sunday)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inspirationChip}
              onPress={() => applyInspirationPrompt(language === 'hi' ? 'गैस सिलेंडर हर 45 दिन' : 'Gas cylinder every 45 days')}
            >
              <Text style={styles.inspirationChipText}>🔥 {language === 'hi' ? 'गैस सिलेंडर (45 दिन)' : 'Gas cylinder (45d)'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Category Selector Card */}
        <Text style={styles.fieldLabel}>{language === 'hi' ? 'श्रेणी' : 'Category'}</Text>
        <Card style={styles.dropdownCard} mode="elevated" testID="task-category-trigger">
          <TouchableRipple onPress={() => setShowCategoryModal(true)} style={styles.dropdownRipple} borderless>
            <View style={styles.dropdownRow}>
              <View style={styles.dropdownLeft}>
                <View style={styles.categoryEmojiBadge}>
                  <Text style={styles.dropdownEmoji}>{CATEGORY_MAP[state.category]?.icon || '📋'}</Text>
                </View>
                <View style={styles.categoryTextCol}>
                  <Text style={styles.dropdownText}>{getCategoryLabel(state.category, language)}</Text>
                  <Text style={styles.catHintInCard} numberOfLines={1}>
                    {CATEGORY_MAP[state.category]?.[language === 'hi' ? 'hintHi' : 'hintEn']}
                  </Text>
                </View>
              </View>
              <View style={styles.chevronWrap}>
                <AppIcon name="chevron-forward" size={16} color={Colors.inkSoft} />
              </View>
            </View>
          </TouchableRipple>
        </Card>

        {/* Icon Strip */}
        <Text style={styles.fieldLabel}>{language === 'hi' ? 'आइकन चुनें' : 'Choose Icon'}</Text>
        <IconPickerStrip
          selectedIcon={state.icon || defaultIcon}
          options={emojiOptions}
          defaultIcon={defaultIcon}
          onSelectIcon={(icon) => onChange({ icon })}
        />
      </View>

      {/* ── SECTION 2: SCHEDULE & RECURRENCE ── */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeNum}>2</Text>
          </View>
          <Text style={styles.sectionHeaderTitle}>{language === 'hi' ? 'समय सारणी एवं पुनरावृत्ति' : 'Schedule & Repeat'}</Text>
        </View>

        {/* 1. Date */}
        <View style={{ marginBottom: 12 }}>
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

        {/* 2. How often does it repeat */}
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

        {/* 3. Time & Multi-Time Section */}
        <View style={styles.timeBlock}>
          <Text style={styles.fieldLabel}>{language === 'hi' ? 'समय' : 'Time'}</Text>

          {/* Repeat multiple times a day toggle */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => {
              const nextMulti = !state.isMultiTime;
              const count = nextMulti ? Math.max(2, state.timesPerDay || 2) : 1;
              const times = nextMulti
                ? (state.reminderTimes.length >= count ? state.reminderTimes : getDefaultDoseTimes(count))
                : [state.reminderTimes[0] || state.reminderTime || defaultCurrentTime];
              onChange({
                isMultiTime: nextMulti,
                timesPerDay: count,
                reminderTimes: times,
                reminderTime: times[0],
              });
            }}
            activeOpacity={0.8}
            testID="task-multi-time-toggle"
          >
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>
                {language === 'hi' ? 'दिन में कई बार दोहराएं' : 'Repeat multiple times a day'}
              </Text>
              <Text style={styles.toggleSub}>
                {language === 'hi'
                  ? 'दवाइयाँ, पानी, व्यायाम आदि (2 से 5 बार)'
                  : 'Medicines, water, workouts, etc. (2 to 5 times)'}
              </Text>
            </View>
            <View style={[styles.switchTrack, state.isMultiTime && styles.switchTrackActive]}>
              <View style={[styles.switchThumb, state.isMultiTime && styles.switchThumbActive]} />
            </View>
          </TouchableOpacity>

          {!state.isMultiTime ? (
            <View style={{ marginTop: 10 }}>
              <TimeField
                label={language === 'hi' ? 'समय' : 'Time'}
                value={state.reminderTime || defaultCurrentTime}
                onChange={(reminderTime) =>
                  onChange({ reminderTime, reminderTimes: [reminderTime] })
                }
                testID="task-time-picker"
              />
            </View>
          ) : (
            <View style={styles.multiTimeContainer}>
              <Text style={styles.multiTimeCountLabel}>
                {language === 'hi' ? 'दिन में कितनी बार?' : 'How many times per day?'}
              </Text>
              <View style={styles.doseCountSelectorRow}>
                {[2, 3, 4, 5].map((cnt) => (
                  <TouchableOpacity
                    key={cnt}
                    style={[
                      styles.doseCountChip,
                      state.timesPerDay === cnt && styles.doseCountChipActive,
                    ]}
                    onPress={() => {
                      const newTimes = getDefaultDoseTimes(cnt);
                      onChange({
                        timesPerDay: cnt,
                        reminderTimes: newTimes,
                        reminderTime: newTimes[0],
                      });
                    }}
                    testID={`dose-count-${cnt}`}
                  >
                    <Text
                      style={[
                        styles.doseCountChipText,
                        state.timesPerDay === cnt && styles.doseCountChipTextActive,
                      ]}
                    >
                      {cnt}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.doseTimesList}>
                {state.reminderTimes.slice(0, state.timesPerDay).map((t, idx) => (
                  <View key={idx} style={styles.doseTimeItem}>
                    <View style={styles.doseBadgeCircle}>
                      <Text style={styles.doseBadgeCircleText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <TimeField
                        label={
                          language === 'hi'
                            ? `समय ${idx + 1}`
                            : `Time ${idx + 1}`
                        }
                        value={t}
                        onChange={(newT) => {
                          const updated = [...state.reminderTimes];
                          updated[idx] = newT;
                          onChange({
                            reminderTimes: updated,
                            reminderTime: idx === 0 ? newT : state.reminderTime,
                          });
                        }}
                        testID={`task-time-picker-${idx}`}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {errors?.time ? (
            <Text style={[styles.errorText, { marginTop: 8 }]}>{errors.time}</Text>
          ) : null}

          {/* Alarm Mode Toggle (Fullscreen Alarm vs Push Notification) */}
          <AlarmToggleRow
            value={state.alarmEnabled}
            onChange={(alarmEnabled) => onChange({ alarmEnabled })}
            language={language}
          />
        </View>

        {/* 4. Schedule Summary Box */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryIconWrapper}>
            <AppIcon name="checkmark-done-outline" size={16} color={Colors.tealDeep} />
          </View>
          <View style={styles.summaryTextWrapper}>
            <Text style={styles.summaryTitle}>{language === 'hi' ? 'अनुसूची सारांश' : 'Schedule Summary'}</Text>
            <Text style={styles.summarySub}>
              {language === 'hi'
                ? `आपको ${previewLabel} पर ${summaryTimesStr} बजे याद दिलाया जाएगा${state.isMultiTime && state.timesPerDay > 1 ? ` (दिन में ${state.timesPerDay} बार)` : ''}${state.alarmEnabled ? ' (🔔 अलार्म)' : ' (📲 सूचना)'}।`
                : `You'll be reminded ${previewLabel} at ${summaryTimesStr}${state.isMultiTime && state.timesPerDay > 1 ? ` (${state.timesPerDay} times a day)` : ''}${state.alarmEnabled ? ' (🔔 Alarm)' : ' (📲 Push)'}.`}
              {state.amountText ? ` Amount: ₹${state.amountText}` : ''}
            </Text>
          </View>
        </View>

        {/* Quick Presets Strip */}
        <RepeatExamplesStrip language={language} onSelect={handleSelectExample} />
      </View>

      {/* ── SECTION 3: FINANCE & EXPENSES ── */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeNum}>3</Text>
          </View>
          <Text style={styles.sectionHeaderTitle}>{language === 'hi' ? 'वित्त एवं बजट' : 'Finance & Expenses'}</Text>
        </View>

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
                const cleaned = val.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7);
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
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeNum}>4</Text>
          </View>
          <Text style={styles.sectionHeaderTitle}>{language === 'hi' ? 'नोट (वैकल्पिक)' : 'Notes (Optional)'}</Text>
        </View>
        <FormField
          label={language === 'hi' ? 'अतिरिक्त विवरण या निर्देश' : 'Additional Details or Instructions'}
          value={state.note}
          onChangeText={(note) => onChange({ note })}
          placeholder={language === 'hi' ? 'जैसे: खाता विवरण, मीटर नंबर, आदि...' : 'e.g., Account ID, meter number, instructions...'}
          multiline
          maxLength={500}
          error={errors?.note}
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
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(228, 219, 199, 0.7)',
    shadowColor: '#171B36',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(245, 197, 110, 0.25)',
    borderWidth: 1,
    borderColor: Colors.marigoldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeNum: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 11,
    color: Colors.marigoldDeep,
  },
  sectionHeaderTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12.5,
    color: Colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    marginBottom: 10,
    elevation: 0,
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
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  categoryEmojiBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(245, 197, 110, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTextCol: {
    flex: 1,
    gap: 1,
  },
  dropdownEmoji: { fontSize: 20 },
  dropdownText: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
  catHintInCard: {
    fontSize: 11,
    color: Colors.inkSoft,
    fontFamily: 'Manrope_500Medium',
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
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
  timeBlock: {
    marginTop: 4,
    marginBottom: 10,
  },
  multiTimeContainer: {
    marginTop: 10,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  multiTimeCountLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.ink,
    marginBottom: 8,
  },
  doseCountSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  doseCountChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.xs,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doseCountChipActive: {
    backgroundColor: Colors.marigold,
    borderColor: Colors.marigoldDeep,
  },
  doseCountChipText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.ink,
  },
  doseCountChipTextActive: {
    color: Colors.ink,
  },
  doseTimesList: {
    gap: 8,
  },
  doseTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doseBadgeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  doseBadgeCircleText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 11,
    color: Colors.ink,
  },

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

  // Smart Title & Auto-Detection Styles
  smartTitleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  smartPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF4DE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#F5C56E',
  },
  smartPillText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 10,
    color: Colors.marigoldDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  titleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginBottom: 4,
  },
  titleInputFocused: {
    borderColor: Colors.marigoldDeep,
    backgroundColor: '#FFFDF8',
  },
  titleInputError: {
    borderColor: Colors.clay,
  },
  titleInputIcon: {
    marginRight: 8,
  },
  titleTextInput: {
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
    color: Colors.ink,
    padding: 0,
  },
  errorText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.clay,
    marginTop: 2,
    marginBottom: 6,
  },
  smartGuidanceText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11.5,
    color: '#D97706',
    marginTop: 2,
    marginBottom: 6,
  },
  smartWarningText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkFaint,
    marginTop: 2,
    marginBottom: 6,
  },

  // Live Detected Tokens Badges
  detectedContainer: {
    marginTop: 8,
    marginBottom: 6,
    backgroundColor: '#FFFBF3',
    borderRadius: Radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F5C56E60',
  },
  detectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detectedTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.marigoldDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cleanTitleBtn: {
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  cleanTitleBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10.5,
    color: Colors.tealDeep,
  },
  detectedTokensRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 0.5,
  },
  tokenBadgeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11.5,
    color: Colors.ink,
  },
  tokenCloseBtn: {
    padding: 2,
  },
  tokenCloseText: {
    fontSize: 11,
    color: Colors.inkSoft,
    fontWeight: 'bold',
  },

  // Inspiration Pills
  inspirationContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
    marginBottom: 10,
  },
  inspirationLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.inkSoft,
  },
  inspirationScroll: {
    flexDirection: 'row',
    gap: 6,
  },
  inspirationChip: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inspirationChipText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.ink,
  },
});
