import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import type { Language, RepeatingTask } from '@/types';
import type { TranslationKey } from '@/i18n';
import { Colors, Radius } from '@/constants/theme';
import { computeDetailedSpendReport } from '@/domain/financeExplorer';
import { AppIcon } from '@/components/AppIcon';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { useTasks } from '@/providers/TaskProvider';

import { useAuth } from '@/providers/AuthProvider';
import { listHouseholds } from '@/domain/household';

interface FinanceDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  tasks: RepeatingTask[];
  language: Language;
  translate: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

export function FinanceDetailsModal({
  visible,
  onClose,
  tasks,
  language,
  translate,
}: FinanceDetailsModalProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const { user } = useAuth();
  const households = useMemo(() => listHouseholds(user ?? ({} as any)), [user]);

  const {
    completeTask,
    snoozeTask,
    skipTask,
    deleteTask,
    archiveTask,
    pinTask,
    duplicateTask,
    setTaskDueDate,
    deleteHistoryEntry,
  } = useTasks();

  const report = useMemo(() => {
    return computeDetailedSpendReport(tasks, language, scopeFilter);
  }, [tasks, language, scopeFilter]);

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>
              💳 {language === 'hi' ? 'वित्तीय विवरण एवं अनुमान' : 'Financial Spend Explorer'}
            </Text>
            <Text style={styles.headerSub}>
              {language === 'hi' ? 'मासिक बजट, भुगतान स्थिति और श्रेणी विश्लेषण' : 'Monthly forecast, paid status & category breakdown'}
            </Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <AppIcon name="close" size={20} color={Colors.ink} />
          </Pressable>
        </View>

        {/* Scope Segmented Filter Bar */}
        <View style={styles.scopeBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeScroll}>
            <Pressable
              onPress={() => setScopeFilter('all')}
              style={[styles.scopePill, scopeFilter === 'all' && styles.scopePillActive]}
            >
              <Text style={[styles.scopePillText, scopeFilter === 'all' && styles.scopePillTextActive]}>
                {language === 'hi' ? 'कुल बजट (All)' : 'All (Total Wallet)'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setScopeFilter('personal')}
              style={[styles.scopePill, scopeFilter === 'personal' && styles.scopePillActive]}
            >
              <Text style={[styles.scopePillText, scopeFilter === 'personal' && styles.scopePillTextActive]}>
                👤 {language === 'hi' ? 'व्यक्तिगत' : 'Personal'}
              </Text>
            </Pressable>
            {households.map((hh) => (
              <Pressable
                key={hh.id}
                onPress={() => setScopeFilter(hh.id)}
                style={[styles.scopePill, scopeFilter === hh.id && styles.scopePillActive]}
              >
                <Text style={[styles.scopePillText, scopeFilter === hh.id && styles.scopePillTextActive]}>
                  {hh.icon || '🏠'} {hh.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* 1. Hero Spend Summary Banner */}
          <Card style={styles.heroCard} mode="elevated">
            <View style={styles.heroContent}>
              <Text style={styles.heroTag}>
                {language === 'hi' ? 'मासिक अनुमानित खर्च' : 'PROJECTED MONTHLY SPEND'}
              </Text>
              <Text style={styles.heroAmount}>
                ₹{report.projectedSpend.toLocaleString('en-IN')}
              </Text>

              {/* Progress Gauge */}
              <View style={styles.progressBlock}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressPaidText}>
                    {language === 'hi'
                      ? `भुगतान किया गया: ₹${report.paidSoFar.toLocaleString('en-IN')}`
                      : `Paid: ₹${report.paidSoFar.toLocaleString('en-IN')}`}
                  </Text>
                  <Text style={styles.progressPercentText}>{report.percentPaid}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${report.percentPaid}%` }]} />
                </View>
                <Text style={styles.progressRemText}>
                  {language === 'hi'
                    ? `शेष देय: ₹${report.remainingDue.toLocaleString('en-IN')} (${report.pendingCount} बिल लंबित)`
                    : `Remaining due: ₹${report.remainingDue.toLocaleString('en-IN')} (${report.pendingCount} bills pending)`}
                </Text>
              </View>
            </View>
          </Card>

          {/* 2. 4-Metric Grid */}
          <View style={styles.metricsGrid}>
            <Card style={styles.metricCard} mode="elevated">
              <View style={styles.metricContent}>
                <AppIcon name="card-outline" size={16} color={Colors.tealDeep} />
                <Text style={styles.metricValue}>₹{report.projectedSpend.toLocaleString('en-IN')}</Text>
                <Text style={styles.metricLabel}>{language === 'hi' ? 'मासिक बजट' : 'Monthly Budget'}</Text>
              </View>
            </Card>

            <Card style={styles.metricCard} mode="elevated">
              <View style={styles.metricContent}>
                <AppIcon name="checkmark-circle-outline" size={16} color={Colors.tealDeep} />
                <Text style={styles.metricValue}>₹{report.paidSoFar.toLocaleString('en-IN')}</Text>
                <Text style={styles.metricLabel}>{language === 'hi' ? 'भुगतान किया' : 'Paid So Far'}</Text>
              </View>
            </Card>

            <Card style={styles.metricCard} mode="elevated">
              <View style={styles.metricContent}>
                <AppIcon name="time-outline" size={16} color={Colors.marigoldDeep} />
                <Text style={styles.metricValue}>₹{report.remainingDue.toLocaleString('en-IN')}</Text>
                <Text style={styles.metricLabel}>{language === 'hi' ? 'शेष देय' : 'Remaining'}</Text>
              </View>
            </Card>

            <Card style={styles.metricCard} mode="elevated">
              <View style={styles.metricContent}>
                <AppIcon name="calendar-outline" size={16} color="#1D4ED8" />
                <Text style={styles.metricValue}>₹{report.yearlyEstimate.toLocaleString('en-IN')}</Text>
                <Text style={styles.metricLabel}>{language === 'hi' ? 'वार्षिक अनुमान' : 'Yearly Forecast'}</Text>
              </View>
            </Card>
          </View>

          {/* 3. Category Spend Breakdown */}
          {report.categoryBreakdown.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>{language === 'hi' ? 'श्रेणी अनुसार खर्च' : 'Category Spend Breakdown'}</Text>

              {report.categoryBreakdown.map((cat) => (
                <View key={cat.key} style={styles.catRow}>
                  <View style={styles.catHeader}>
                    <View style={styles.catLeft}>
                      <Text style={styles.catEmoji}>{cat.icon}</Text>
                      <Text style={styles.catName}>{cat.label}</Text>
                    </View>
                    <Text style={styles.catAmountText}>
                      ₹{cat.paid.toLocaleString('en-IN')} / ₹{cat.projected.toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={styles.catProgressTrack}>
                    <View style={[styles.catProgressFill, { width: `${cat.percentPaid}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 4. Itemized Bill & Task Timeline List */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>
              {language === 'hi' ? `वित्तीय कार्य सूची (${report.totalFinanceTasks})` : `Financial Tasks Timeline (${report.totalFinanceTasks})`}
            </Text>

            {report.itemList.map((item, idx) => {
              const isPaid = item.status === 'paid';
              const isOverdue = item.status === 'overdue';

              return (
                <Card
                  key={`${item.task.id}-${idx}`}
                  style={[styles.itemCard, isPaid && styles.itemCardPaid]}
                  mode="elevated"
                  onPress={() => setSelectedTaskId(item.task.id)}
                >
                  <TouchableRipple
                    style={styles.itemRipple}
                    onPress={() => setSelectedTaskId(item.task.id)}
                    borderless
                  >
                    <View style={styles.itemRow}>
                      {/* Left Status Circle */}
                      <View
                        style={[
                          styles.statusDot,
                          isPaid && styles.statusDotPaid,
                          isOverdue && styles.statusDotOverdue,
                        ]}
                      >
                        <AppIcon
                          name={isPaid ? 'checkmark' : isOverdue ? 'warning-outline' : 'time-outline'}
                          size={14}
                          color={Colors.white}
                        />
                      </View>

                      {/* Content */}
                      <View style={styles.itemContent}>
                        <Text style={[styles.itemTitle, isPaid && styles.itemTitlePaid]} numberOfLines={1}>
                          {item.task.title}
                        </Text>

                        <Text style={styles.itemSubText}>
                          {isPaid
                            ? (language === 'hi' ? 'इस महीने भुगतान किया गया ✓' : 'Paid this month ✓')
                            : isOverdue
                            ? (language === 'hi' ? 'विलंबित बिल ⚠️' : 'Overdue bill ⚠️')
                            : (language === 'hi' ? `देय तिथि: ${item.dueDate.slice(0, 10)}` : `Due: ${item.dueDate.slice(0, 10)}`)}
                        </Text>
                      </View>

                      {/* Amount Badge */}
                      <View style={styles.amountBadge}>
                        <Text style={styles.amountBadgeText}>
                          ₹{item.amount.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>
                  </TouchableRipple>
                </Card>
              );
            })}
          </View>
        </ScrollView>

        {/* Task Detail Sheet */}
        {selectedTask && (
          <TaskDetailSheet
            task={selectedTask}
            visible={!!selectedTaskId}
            language={language}
            translate={translate}
            onClose={() => setSelectedTaskId(null)}
            onComplete={async (id, note, options) => {
              await completeTask(id, note, options);
              setSelectedTaskId(null);
            }}
            onSnooze={async (id, days) => {
              await snoozeTask(id, days);
              setSelectedTaskId(null);
            }}
            onSkip={async (id) => {
              await skipTask(id);
              setSelectedTaskId(null);
            }}
            onDelete={async (id) => {
              await deleteTask(id);
              setSelectedTaskId(null);
            }}
            onArchive={async (id) => {
              await archiveTask(id);
              setSelectedTaskId(null);
            }}
            onPin={async (id) => {
              await pinTask(id);
            }}
            onDuplicate={async (id) => {
              await duplicateTask(id);
              setSelectedTaskId(null);
            }}
            onSetDueDate={async (id, date) => {
              await setTaskDueDate(id, date);
            }}
            onDeleteHistoryEntry={async (id, idx) => {
              await deleteHistoryEntry(id, idx);
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: Colors.surfaceMuted },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  headerTitleCol: { flex: 1 },
  headerTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
    color: Colors.ink,
  },
  headerSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  scrollBody: {
    padding: 16,
    gap: 16,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    elevation: 3,
  },
  heroContent: {
    padding: 18,
  },
  heroTag: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 11,
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroAmount: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 32,
    color: Colors.white,
    marginBottom: 16,
  },

  progressBlock: { gap: 6 },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressPaidText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12.5,
    color: '#2DD4BF',
  },
  progressPercentText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 12,
    color: Colors.white,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2DD4BF',
    borderRadius: 4,
  },
  progressRemText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11.5,
    color: '#CBD5E1',
  },

  // 4-Metric Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 0.5,
  },
  metricContent: {
    padding: 12,
    gap: 4,
  },
  metricValue: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 16,
    color: Colors.ink,
  },
  metricLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkSoft,
  },

  // Section Blocks
  sectionBlock: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // Category Breakdown Rows
  catRow: { gap: 6 },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catEmoji: { fontSize: 16 },
  catName: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: Colors.ink,
  },
  catAmountText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.tealDeep,
  },
  catProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceMuted,
    overflow: 'hidden',
  },
  catProgressFill: {
    height: '100%',
    backgroundColor: Colors.tealDeep,
    borderRadius: 3,
  },

  // Item Cards
  itemCard: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 0.5,
    overflow: 'hidden',
  },
  itemCardPaid: {
    backgroundColor: 'rgba(62, 124, 106, 0.05)',
    borderColor: 'rgba(62, 124, 106, 0.2)',
  },
  itemRipple: { padding: 12 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotPaid: { backgroundColor: Colors.tealDeep },
  statusDotOverdue: { backgroundColor: Colors.clay },

  itemContent: { flex: 1, gap: 2 },
  itemTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.ink,
  },
  itemTitlePaid: {
    textDecorationLine: 'line-through',
    color: Colors.inkSoft,
  },
  itemSubText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkSoft,
  },

  amountBadge: {
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  amountBadgeText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 13,
    color: Colors.marigoldDeep,
  },

  // Scope Bar Styles
  scopeBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
    backgroundColor: Colors.surfaceMuted,
  },
  scopeScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  scopePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  scopePillActive: {
    backgroundColor: Colors.marigoldDeep,
    borderColor: Colors.marigoldDeep,
  },
  scopePillText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: Colors.inkSoft,
  },
  scopePillTextActive: {
    color: Colors.white,
    fontFamily: 'Manrope_700Bold',
  },
});
