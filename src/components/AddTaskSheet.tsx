import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, Card, TextInput as PaperInput, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTasks } from '@/providers/TaskProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useTaskParser } from '@/hooks/useTaskParser';
import { Button } from '@/components/Button';
import { SettingRow } from '@/components/SettingRow';
import { TaskFormFields } from '@/components/TaskFormFields';
import { AppIcon } from '@/components/AppIcon';
import { AccentHex, Colors, Radius, Typography, Shadows } from '@/constants/theme';
import { CATEGORY_MAP } from '@/constants/categories';
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
  type TaskFormState,
} from '@/domain/taskForm';
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
  
  const [text, setText] = useState('');
  const [formState, setFormState] = useState<TaskFormState | null>(null);
  const [finance, setFinance] = useState(false);
  const [shared, setShared] = useState<SharedMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validateFormState>>({});
  const lastParsedText = useRef('');

  const parsed = useTaskParser(text);

  // Reset fields when sheet opens/closes
  useEffect(() => {
    if (!visible) {
      setText('');
      setFormState(null);
      setFinance(false);
      setShared([]);
      setErrors({});
      lastParsedText.current = '';
    }
  }, [visible]);

  useEffect(() => {
    if (!text.trim()) {
      setFormState(null);
      lastParsedText.current = '';
      return;
    }
    if (!parsed || text === lastParsedText.current) return;

    lastParsedText.current = text;
    const next = formStateFromParsed(parsed);
    setFormState(next);
    if (parsed.amount) setFinance(true);
    setErrors({});
  }, [text, parsed]);

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

  const save = async () => {
    if (!text.trim()) {
      showToast(translate('typeFirst'));
      return;
    }
    if (!formState) return;

    const nextErrors = validateFormState(formState, translate);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

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
      { finance: finance || values.finance || !!values.amount, shared }
    );
    setLoading(false);
    if (ok) {
      showToast(translate('taskCreated'));
      onClose();
    }
  };

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
            <Text style={styles.heading}>{translate('addTitle')}</Text>

            <Text style={styles.label}>{translate('describeTask')}</Text>
            <PaperInput
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="e.g. Pay maid's salary every 1st of month, ₹3500"
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

            {parsed ? (
              <View style={styles.parsedTagsRow}>
                <Text style={styles.parsedTagsLabel}>{translate('parseReviewHeading')}:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.parsedTagsContent}>
                  <View style={[styles.tag, { backgroundColor: `${AccentHex[CATEGORY_MAP[parsed.category].accent]}15`, borderColor: AccentHex[CATEGORY_MAP[parsed.category].accent] }]}>
                    <Text style={styles.tagText}>{CATEGORY_MAP[parsed.category].icon} {getCategoryLabel(parsed.category, language)}</Text>
                  </View>
                  <View style={[styles.tag, styles.neutralTag]}>
                    <Text style={styles.tagText}>📅 {parsed.frequencyLabel}</Text>
                  </View>
                  {parsed.amount ? (
                    <View style={[styles.tag, styles.financeTag]}>
                      <Text style={styles.tagText}>💰 ₹{parsed.amount.toLocaleString('en-IN')}</Text>
                    </View>
                  ) : null}
                  {parsed.reminderTime ? (
                    <View style={[styles.tag, styles.timeTag]}>
                      <Text style={styles.tagText}>⏱ {parsed.reminderTime}</Text>
                    </View>
                  ) : null}
                </ScrollView>
              </View>
            ) : null}

            {formState ? (
              <Card style={styles.preview} mode="elevated">
                <Card.Content>
                  <Text style={styles.previewHeading}>{translate('parseReviewHeading')}</Text>
                  <Text style={styles.previewSub}>{translate('parseReviewSub')}</Text>
                  <TaskFormFields
                    language={language}
                    translate={translate}
                    state={formState}
                    onChange={patchForm}
                    onCategoryChange={handleCategoryChange}
                    errors={errors}
                  />
                </Card.Content>
              </Card>
            ) : (
              <Card style={styles.emptyCard} mode="elevated">
                <Card.Content style={styles.empty}>
                  <Text style={styles.emptyIcon}>✍️</Text>
                  <Text style={styles.emptyText}>{translate('emptyParse')}</Text>
                </Card.Content>
              </Card>
            )}

            <SettingRow label={translate('tagFinance')} sub={translate('tagFinanceSub')} value={finance} onValueChange={setFinance} />

            <Text style={styles.label}>{translate('shareHousehold')}</Text>
            <View style={styles.chips}>
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

            <Button
              title={translate('createTask')}
              loading={loading}
              onPress={save}
              disabled={!formState}
              style={{ marginTop: 16 }}
            />
            <Button
              title={translate('browsePresets')}
              variant="outline"
              style={{ marginTop: 10 }}
              onPress={() => {
                onClose();
                router.push('/presets');
              }}
            />
            <Button
              title={translate('backBtn')}
              variant="ghost"
              style={{ marginTop: 10, marginBottom: 24 }}
              onPress={onClose}
            />
          </ScrollView>
        </Card>
        <Toast message={message} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23,27,54,0.45)'
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
  heading: { fontFamily: 'Fraunces_700Bold', fontSize: 20, color: Colors.ink, marginBottom: 12 },
  label: { ...Typography.label, color: Colors.inkSoft, marginBottom: 8, marginTop: 12 },
  textarea: {
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
  },
  preview: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginVertical: 16,
    elevation: 1.5,
  },
  previewHeading: { ...Typography.title, fontSize: 14, color: Colors.ink, marginBottom: 4 },
  previewSub: { ...Typography.bodySm, color: Colors.inkSoft, marginBottom: 12, lineHeight: 18 },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginVertical: 16,
    elevation: 1,
  },
  empty: { alignItems: 'center', paddingVertical: 24 },
  emptyIcon: { fontSize: 36, marginBottom: 10, textAlign: 'center' },
  emptyText: { ...Typography.bodySm, color: Colors.inkFaint, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, marginTop: 6 },
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
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  parsedTagsRow: {
    marginTop: 14,
    marginBottom: 6,
  },
  parsedTagsLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    fontFamily: 'Manrope_700Bold',
  },
  parsedTagsContent: {
    gap: 8,
    paddingVertical: 4,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 6,
  },
  tagText: {
    ...Typography.caption,
    color: Colors.ink,
    fontSize: 11.5,
    fontFamily: 'Manrope_700Bold',
  },
  neutralTag: {
    backgroundColor: 'rgba(27,31,59,0.06)',
    borderColor: Colors.ivoryLine,
  },
  financeTag: {
    backgroundColor: 'rgba(62,124,106,0.08)',
    borderColor: Colors.tealLight,
  },
  timeTag: {
    backgroundColor: 'rgba(232,163,61,0.08)',
    borderColor: Colors.marigold,
  },
});
