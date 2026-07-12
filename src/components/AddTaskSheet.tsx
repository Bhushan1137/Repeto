import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, TextInput as PaperInput, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { RecurrenceDatePicker } from '@/components/RecurrenceDatePicker';
import { useTasks } from '@/providers/TaskProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useTaskParser } from '@/hooks/useTaskParser';
import { parseTaskInput } from '@/domain/parser';
import { Button } from '@/components/Button';
import { SettingRow } from '@/components/SettingRow';
import { SelectField } from '@/components/SelectField';
import { TimeField } from '@/components/TimeField';
import { FormField } from '@/components/FormField';
import { AppIcon } from '@/components/AppIcon';
import { AccentHex, Colors, Radius, Typography } from '@/constants/theme';
import { CATEGORIES, CATEGORY_GROUPS, CATEGORY_MAP } from '@/constants/categories';
import { getCategoryLabel } from '@/constants/categoryHelpers';
import { useAuth } from '@/providers/AuthProvider';
import { canShareWith } from '@/domain/task';
import { initials } from '@/domain/insights';
import { toSharedMember } from '@/domain/household';
import {
  applyCategoryChange,
  formStateFromParsed,
  formStateToValues,
  validateFormState,
  buildRecurrenceRule,
  weekdayLabel,
  weekdayLabel as getWeekdayLabel,
  nthLabel,
  intervalPresets,
  type TaskFormState,
} from '@/domain/taskForm';
import { frequencyLabelFromRule, ordinalSuffix } from '@/domain/recurrence';
import type { SharedMember } from '@/types';

import { Toast } from '@/components/Toast';

