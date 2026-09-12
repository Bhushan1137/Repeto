import React from 'react';
import { View, StyleSheet, ScrollView, Modal, Pressable, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import type { Language, RecurrenceType } from '@/types';
import type { TaskFormState } from '@/domain/taskForm';
import { FormField } from '@/components/FormField';
import { SelectField } from '@/components/SelectField';
import { Colors, Radius } from '@/constants/theme';

interface RecurrencePickerModalProps {
  visible: boolean;
  onClose: () => void;
  state: TaskFormState;
  onChange: (patch: Partial<TaskFormState>) => void;
  allowed: RecurrenceType[];
  language: Language;
  translate: (key: any, params?: Record<string, string | number>) => string;
  dateNum: number;
  weekdayIndex: number;
  weekdayNameStr: string;
  monthNameStr: string;
  nth: number;
  nthStr: string;
}

function formatOrdinalDay(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export function RecurrencePickerModal({
  visible,
  onClose,
  state,
  onChange,
  allowed,
  language,
  translate,
  dateNum,
  weekdayIndex,
  weekdayNameStr,
  monthNameStr,
  nth,
  nthStr,
}: RecurrencePickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalKeyboardAvoiding}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.modalTitle}>{translate('howDoesItRepeat')}</Text>
          <Text style={styles.modalSub}>{translate('howDoesItRepeatSub')}</Text>

          {/* Daily Option */}
          {allowed.includes('daily') && (
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => {
                onChange({ recurrenceType: 'daily' });
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.radioCircle,
                  state.recurrenceType === 'daily' && styles.radioCircleActive,
                ]}
              >
                {state.recurrenceType === 'daily' && (
                  <View style={styles.radioInnerCircle} />
                )}
              </View>
              <View style={styles.radioText}>
                <Text style={styles.radioOptionTitle}>
                  {language === 'hi' ? 'हर दिन' : 'Every day'}
                </Text>
                <Text style={styles.radioOptionSub}>
                  {language === 'hi' ? 'प्रतिदिन पुनरावृत्ति' : 'Repeats every day'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Weekly Option */}
          {allowed.includes('weekly') && (
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => {
                onChange({ recurrenceType: 'weekly', weekday: weekdayIndex });
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.radioCircle,
                  state.recurrenceType === 'weekly' && styles.radioCircleActive,
                ]}
              >
                {state.recurrenceType === 'weekly' && (
                  <View style={styles.radioInnerCircle} />
                )}
              </View>
              <View style={styles.radioText}>
                <Text style={styles.radioOptionTitle}>
                  {language === 'hi' ? 'हर हफ्ते' : 'Every week'}
                </Text>
                <Text style={styles.radioOptionSub}>
                  {language === 'hi'
                    ? `${weekdayNameStr} को दोहराता है`
                    : `Repeats every week on ${weekdayNameStr}`}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Monthly / MonthDay / NthWeekday Options */}
          {(allowed.includes('monthDay') ||
            allowed.includes('monthly') ||
            allowed.includes('nthWeekday')) && (
            <View style={styles.monthlyBlock}>
              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => {
                  onChange({ recurrenceType: 'monthDay', dayOfMonth: dateNum });
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.radioCircle,
                    state.recurrenceType === 'monthDay' && styles.radioCircleActive,
                  ]}
                >
                  {state.recurrenceType === 'monthDay' && (
                    <View style={styles.radioInnerCircle} />
                  )}
                </View>
                <View style={styles.radioText}>
                  <Text style={styles.radioOptionTitle}>
                    {language === 'hi' ? 'हर महीने' : 'Every month'}
                  </Text>
                  <Text style={styles.radioOptionSub}>
                    {language === 'hi'
                      ? `हर महीने की ${dateNum} तारीख को`
                      : `Repeats every month on the ${formatOrdinalDay(dateNum)}`}
                  </Text>
                </View>
              </TouchableOpacity>

              {allowed.includes('nthWeekday') && (
                <TouchableOpacity
                  style={[styles.radioOption, styles.radioOptionNested]}
                  onPress={() => {
                    onChange({
                      recurrenceType: 'nthWeekday',
                      nthWeekday: nth,
                      weekday: weekdayIndex,
                    });
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      state.recurrenceType === 'nthWeekday' &&
                        styles.radioCircleActive,
                    ]}
                  >
                    {state.recurrenceType === 'nthWeekday' && (
                      <View style={styles.radioInnerCircle} />
                    )}
                  </View>
                  <View style={styles.radioText}>
                    <Text style={styles.radioOptionTitle}>
                      {language === 'hi'
                        ? `हर महीने का ${nthStr} ${weekdayNameStr}`
                        : `Every ${nthStr} ${weekdayNameStr}`}
                    </Text>
                    <Text style={styles.radioOptionSub}>
                      {language === 'hi'
                        ? 'दिन के स्थान के आधार पर'
                        : 'Repeats based on day position'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Yearly Option */}
          {allowed.includes('yearly') && (
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => {
                onChange({ recurrenceType: 'yearly' });
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.radioCircle,
                  state.recurrenceType === 'yearly' && styles.radioCircleActive,
                ]}
              >
                {state.recurrenceType === 'yearly' && (
                  <View style={styles.radioInnerCircle} />
                )}
              </View>
              <View style={styles.radioText}>
                <Text style={styles.radioOptionTitle}>
                  {language === 'hi' ? 'हर साल' : 'Every year'}
                </Text>
                <Text style={styles.radioOptionSub}>
                  {language === 'hi'
                    ? `${dateNum} ${monthNameStr} को हर साल`
                    : `Repeats every year on ${monthNameStr} ${dateNum}`}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Custom Interval Option */}
          {allowed.includes('interval') && (
            <View style={styles.customBlock}>
              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => onChange({ recurrenceType: 'interval' })}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.radioCircle,
                    state.recurrenceType === 'interval' &&
                      styles.radioCircleActive,
                  ]}
                >
                  {state.recurrenceType === 'interval' && (
                    <View style={styles.radioInnerCircle} />
                  )}
                </View>
                <View style={styles.radioText}>
                  <Text style={styles.radioOptionTitle}>
                    {language === 'hi' ? 'कस्टम अंतराल' : 'Custom interval'}
                  </Text>
                  <Text style={styles.radioOptionSub}>
                    {language === 'hi'
                      ? 'हर कुछ दिन या महीने'
                      : 'Set a custom repeat pattern'}
                  </Text>
                </View>
              </TouchableOpacity>

              {state.recurrenceType === 'interval' && (
                <View style={styles.customFields}>
                  <FormField
                    label={translate('customInterval')}
                    value={String(state.interval)}
                    onChangeText={(v) => {
                      onChange({
                        recurrenceType: 'interval',
                        interval: Math.max(
                          1,
                          parseInt(v.replace(/\D/g, ''), 10) || 1
                        ),
                      });
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
                    onChange={(intervalUnit) =>
                      onChange({ recurrenceType: 'interval', intervalUnit })
                    }
                  />
                  <TouchableOpacity
                    style={styles.doneIntervalBtn}
                    onPress={onClose}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.doneIntervalBtnText}>
                      {language === 'hi' ? 'हो गया ✓' : 'Done ✓'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalKeyboardAvoiding: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  modalSheet: {
    maxHeight: '85%',
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: 12,
    elevation: 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.ivoryLine,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: Colors.ink,
  },
  modalSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.inkSoft,
    marginTop: 2,
    marginBottom: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    marginBottom: 4,
  },
  radioOptionNested: {
    marginLeft: 24,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.ivoryLine,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioCircleActive: {
    borderColor: Colors.tealDeep,
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.tealDeep,
  },
  radioText: {
    flex: 1,
  },
  radioOptionTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: Colors.ink,
  },
  radioOptionSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: Colors.inkSoft,
    marginTop: 1,
  },
  monthlyBlock: {
    marginVertical: 2,
  },
  customBlock: {
    marginTop: 4,
  },
  customFields: {
    marginLeft: 34,
    marginTop: 8,
    gap: 12,
  },
  doneIntervalBtn: {
    backgroundColor: Colors.tealDeep,
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  doneIntervalBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13.5,
    color: Colors.white,
  },
});
