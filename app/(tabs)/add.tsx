import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TaskFormFields } from '@/components/TaskFormFields';
import { Button } from '@/components/Button';
import { ScreenShell } from '@/components/ScreenShell';
import { Colors, Radius, Typography } from '@/constants/theme';
import { useTasks } from '@/providers/TaskProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/providers/AuthProvider';
import { canShareWith } from '@/domain/task';
import { initials } from '@/domain/insights';
import { toSharedMember } from '@/domain/household';
import {
  defaultFormState,
  applyCategoryChange,
  formStateToValues,
  validateFormState,
  type TaskFormState,
} from '@/domain/taskForm';
import type { SharedMember } from '@/types';

export default function AddTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ household?: string }>();
  const { user } = useAuth();
  const { addTask } = useTasks();
  const { showToast } = useToast();
  const { translate, language } = useTranslation();

  const [formState, setFormState] = useState<TaskFormState>(() => defaultFormState('bills'));
  const [shared, setShared] = useState<SharedMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validateFormState>>({});

  useEffect(() => {
    if (params.household === 'true' && user?.householdMembers) {
      const activeMembers = user.householdMembers
        .filter((m) => m.status === 'active')
        .map(toSharedMember);
      setShared(activeMembers);
    }
  }, [params.household, user?.householdMembers]);

  const patchForm = (patch: Partial<TaskFormState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  };

  const handleCategoryChange = (category: TaskFormState['category']) => {
    setFormState((prev) => applyCategoryChange(prev, category));
  };

  const addContact = () => {
    const nextShared = [...shared];
    const members = user?.householdMembers ?? [];
    if (members.length === 0) {
      showToast(translate('addHouseholdFirst'));
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

  const save = async () => {
    const nextErrors = validateFormState(formState, translate);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast(translate('fixErrors' as any) || 'Please fix all errors first');
      return;
    }

    const values = formStateToValues(formState, language);

    setLoading(true);
    try {
      const ok = await addTask(
        {
          title: values.title,
          frequencyLabel: values.freq,
          recurrence: values.recurrence,
          amount: values.amount,
          category: values.category,
          reminderTime: values.reminderTime,
          startDate: values.startDate,
          assignedTo: values.assignedTo,
        },
        { finance: values.finance, shared }
      );
      if (ok) {
        showToast(translate('taskCreated'));
        setFormState(defaultFormState('bills'));
        setShared([]);
        setErrors({});
        router.push('/(tabs)');
      }
    } catch (err) {
      console.warn('[Repeato] add.tsx save failed:', err);
      showToast(translate('saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell title={translate('addTitle')} subtitle={translate('addSub')} scrollProps={{ keyboardShouldPersistTaps: 'handled' }}>
      <TaskFormFields
        language={language}
        translate={translate}
        state={formState}
        onChange={patchForm}
        onCategoryChange={handleCategoryChange}
        errors={errors}
        sharedMembers={shared}
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

      <Button
        title={
          loading
            ? (language === 'hi' ? 'सहेज रहे हैं...' : 'Saving...')
            : (language === 'hi' ? '✓ कार्य बनाएं' : '✓ Create Task')
        }
        style={{ marginTop: 24, marginBottom: 40 }}
        loading={loading}
        disabled={loading}
        onPress={save}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
  label: { ...Typography.label, color: Colors.inkSoft, marginBottom: 8, marginTop: 12 },
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
    marginBottom: 24,
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
    backgroundColor: 'rgba(232,163,61,0.08)',
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
  cta: { marginTop: 12, marginBottom: 24 },
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