interface AddTaskSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function AddTaskSheet({ visible, onClose }: AddTaskSheetProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { addTask } = useTasks();
  const { showToast, message } = useToast();
  const { translate, language } = useTranslation();
  
  const [step, setStep] = useState(1);
  const [text, setText] = useState('');
  const [debouncedText, setDebouncedText] = useState('');
  const [formState, setFormState] = useState<TaskFormState | null>(null);
  const [shared, setShared] = useState<SharedMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validateFormState>>({});
  const lastParsedText = useRef('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateForRecurrence, setSelectedDateForRecurrence] = useState<Date | null>(null);

  useEffect(() => {
    if (!text.trim()) {
      setDebouncedText('');
      return;
    }
    const handler = setTimeout(() => {
      setDebouncedText(text);
    }, 300);
    return () => clearTimeout(handler);
  }, [text]);

  const parsed = useTaskParser(debouncedText);

  const currentFrequencyLabel = useMemo(() => {
    if (!formState) return parsed?.frequencyLabel ?? '';
    const rule = buildRecurrenceRule(formState);
    return frequencyLabelFromRule(rule, language);
  }, [formState, parsed, language]);

  const openDatePicker = () => {
    setSelectedDateForRecurrence(formState?.startDate ? new Date(formState.startDate) : new Date());
    setShowDatePicker(true);
  };

  const handleDateConfirm = (date: Date) => {
    setSelectedDateForRecurrence(date);
    setShowDatePicker(false);
  };

  const recurrenceOptionsForDate = useMemo(() => {
    if (!selectedDateForRecurrence) return [];

    const date = selectedDateForRecurrence;
    const weekdayIndex = date.getDay();
    const dateNum = date.getDate();
    const weekdayNameStr = weekdayLabel(weekdayIndex, language);
    
    const suffix = language === 'hi' ? '' : ordinalSuffix(dateNum);
    const dayName = language === 'hi' ? `${dateNum} तारीख` : `${dateNum}${suffix} of the month`;

    const monthName = date.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', {
      month: 'short',
    });
    
    const nth = Math.ceil(dateNum / 7);
    const nthStr = nthLabel(nth, language);

    return [
      {
        key: 'daily' as const,
        label: language === 'hi' ? 'हर दिन' : 'Every day',
        rule: { recurrenceType: 'daily' as const },
      },
      {
        key: 'weekly' as const,
        label: language === 'hi' ? `हर हफ्ते ${weekdayNameStr} को` : `Every week on ${weekdayNameStr}`,
        rule: { recurrenceType: 'weekly' as const, weekday: weekdayIndex },
      },
      {
        key: 'monthly' as const,
        label: language === 'hi' ? `हर महीने की ${dayName} को` : `Every month on the ${dayName}`,
        rule: { recurrenceType: 'monthDay' as const, dayOfMonth: dateNum },
      },
      {
        key: 'yearly' as const,
        label: language === 'hi' ? `हर साल ${dateNum} ${monthName} को` : `Every year on ${monthName} ${dateNum}`,
        rule: { recurrenceType: 'yearly' as const },
      },
      {
        key: 'nthWeekday' as const,
        label: language === 'hi' 
          ? `हर महीने का ${nthStr} ${weekdayNameStr}` 
          : `Every ${nthStr} ${weekdayNameStr} of the month`,
        rule: { recurrenceType: 'nthWeekday' as const, nthWeekday: nth, weekday: weekdayIndex },
      },
    ];
  }, [selectedDateForRecurrence, language]);

  const selectRecurrencePattern = (option: typeof recurrenceOptionsForDate[number]) => {
    if (!formState || !selectedDateForRecurrence) return;
    
    const isoDateStr = selectedDateForRecurrence.toISOString().slice(0, 10);
    
    patchForm({
      ...option.rule,
      startDate: isoDateStr,
    });
    
    setSelectedDateForRecurrence(null);
  };

  // Reset fields when sheet opens/closes
  useEffect(() => {
    if (!visible) {
      setText('');
      setFormState(null);
      setShared([]);
      setErrors({});
      setStep(1);
      lastParsedText.current = '';
      setShowDatePicker(false);
      setSelectedDateForRecurrence(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!debouncedText.trim()) {
      setFormState(null);
      lastParsedText.current = '';
      return;
    }
    if (!parsed || debouncedText === lastParsedText.current) return;

    lastParsedText.current = debouncedText;
    const next = formStateFromParsed(parsed);
    setFormState(next);
    setErrors({});
  }, [debouncedText, parsed]);

  const patchForm = (patch: Partial<TaskFormState>) => {
    setFormState((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleCategoryChange = (category: TaskFormState['category']) => {
    setFormState((prev) => (prev ? applyCategoryChange(prev, category) : prev));
  };

  const addContact = () => {
    const nextShared = [...shared];
    const members = user?.householdMembers ?? [];
    if (members.length === 0) {
      showToast(translate('addHouseholdFirst'));
      onClose();
      router.push('/(tabs)/household');
      return;
    }
    const used = nextShared.map((s) => s.code ?? s.phone);
    const nextMember = members.find((m) => !used.includes(m.code));
    const next = nextMember ? toSharedMember(nextMember) : null;
    if (!next) {
      showToast(translate('allContactsAdded'));
      return;
    }
    nextShared.push(next);
    if (!canShareWith(user, nextShared)) {
      showToast(translate('sharedLimit'));
      return;
    }
    setShared(nextShared);
  };

  const removeContact = (phone: string) => {
    setShared(shared.filter((s) => s.phone !== phone));
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!text.trim()) {
        showToast(translate('typeFirst'));
        return;
      }
      if (!formState || formState.title !== text.trim()) {
        const instantParsed = parseTaskInput(text, language);
        setFormState(formStateFromParsed(instantParsed));
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const save = async () => {
    if (!formState) return;

    const nextErrors = validateFormState(formState, translate);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast(translate('fixErrors' as any) || 'Please fix all errors first');
      return;
    }

    const values = formStateToValues(formState, language);

    setLoading(true);
    const ok = await addTask(
      {
        title: values.title,
        frequencyLabel: values.freq,
        recurrence: values.recurrence,
        amount: values.amount,
        category: values.category,
        reminderTime: values.reminderTime,
        assignedTo: values.assignedTo,
      },
      { finance: values.finance, shared }
    );
    setLoading(false);
    if (ok) {
      showToast(translate('taskCreated'));
      onClose();
    }
  };

  const defaultIcon = formState ? CATEGORY_MAP[formState.category]?.icon ?? '📝' : '📝';
  const emojiOptions = useMemo(() => {
    const baseEmojis = ['🏠', '💳', '🏍️', '📄', '🔥', '💧', '🧹', '🍳', '💊', '☀️', '📺', '💪', '🍬', '🎁', '🏫', '📝', '💇', '💅', '🍖', '🩺', '📈', '📁', '🏊', '🚌', '🛒', '⚡', '📶', '🔑', '🧼', '🧺', '🪴'];
    return [defaultIcon, ...baseEmojis.filter((e) => e !== defaultIcon)];
  }, [defaultIcon]);

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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalContainer}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Card style={styles.sheet} mode="elevated">
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            
            {/* ── STEP 1: WHAT'S THE TASK? ── */}
            {step === 1 && (
              <View>
                <View style={styles.stepIndicatorRow}>
                  <View style={[styles.stepDot, styles.stepDotActive]} />
                  <View style={styles.stepDot} />
                  <View style={styles.stepDot} />
                  <Text style={styles.stepIndicatorText}>{language === 'hi' ? 'चरण 1/3: कार्य विवरण' : 'Step 1 of 3: Task Description'}</Text>
                </View>

                <Text style={styles.serifHeading}>{language === 'hi' ? 'कार्य क्या है?' : "What's the task?"}</Text>
                <Text style={styles.subText}>{language === 'hi' ? 'एक कार्य टाइप करें या एक उदाहरण चुनें' : 'Type a task or pick an example'}</Text>

                <PaperInput
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  placeholder={language === 'hi' ? 'जैसे: हर 1 तारीख को किराया ₹3500' : "e.g. Pay rent every 1st of month, ₹3500"}
                  value={text}
                  onChangeText={setText}
                  outlineColor={Colors.ivoryLine}
                  activeOutlineColor={Colors.marigoldDeep}
                  textColor={Colors.ink}
                  style={styles.textarea}
                  theme={{
                    colors: {
                      background: Colors.white,
                    },
                  }}
                />

                {!text.trim() && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickChipsRow}>
                    {(language === 'hi' ? [
                      { label: '💰 किराया हर 1 तारीख', value: 'किराया हर 1 तारीख को ₹10000' },
                      { label: '🏥 डॉक्टर जांच', value: 'डॉक्टर जांच हर 3 महीने' },
                      { label: '📈 SIP निवेश', value: 'SIP निवेश ₹5000 हर महीने' },
                      { label: '💊 दवाई रिमाइंडर', value: 'दवाई रिमाइंडर हर दिन सुबह 9 बजे' },
                      { label: '💳 क्रेडिट कार्ड बिल', value: 'क्रेडिट कार्ड बिल हर महीने' },
                    ] : [
                      { label: '💰 Pay rent', value: 'Pay rent every 1st of month ₹10000' },
                      { label: '🏥 Doctor checkup', value: 'Doctor checkup every 3 months' },
                      { label: '📈 SIP investment', value: 'SIP investment ₹5000 every month' },
                      { label: '💊 Medicine reminder', value: 'Medicine reminder every day at 9am' },
                      { label: '💳 Credit card bill', value: 'Credit card bill every month' },
                    ]).map((chip) => (
                      <TouchableOpacity
                        key={chip.value}
                        style={styles.quickChip}
                        onPress={() => setText(chip.value)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.quickChipText}>{chip.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.orDivider}>
                  <View style={styles.orDividerLine} />
                  <Text style={styles.orDividerText}>{language === 'hi' ? 'या एक प्रीसेट से शुरू करें' : 'or start from a template'}</Text>
                  <View style={styles.orDividerLine} />
                </View>

                <Card style={styles.presetLibraryCard} mode="elevated">
                  <TouchableRipple
                    onPress={() => {
                      onClose();
                      router.push('/presets');
                    }}
                    style={styles.presetLibraryCardInner}
                    borderless
                  >
                    <View style={styles.presetLibraryRow}>
                      <View style={styles.presetIconContainer}>
                        <Text style={styles.presetIcon}>📚</Text>
                      </View>
                      <View style={styles.presetTextContainer}>
                        <Text style={styles.presetTitleText}>{language === 'hi' ? 'प्रीसेट लाइब्रेरी ब्राउज़ करें' : 'Browse Preset Library'}</Text>
                        <Text style={styles.presetSubText}>{language === 'hi' ? 'घर, वाहन, वित्त और अधिक के लिए टेम्पलेट' : 'Templates for home, vehicle, finance & more'}</Text>
                      </View>
                      <Text style={styles.presetArrow}>›</Text>
                    </View>
                  </TouchableRipple>
                </Card>

                <View style={styles.navRow}>
                  <Button
                    title={language === 'hi' ? 'रद्द करें' : 'Cancel'}
                    variant="ghost"
                    style={styles.navBtn}
                    onPress={onClose}
                  />
                  <Button
                    title={language === 'hi' ? 'आगे बढ़ें →' : 'Next →'}
                    style={[styles.navBtn, styles.ctaInline]}
                    onPress={handleNextStep}
                    disabled={!text.trim()}
                  />
                </View>
              </View>
            )}

            {/* ── STEP 2: HOW OFTEN? ── */}
            {step === 2 && formState && (
              <View>
                <View style={styles.stepIndicatorRow}>
                  <View style={[styles.stepDot, styles.stepDotActive]} />
                  <View style={[styles.stepDot, styles.stepDotActive]} />
                  <View style={styles.stepDot} />
                  <Text style={styles.stepIndicatorText}>{language === 'hi' ? 'चरण 2/3: पुनरावृत्ति / आवृत्ति' : 'Step 2 of 3: How often?'}</Text>
                </View>

                <Text style={styles.serifHeading}>{language === 'hi' ? 'कितनी बार दोहराएं?' : 'How often?'}</Text>
                <Text style={styles.subText}>{language === 'hi' ? 'चुनें कि यह कार्य कैसे दोहराया जाए' : 'Choose how this task repeats'}</Text>

                {/* Option Card A: Calendar day pattern */}
                <TouchableOpacity
                  style={[
                    styles.optionSelectionCard,
                    formState.recurrenceType !== 'interval' && styles.optionSelectionCardActive,
                  ]}
                  onPress={() => {
                    if (formState.recurrenceType === 'interval') {
                      patchForm({ recurrenceType: 'monthDay', dayOfMonth: new Date().getDate() });
                    }
                    openDatePicker();
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.optionCardLeft}>
                    <View style={[styles.optionEmojiCircle, formState.recurrenceType !== 'interval' && styles.optionEmojiCircleActive]}>
                      <Text style={styles.optionEmoji}>📅</Text>
                    </View>
                    <View style={styles.optionCardTextWrap}>
                      <Text style={styles.optionCardTitle}>{language === 'hi' ? 'एक निश्चित दिन पर' : 'On a specific day'}</Text>
                      <Text style={styles.optionCardSub}>{language === 'hi' ? 'जैसे: हर महीने की 1 तारीख, हर मंगलवार' : 'e.g. Every 1st of month, Every Tuesday'}</Text>
                    </View>
                  </View>
                  <View style={[styles.optionRadio, formState.recurrenceType !== 'interval' && styles.optionRadioActive]}>
                    {formState.recurrenceType !== 'interval' && <View style={styles.optionRadioInner} />}
                  </View>
                </TouchableOpacity>

                {formState.recurrenceType !== 'interval' && (
                  <View style={styles.inlineCalendarContainer}>
                    <View style={styles.inlineCalendarHeader}>
                      <Text style={styles.inlineCalendarTitle}>
                        {language === 'hi' ? 'सक्रिय अनुसूची:' : 'Active Schedule:'}
                      </Text>
                      <Text style={styles.inlineCalendarValue}>{currentFrequencyLabel}</Text>
                    </View>
                    <TouchableOpacity style={styles.inlineCalendarChangeBtn} onPress={openDatePicker}>
                      <Text style={styles.inlineCalendarChangeBtnText}>
                        {language === 'hi' ? '🗓️ बदलें' : '🗓️ Change'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.orDivider}>
                  <View style={styles.orDividerLine} />
                  <Text style={styles.orDividerText}>{language === 'hi' ? 'या' : 'or'}</Text>
                  <View style={styles.orDividerLine} />
                </View>

                {/* Option Card B: Interval repeating */}
                <TouchableOpacity
                  style={[
                    styles.optionSelectionCard,
                    formState.recurrenceType === 'interval' && styles.optionSelectionCardActive,
                  ]}
                  onPress={() => patchForm({ recurrenceType: 'interval' })}
                  activeOpacity={0.8}
                >
                  <View style={styles.optionCardLeft}>
                    <View style={[styles.optionEmojiCircle, formState.recurrenceType === 'interval' && styles.optionEmojiCircleActive]}>
                      <Text style={styles.optionEmoji}>🔄</Text>
                    </View>
                    <View style={styles.optionCardTextWrap}>
                      <Text style={styles.optionCardTitle}>{language === 'hi' ? 'हर N दिनों या महीनों में' : 'Every N days or months'}</Text>
                      <Text style={styles.optionCardSub}>{language === 'hi' ? 'जैसे: हर 7 दिन, हर 3 महीने' : 'e.g. Every 7 days, every 3 months'}</Text>
                    </View>
                  </View>
                  <View style={[styles.optionRadio, formState.recurrenceType === 'interval' && styles.optionRadioActive]}>
                    {formState.recurrenceType === 'interval' && <View style={styles.optionRadioInner} />}
                  </View>
                </TouchableOpacity>

                {formState.recurrenceType === 'interval' && (
                  <Card style={styles.inlineIntervalCard} mode="outlined">
                    <Card.Content>
                      <View style={styles.intervalRow}>
                        {intervalPresets(formState.category).map((n) => {
                          const active =
                            formState.interval === n &&
                            formState.intervalUnit === (formState.category === 'vehicle' || formState.category === 'education' ? 'months' : 'days');
                          const unit =
                            formState.category === 'vehicle' || (formState.category === 'education' && n >= 3)
                              ? 'months'
                              : 'days';
                          return (
                            <Card
                              key={n}
                              style={[styles.presetChip, active && styles.presetChipActive]}
                              mode="elevated"
                            >
                              <TouchableRipple
                                onPress={() => patchForm({ interval: n, intervalUnit: unit })}
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
                        value={String(formState.interval)}
                        onChangeText={(v) => {
                          patchForm({ interval: Math.max(1, parseInt(v.replace(/\D/g, ''), 10) || 1) });
                        }}
                        keyboardType="number-pad"
                      />
                      <SelectField
                        label={translate('intervalUnit')}
                        value={formState.intervalUnit}
                        options={[
                          { value: 'days' as const, label: translate('intervalDays') },
                          { value: 'months' as const, label: translate('intervalMonths') },
                        ]}
                        onChange={(intervalUnit) => patchForm({ intervalUnit })}
                      />
                    </Card.Content>
                  </Card>
                )}

                <View style={styles.navRow}>
                  <Button
                    title={language === 'hi' ? '← पीछे' : '← Back'}
                    variant="outline"
                    style={styles.navBtn}
                    onPress={() => setStep(1)}
                  />
                  <Button
                    title={language === 'hi' ? 'आगे बढ़ें →' : 'Next →'}
                    style={[styles.navBtn, styles.ctaInline]}
                    onPress={() => setStep(3)}
                  />
                </View>
              </View>
            )}

            {/* ── STEP 3: SET IT UP ── */}
            {step === 3 && formState && (
              <View>
                <View style={styles.stepIndicatorRow}>
                  <View style={[styles.stepDot, styles.stepDotActive]} />
                  <View style={[styles.stepDot, styles.stepDotActive]} />
                  <View style={[styles.stepDot, styles.stepDotActive]} />
                  <Text style={styles.stepIndicatorText}>{language === 'hi' ? 'चरण 3/3: सेट अप करें' : 'Step 3 of 3: Almost done!'}</Text>
                </View>

                <Text style={styles.serifHeading}>{language === 'hi' ? 'बस होने ही वाला है!' : 'Almost done!'}</Text>
                <Text style={styles.subText}>{language === 'hi' ? 'विवरण की पुष्टि करें और कार्य बनाएं' : 'Confirm details and create task'}</Text>

                <Card style={styles.summaryCard} mode="elevated">
                  <View style={styles.summaryCardAccent} />
                  <Card.Content style={styles.summaryCardContent}>
                    <View style={styles.summaryTitleRow}>
                      <PaperInput
                        mode="flat"
                        label={language === 'hi' ? 'कार्य का नाम' : 'Task Name'}
                        value={formState.title}
                        onChangeText={(title) => patchForm({ title })}
                        style={styles.summaryTitleInput}
                        textColor={Colors.ink}
                        activeUnderlineColor={Colors.marigoldDeep}
                        underlineColor={Colors.ivoryLine}
                        theme={{
                          colors: {
                            background: 'transparent',
                          },
                        }}
                      />
                    </View>
                    <View style={styles.summaryFreqRow}>
                      <Text style={styles.summaryFreqText}>🔁  {currentFrequencyLabel}</Text>
                    </View>
                  </Card.Content>
                </Card>

                <Text style={styles.optionalSectionTitle}>{language === 'hi' ? 'वैकल्पिक विवरण' : 'OPTIONAL DETAILS'}</Text>

                <FormField
                  label={translate('presetAmount')}
                  value={formState.amountText}
                  onChangeText={(amountText) => patchForm({ amountText })}
                  placeholder="3500"
                  keyboardType="number-pad"
                  hint={translate('presetAmountOptional')}
                  error={errors?.amount}
                />

                <TimeField
                  label={translate('reminderTime')}
                  value={formState.reminderTime}
                  onChange={(reminderTime) => patchForm({ reminderTime })}
                  hint={translate('reminderTimeHint')}
                />

                <View style={styles.shareSection}>
                  <Text style={styles.shareTitle}>{translate('shareHousehold')}</Text>
                  <View style={styles.shareChipsRow}>
                    {shared.map((s) => (
                      <Card key={s.phone} style={styles.chipCard} mode="elevated">
                        <TouchableRipple onPress={() => removeContact(s.phone)} style={styles.chipRipple} borderless>
                          <View style={styles.chipContent}>
                            <View style={[styles.chipAvatar, { backgroundColor: s.color }]}>
                              <Text style={styles.chipAvatarText}>{initials(s.name)}</Text>
                            </View>
                            <Text style={styles.chipText}>{s.name}</Text>
                            <Text style={styles.chipRemove}>×</Text>
                          </View>
                        </TouchableRipple>
                      </Card>
                    ))}
                    <Card style={styles.addChipCard} mode="elevated">
                      <TouchableRipple style={styles.addChipRipple} onPress={addContact} borderless>
                        <Text style={styles.addChipText}>{translate('addContact')}</Text>
                      </TouchableRipple>
                    </Card>
                  </View>
                </View>

                {user && user.householdMembers && user.householdMembers.length > 0 && (
                  <SelectField
                    label={language === 'hi' ? 'किसे सौंपें' : 'Assign to'}
                    value={formState.assignedTo ?? ''}
                    options={assignOptions}
                    onChange={(assignedTo) => patchForm({ assignedTo: assignedTo || null })}
                  />
                )}

                {/* Collapsible Advanced Customizer */}
                <TouchableOpacity
                  style={styles.advancedHeader}
                  onPress={() => setShowAdvanced(!showAdvanced)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.advancedTitle}>
                    ⚙️  {language === 'hi' ? 'श्रेणी और आइकन बदलें' : 'Change Category & Icon'}
                  </Text>
                  <Text style={styles.advancedChevron}>{showAdvanced ? '▴' : '▾'}</Text>
                </TouchableOpacity>

                {showAdvanced && (
                  <View style={styles.advancedContent}>
                    <Text style={styles.sectionLabel}>{translate('parseCategory')}</Text>
                    {CATEGORY_GROUPS.map((group) => (
                      <View key={group.key} style={styles.groupBlock}>
                        <Text style={styles.groupLabel}>{language === 'hi' ? group.labelHi : group.labelEn}</Text>
                        <View style={styles.catGrid}>
                          {CATEGORIES.filter((c) => c.group === group.key).map((cat) => {
                            const active = formState.category === cat.key;
                            return (
                              <Card
                                key={cat.key}
                                style={[styles.catChip, active && styles.catChipActive]}
                                mode="elevated"
                              >
                                <TouchableRipple
                                  onPress={() => handleCategoryChange(cat.key)}
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

                    <Text style={[styles.sectionLabel, { marginTop: 16 }]}>{language === 'hi' ? 'कार्य इमोजी (वैकल्पिक)' : 'Task Emoji (Optional)'}</Text>
                    <View style={styles.emojiContainer}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
                        {emojiOptions.map((emoji) => {
                          const isActive = formState.icon === emoji || (!formState.icon && emoji === defaultIcon);
                          return (
                            <TouchableRipple
                              key={emoji}
                              onPress={() => patchForm({ icon: emoji })}
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
                )}

                <View style={styles.navRow}>
                  <Button
                    title={language === 'hi' ? '← पीछे' : '← Back'}
                    variant="outline"
                    style={styles.navBtn}
                    onPress={() => setStep(2)}
                  />
                  <Button
                    title={language === 'hi' ? '✓ कार्य बनाएं' : '✓ Create Task'}
                    style={[styles.navBtn, styles.ctaInline, { backgroundColor: Colors.tealDeep }]}
                    loading={loading}
                    onPress={save}
                  />
                </View>
              </View>
            )}

          </ScrollView>
        </Card>
        <Toast message={message} />
      </KeyboardAvoidingView>

      <RecurrenceDatePicker
        visible={showDatePicker}
        value={selectedDateForRecurrence || new Date()}
        onClose={() => setShowDatePicker(false)}
        onConfirm={handleDateConfirm}
        options={recurrenceOptionsForDate}
        onSelectOption={selectRecurrencePattern as any}
        language={language}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23,27,54,0.45)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceMuted,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: '92%',
    elevation: 8,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.ivoryLine,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  body: { paddingHorizontal: 22, paddingBottom: 28 },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 12,
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.ivoryLine,
  },
  stepDotActive: {
    backgroundColor: Colors.marigoldDeep,
  },
  stepIndicatorText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.inkSoft,
    marginLeft: 8,
  },
  serifHeading: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 24,
    color: Colors.ink,
    marginBottom: 4,
  },
  subText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: Colors.inkSoft,
    marginBottom: 20,
  },
  textarea: {
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
  },
  presetLibraryCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.ivoryLine,
    borderRadius: Radius.md,
    marginBottom: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    elevation: 1,
  },
  presetLibraryCardInner: {
    padding: 16,
  },
  presetLibraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  presetIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(232, 163, 61, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetIcon: {
    fontSize: 18,
  },
  presetTextContainer: {
    flex: 1,
  },
  presetTitleText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: Colors.ink,
  },
  presetSubText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 11.5,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  presetArrow: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 20,
    color: Colors.marigold,
  },
  optionSelectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    borderRadius: Radius.md,
    padding: 16,
    marginBottom: 12,
  },
  optionSelectionCardActive: {
    borderColor: Colors.marigoldDeep,
    backgroundColor: 'rgba(232, 163, 61, 0.03)',
    borderStyle: 'dashed',
  },
  optionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionEmojiCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.ivoryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionEmojiCircleActive: {
    backgroundColor: 'rgba(232, 163, 61, 0.08)',
  },
  optionEmoji: {
    fontSize: 18,
  },
  optionCardTextWrap: {
    flex: 1,
  },
  optionCardTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14.5,
    color: Colors.ink,
  },
  optionCardSub: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 11.5,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRadioActive: {
    borderColor: Colors.marigoldDeep,
  },
  optionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.marigoldDeep,
  },
  inlineCalendarContainer: {
    backgroundColor: 'rgba(232, 163, 61, 0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(232, 163, 61, 0.35)',
    borderRadius: Radius.sm,
    padding: 14,
    marginBottom: 16,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineCalendarHeader: {
    flex: 1,
  },
  inlineCalendarTitle: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  inlineCalendarValue: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 13.5,
    color: Colors.marigoldDeep,
  },
  inlineCalendarChangeBtn: {
    backgroundColor: Colors.marigoldDeep,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
  },
  inlineCalendarChangeBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11.5,
    color: Colors.white,
  },
  inlineIntervalCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.ivoryLine,
    borderRadius: Radius.sm,
    marginBottom: 16,
    marginTop: 4,
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 12,
  },
  navBtn: {
    flex: 1,
  },
  ctaInline: {
    flex: 1.5,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    position: 'relative',
    overflow: 'hidden',
  },
  summaryCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Colors.marigoldDeep,
  },
  summaryCardContent: {
    paddingLeft: 20,
    paddingVertical: 14,
  },
  summaryTitleRow: {
    marginBottom: 6,
  },
  summaryTitleInput: {
    fontSize: 16,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.ink,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  summaryFreqRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryFreqText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.marigoldDeep,
  },
  optionalSectionTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 11.5,
    color: Colors.inkSoft,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 12,
  },
  shareSection: {
    marginBottom: 16,
  },
  shareTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  shareChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryLine,
    marginTop: 10,
    marginBottom: 8,
  },
  advancedTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.tealDeep,
  },
  advancedChevron: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.tealDeep,
  },
  advancedContent: {
    marginBottom: 16,
    paddingTop: 8,
  },
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
  emojiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
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
    backgroundColor: 'rgba(232, 163, 61, 0.08)',
  },
  emojiText: {
    fontSize: 20,
  },
  quickChipsRow: {
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  quickChip: {
    backgroundColor: Colors.ivoryDim,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    borderRadius: Radius.full,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  quickChipText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.ink,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.ivoryLine,
  },
  orDividerText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    elevation: 1,
    overflow: 'hidden',
  },
  chipRipple: {
    paddingVertical: 6,
    paddingRight: 12,
    paddingLeft: 6,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipAvatarText: { fontSize: 9.5, color: Colors.white, fontFamily: 'Manrope_800ExtraBold' },
  chipText: { ...Typography.caption, color: Colors.ink, fontFamily: 'Manrope_700Bold' },
  chipRemove: { fontSize: 16, color: Colors.inkSoft, marginLeft: 2 },
  addChipCard: {
    backgroundColor: Colors.ivoryDim,
    borderRadius: Radius.full,
    elevation: 0.5,
    overflow: 'hidden',
  },
  addChipRipple: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addChipText: { ...Typography.caption, color: Colors.ink, fontFamily: 'Manrope_700Bold' },
});
