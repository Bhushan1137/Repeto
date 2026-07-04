import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Keyboard,
  Platform,
} from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import type { CompletionStatus, Language, RepeatingTask } from '@/types';
import { getCategoryLabel } from '@/constants/categoryHelpers';
import { CATEGORY_MAP } from '@/constants/categories';
import { AccentHex, Colors, Gradients, Radius, Typography } from '@/constants/theme';
import { daysUntilDue, dayLabel, daysPercent } from '@/domain/recurrence';
import { initials } from '@/domain/insights';
import { ProgressRing } from '@/components/ProgressRing';
import { Button } from '@/components/Button';
import type { TranslationKey } from '@/i18n';

let DateTimePicker: any;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

interface TaskDetailSheetProps {
  task: RepeatingTask | null;
  visible: boolean;
  language: Language;
  translate: (key: TranslationKey) => string;
  onClose: () => void;
  onComplete: (taskId: string, note?: string) => void;
  onSnooze: (taskId: string) => void;
  onSkip: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onArchive?: (taskId: string) => void;
  onPin?: (taskId: string) => void;
  onDuplicate?: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
  onSetDueDate?: (taskId: string, date: Date) => void;
}

export function TaskDetailSheet({
  task,
  visible,
  language,
  translate,
  onClose,
  onComplete,
  onSnooze,
  onSkip,
  onDelete,
  onArchive,
  onPin,
  onDuplicate,
  onEdit,
  onSetDueDate,
}: TaskDetailSheetProps) {
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate && onSetDueDate && task) {
      onSetDueDate(task.id, selectedDate);
    }
  };

  const handleWebDateChange = (dateString: string) => {
    setShowDatePicker(false);
    if (dateString && onSetDueDate && task) {
      onSetDueDate(task.id, new Date(dateString));
    }
  };

  if (!task) return null;

  const cat = CATEGORY_MAP[task.category];
  const hex = AccentHex[cat.accent];
  const days = daysUntilDue(task.nextDueDate);
  const overdue = days < 0;

  const statusText: Record<CompletionStatus, string> = {
    on_time: translate('completedOnTime'),
    late: translate('completedLate'),
    missed: translate('missed'),
    skipped: translate('skipped'),
  };

  const handleMarkDone = () => {
    if (!noteExpanded) {
      setNoteExpanded(true);
      return;
    }
    Keyboard.dismiss();
    onComplete(task.id, noteText.trim() || undefined);
    setNoteText('');
    setNoteExpanded(false);
  };

  const handleMarkDoneDirectly = () => {
    Keyboard.dismiss();
    onComplete(task.id, noteText.trim() || undefined);
    setNoteText('');
    setNoteExpanded(false);
  };

  const historyToShow = showAllHistory ? task.history : task.history.slice(-5);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Card style={styles.sheet} mode="elevated">
        <View style={styles.handle} />

        <LinearGradient colors={[...Gradients.hero]} style={styles.heroBand}>
          <ProgressRing
            percent={daysPercent(days)}
            color={overdue ? AccentHex.clay : hex}
            size={72}
            stroke={6}
            label={dayLabel(days, language)}
          />
          <View style={styles.heroText}>
            <View style={styles.catPill}>
              <Text style={styles.catBadge}>
                {cat.icon} {getCategoryLabel(task.category, language)}
              </Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {task.title}
            </Text>
            <Text style={styles.freq}>{task.frequencyLabel}</Text>
            {task.amount ? (
              <Text style={styles.amount}>₹{task.amount.toLocaleString('en-IN')}</Text>
            ) : null}
          </View>
          <TouchableRipple style={styles.closeBtn} onPress={onClose} borderless>
            <AppIcon name="close" size={20} color={Colors.onDarkMuted} />
          </TouchableRipple>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Escalation warning */}
          {task.escalationCount >= 2 && (
            <View style={styles.escalationChip}>
              <Text style={styles.escalationEmoji}>🔥</Text>
              <Text style={styles.escalationText}>
                {language === 'hi'
                  ? `${task.escalationCount} बार लगातार मिस किया`
                  : `Missed ${task.escalationCount} times in a row`}
              </Text>
            </View>
          )}

          {/* Pinned badge */}
          {task.pinned && (
            <View style={styles.pinnedChip}>
              <AppIcon
                name={task.pinned ? 'bookmark' : 'bookmark-outline'}
                size={12}
                color={Colors.marigoldDeep}
              />
              <Text style={styles.pinnedText}>
                {language === 'hi' ? 'पिन किया गया' : 'Pinned'}
              </Text>
            </View>
          )}

          {/* Shared members */}
          {task.sharedWith.length > 0 && (
            <Card style={styles.sharedCard} mode="elevated">
              <Card.Content>
                <Text style={styles.sharedLabel}>{translate('shareHousehold')}</Text>
                <View style={styles.sharedRow}>
                  {task.sharedWith.map((s) => (
                    <View key={s.phone} style={[styles.avatar, { backgroundColor: s.color }]}>
                      <Text style={styles.avatarText}>{initials(s.name)}</Text>
                    </View>
                  ))}
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Action card */}
          <Card style={styles.actionCard} mode="elevated">
            <Card.Content style={styles.actionContent}>
              {noteExpanded ? (
                <>
                  <TextInput
                    style={styles.noteInput}
                    placeholder={
                      language === 'hi'
                        ? 'एक नोट जोड़ें (वैकल्पिक)...'
                        : 'Add a note (optional)...'
                    }
                    placeholderTextColor={Colors.inkFaint}
                    value={noteText}
                    onChangeText={setNoteText}
                    multiline
                    maxLength={200}
                    autoFocus
                  />
                  <View style={styles.noteActions}>
                    <Button
                      title={language === 'hi' ? 'छोड़ें' : 'Skip note'}
                      onPress={handleMarkDoneDirectly}
                      variant="ghost"
                      style={styles.noteSkipBtn}
                    />
                    <Button
                      title={translate('markDone')}
                      onPress={handleMarkDoneDirectly}
                      style={styles.noteConfirmBtn}
                    />
                  </View>
                </>
              ) : (
                <Button title={translate('markDone')} onPress={handleMarkDone} />
              )}

              <View style={styles.secondaryRow}>
                <ActionChip
                  icon="time-outline"
                  label={translate('snooze2d')}
                  onPress={() => onSnooze(task.id)}
                />
                <ActionChip
                  icon="create-outline"
                  label={translate('editTask')}
                  onPress={() => onEdit?.(task.id)}
                />
                <ActionChip
                  icon="play-skip-forward-outline"
                  label={translate('skipOccurrence')}
                  onPress={() => onSkip(task.id)}
                  compact
                />
              </View>
            </Card.Content>
          </Card>

          {/* Extra actions row */}
          <View style={styles.extraActionsRow}>
            <TouchableRipple
              style={styles.extraActionBtn}
              onPress={() => onPin?.(task.id)}
              borderless
            >
              <View style={styles.extraActionInner}>
                <AppIcon
                  name={task.pinned ? 'bookmark' : 'bookmark-outline'}
                  size={16}
                  color={task.pinned ? Colors.marigoldDeep : Colors.inkSoft}
                />
                <Text style={[styles.extraActionText, task.pinned && styles.extraActionActive]}>
                  {task.pinned
                    ? language === 'hi' ? 'अनपिन' : 'Unpin'
                    : language === 'hi' ? 'पिन करें' : 'Pin'}
                </Text>
              </View>
            </TouchableRipple>

            <TouchableRipple
              style={styles.extraActionBtn}
              onPress={() => onDuplicate?.(task.id)}
              borderless
            >
              <View style={styles.extraActionInner}>
                <AppIcon name="documents-outline" size={16} color={Colors.inkSoft} />
                <Text style={styles.extraActionText}>
                  {language === 'hi' ? 'डुप्लिकेट' : 'Duplicate'}
                </Text>
              </View>
            </TouchableRipple>

            <TouchableRipple
              style={styles.extraActionBtn}
              onPress={() => onArchive?.(task.id)}
              borderless
            >
              <View style={styles.extraActionInner}>
                <AppIcon name="archive-outline" size={16} color={Colors.inkSoft} />
                <Text style={styles.extraActionText}>
                  {language === 'hi' ? 'आर्काइव' : 'Archive'}
                </Text>
              </View>
            </TouchableRipple>

            <TouchableRipple
              style={styles.extraActionBtn}
              onPress={() => setShowDatePicker(true)}
              borderless
            >
              <View style={styles.extraActionInner}>
                <AppIcon name="calendar-outline" size={16} color={Colors.inkSoft} />
                <Text style={styles.extraActionText}>
                  {language === 'hi' ? 'तारीख' : 'Set Due'}
                </Text>
              </View>
            </TouchableRipple>
          </View>

          {Platform.OS === 'web' && showDatePicker && (
            <View style={styles.webDatePickerContainer}>
              <input
                type="date"
                defaultValue={task.nextDueDate.slice(0, 10)}
                onChange={(e) => handleWebDateChange(e.target.value)}
                style={{
                  fontSize: 14,
                  padding: 8,
                  borderColor: Colors.ivoryLine,
                  borderWidth: 1,
                  borderRadius: 4,
                  marginTop: 4,
                  marginBottom: 12,
                  width: '100%',
                  boxSizing: 'border-box',
                } as any}
              />
            </View>
          )}

          {Platform.OS !== 'web' && showDatePicker && DateTimePicker && (
            <DateTimePicker
              value={new Date(task.nextDueDate)}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}

          {/* History */}
          <Text style={styles.sectionLabel}>{translate('history')}</Text>
          {task.history.length === 0 ? (
            <Card style={styles.emptyHistoryCard} mode="elevated">
              <Card.Content style={styles.emptyHistoryContent}>
                <AppIcon name="calendar-outline" size={22} color={Colors.inkFaint} />
                <Text style={styles.emptyHistory}>{translate('noHistoryYet')}</Text>
              </Card.Content>
            </Card>
          ) : (
            <>
              {historyToShow.map((h, idx) => (
                <Card key={`${h.month}-${h.status}-${idx}`} style={styles.historyCard} mode="elevated">
                  <Card.Content style={styles.historyRow}>
                    <View
                      style={[
                        styles.dot,
                        h.status === 'on_time' && styles.dotOk,
                        h.status === 'late' && styles.dotLate,
                        (h.status === 'missed' || h.status === 'skipped') && styles.dotMissed,
                      ]}
                    />
                    <View style={styles.historyTextCol}>
                      <View style={styles.historyTopRow}>
                        <Text style={styles.historyMonth}>{h.month}</Text>
                        <Text style={styles.historyStatus}>{statusText[h.status]}</Text>
                      </View>
                      {h.note ? (
                        <Text style={styles.historyNote}>📝 {h.note}</Text>
                      ) : null}
                    </View>
                  </Card.Content>
                </Card>
              ))}
              {task.history.length > 5 && (
                <TouchableRipple
                  onPress={() => setShowAllHistory((v) => !v)}
                  style={styles.showMoreBtn}
                  borderless
                >
                  <Text style={styles.showMoreText}>
                    {showAllHistory
                      ? language === 'hi' ? 'कम दिखाएं' : 'Show less'
                      : `${language === 'hi' ? 'सभी' : 'View all'} ${task.history.length} ${language === 'hi' ? 'एंट्री' : 'entries'}`}
                  </Text>
                </TouchableRipple>
              )}
            </>
          )}

          {/* Delete forever */}
          <TouchableRipple style={styles.deleteBtn} onPress={() => onDelete(task.id)} borderless>
            <View style={styles.deleteBtnInner}>
              <AppIcon name="trash-outline" size={16} color={Colors.clayDeep} />
              <Text style={styles.deleteText}>{translate('deleteTask')}</Text>
            </View>
          </TouchableRipple>
        </ScrollView>
      </Card>
    </Modal>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
  compact,
}: {
  icon: AppIconName;
  label: string;
  onPress?: () => void;
  compact?: boolean;
}) {
  return (
    <Card style={styles.chipCard} mode="elevated">
      <TouchableRipple
        style={styles.chipRipple}
        onPress={onPress}
        disabled={!onPress}
        borderless
      >
        <View style={styles.chipInner}>
          <AppIcon name={icon} size={18} color={Colors.tealDeep} />
          <Text style={[styles.chipLabel, compact && styles.chipLabelCompact]} numberOfLines={2}>
            {label}
          </Text>
        </View>
      </TouchableRipple>
    </Card>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surfaceMuted,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: '92%',
    overflow: 'hidden',
    elevation: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(251,247,239,0.3)',
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 10,
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
  heroBand: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 24,
  },
  heroText: { flex: 1, paddingTop: 4 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(251,247,239,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251,247,239,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  catBadge: { ...Typography.caption, color: Colors.onDarkMuted, fontSize: 11 },
  title: { ...Typography.displaySm, color: Colors.onDark, marginBottom: 4, lineHeight: 26 },
  freq: { ...Typography.bodySm, color: Colors.onDarkMuted },
  amount: { ...Typography.title, color: Colors.marigoldLight, marginTop: 6, fontSize: 15 },
  body: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 },

  escalationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(193,80,46,0.10)',
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(193,80,46,0.18)',
  },
  escalationEmoji: { fontSize: 13 },
  escalationText: {
    ...Typography.caption,
    color: Colors.clayDeep,
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
  },

  pinnedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(232,163,61,0.12)',
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(232,163,61,0.22)',
  },
  pinnedText: {
    ...Typography.caption,
    color: Colors.marigoldDeep,
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
  },

  sharedCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 12,
    elevation: 1,
  },
  sharedLabel: { ...Typography.label, color: Colors.inkFaint, marginBottom: 8, fontSize: 10 },
  sharedRow: { flexDirection: 'row' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  avatarText: { fontSize: 10, color: Colors.white, fontFamily: 'Manrope_800ExtraBold' },

  actionCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: 12,
    elevation: 1,
    overflow: 'hidden',
  },
  actionContent: {
    padding: 16,
    gap: 12,
  },
  noteInput: {
    backgroundColor: Colors.ivory,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    padding: 12,
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: Colors.ink,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  noteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  noteSkipBtn: { flex: 1, marginVertical: 0 },
  noteConfirmBtn: { flex: 2, marginVertical: 0 },
  secondaryRow: { flexDirection: 'row', gap: 8 },
  chipCard: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    elevation: 0.5,
    overflow: 'hidden',
  },
  chipRipple: {
    paddingVertical: 12,
    paddingHorizontal: 6,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInner: {
    alignItems: 'center',
    gap: 6,
  },
  chipLabel: {
    ...Typography.caption,
    color: Colors.ink,
    textAlign: 'center',
    fontSize: 10.5,
    lineHeight: 14,
    fontFamily: 'Manrope_700Bold',
  },
  chipLabelCompact: { fontSize: 9.5 },

  extraActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  extraActionBtn: {
    width: '48%',
    flexGrow: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  webDatePickerContainer: {
    width: '100%',
    paddingHorizontal: 8,
  },
  extraActionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  extraActionText: {
    ...Typography.caption,
    color: Colors.inkSoft,
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
  },
  extraActionActive: { color: Colors.marigoldDeep },

  sectionLabel: { ...Typography.label, color: Colors.inkFaint, marginTop: 4, marginBottom: 10 },
  emptyHistoryCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    elevation: 1,
  },
  emptyHistoryContent: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyHistory: { ...Typography.bodySm, color: Colors.inkFaint, textAlign: 'center', lineHeight: 20 },
  historyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    marginBottom: 8,
    elevation: 1,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  dotOk: { backgroundColor: Colors.teal },
  dotLate: { backgroundColor: Colors.marigold },
  dotMissed: { backgroundColor: Colors.clay },
  historyTextCol: { flex: 1 },
  historyTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  historyMonth: { flex: 1, ...Typography.bodySm, color: Colors.inkSoft },
  historyStatus: { ...Typography.caption, color: Colors.inkSoft },
  historyNote: {
    ...Typography.caption,
    color: Colors.inkFaint,
    marginTop: 3,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  showMoreBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: Radius.sm,
    marginBottom: 4,
  },
  showMoreText: {
    ...Typography.caption,
    color: Colors.teal,
    fontFamily: 'Manrope_600SemiBold',
  },
  deleteBtn: {
    marginTop: 16,
    borderRadius: Radius.sm,
  },
  deleteBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  deleteText: { ...Typography.caption, color: Colors.clayDeep, fontFamily: 'Manrope_700Bold' },
});
