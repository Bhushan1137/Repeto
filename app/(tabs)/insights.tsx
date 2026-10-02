import React, { useState, useMemo, useEffect } from 'react';
import type { HouseholdMemberProfile, RepeatingTask } from '@/types';
import { View, StyleSheet, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTasks } from '@/providers/TaskProvider';
import { useAuth } from '@/providers/AppProviders';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useInsights,
  useHousehold,
  useUpcomingStrip,
  useSpendForecast,
  useMonthTrend,
  useConsistencyMatrix,
  useWeeklyVelocity,
} from '@/hooks/useInsights';
import { filterTasksByScope } from '@/domain/insights';
import { listHouseholds, getHouseholdDisplayName } from '@/domain/household';
import { computeDetailedSpendReport } from '@/domain/financeExplorer';
import { ProgressRing } from '@/components/ProgressRing';
import { ScreenShell, SectionHeader, EmptyState } from '@/components/ScreenShell';
import { DailyHealthCard } from '@/components/DailyHealthCard';
import { UpcomingStrip } from '@/components/UpcomingStrip';
import { formatIndian } from '@/components/SpendForecastCard';
import { InsightSegmentBar, type InsightSegment } from '@/components/insights/InsightSegmentBar';
import { CategoryReliabilityGrid } from '@/components/insights/CategoryReliabilityGrid';
import { HabitConsistencyHeatmap } from '@/components/insights/HabitConsistencyHeatmap';
import { TaskReportModal } from '@/components/TaskReportModal';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { AppIcon } from '@/components/AppIcon';
import { Colors, Radius } from '@/constants/theme';
import { getCategoryLabel } from '@/constants/categoryHelpers';
import { CATEGORY_MAP } from '@/constants/categories';
import { getCategoryDef } from '@/constants/categoryHelpers';

const EMPTY_TASKS: RepeatingTask[] = [];

export default function InsightsScreen() {
  const router = useRouter();
  const {
    tasks,
    completeTask,
    snoozeTask,
    skipTask,
    deleteTask,
    refreshTasks,
  } = useTasks();
  const { user } = useAuth();
  const { translate, language } = useTranslation();
  const isHi = language === 'hi';

  // Scope & Segment state
  const [activeScope, setActiveScope] = useState<string>('all');
  const [activeSegment, setActiveSegment] = useState<InsightSegment>('overview');
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Households for scope switching
  const households = useMemo(() => listHouseholds(user ?? ({} as any)), [user]);
  const validHouseholdIds = useMemo(
    () => new Set(households.map((hh) => hh.id)),
    [households]
  );

  // Fallback to 'all' if selected household scope no longer exists
  useEffect(() => {
    if (
      activeScope !== 'all' &&
      activeScope !== 'personal' &&
      !validHouseholdIds.has(activeScope)
    ) {
      setActiveScope('all');
    }
  }, [activeScope, validHouseholdIds]);

  // Scoped tasks strictly filtered by activeScope
  const scopedTasks = useMemo(
    () => filterTasksByScope(tasks, activeScope, validHouseholdIds),
    [tasks, activeScope, validHouseholdIds]
  );

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  // Context household members based on activeScope filter
  const contextHouseholdMembers = useMemo(() => {
    if (activeScope === 'personal') return [];
    if (activeScope === 'all') {
      const memberMap = new Map<string, HouseholdMemberProfile>();
      households.forEach((hh) => {
        (hh.members ?? []).forEach((m) => {
          const key = m.userId || m.code || m.name;
          if (!memberMap.has(key)) {
            memberMap.set(key, m);
          }
        });
      });
      return Array.from(memberMap.values());
    }
    const matched = households.find((h) => h.id === activeScope);
    return matched?.members ?? [];
  }, [activeScope, households]);

  const habitsTasks = activeSegment === 'habits' ? scopedTasks : EMPTY_TASKS;
  const financeTasks = activeSegment === 'finances' ? scopedTasks : EMPTY_TASKS;

  // Insights derived from scoped tasks
  const insights = useInsights(scopedTasks);
  const { members } = useHousehold(scopedTasks, contextHouseholdMembers);
  const upcomingSlots = useUpcomingStrip(scopedTasks);
  const forecast = useSpendForecast(financeTasks);
  const trend = useMonthTrend(scopedTasks);
  const consistencyMatrix = useConsistencyMatrix(habitsTasks);
  const weeklyVelocity = useWeeklyVelocity(habitsTasks);

  // Native Detailed Financial Report - only computed when finances tab is active
  const financialReport = useMemo(() => {
    if (activeSegment !== 'finances') {
      return {
        totalFinanceTasks: 0,
        projectedSpend: 0,
        paidSoFar: 0,
        percentPaid: 0,
        remainingDue: 0,
        pendingCount: 0,
        yearlyEstimate: 0,
        categoryBreakdown: [],
        itemList: [],
      };
    }
    return computeDetailedSpendReport(scopedTasks, language, 'all');
  }, [activeSegment, scopedTasks, language]);

  const slipLabel = insights.slipCategory
    ? getCategoryLabel(insights.slipCategory, language)
    : null;

  // Gate leaderboard — only show when at least 1 active non-you member exists
  const hasActiveHouseholdMembers =
    members.filter((m) => !m.isYou && m.status === 'active').length >= 1;

  // Month trend text
  function getTrendText(): string | null {
    if (trend.direction === 'insufficient_data') return null;
    if (trend.direction === 'same') return isHi ? 'पिछले महीने जैसा' : 'Similar to last month';
    const arrow = trend.direction === 'up' ? '↑' : '↓';
    return trend.direction === 'up'
      ? isHi
        ? `${arrow} ${trend.lastMonthLabel} से ${trend.delta}% बेहतर`
        : `${arrow} ${trend.delta}% better than ${trend.lastMonthLabel}`
      : isHi
      ? `${arrow} ${trend.lastMonthLabel} से ${trend.delta}% कम`
      : `${arrow} ${trend.delta}% lower than ${trend.lastMonthLabel}`;
  }

  const trendText = getTrendText();
  const trendIsUp = trend.direction === 'up';
  const trendIsDown = trend.direction === 'down';

  // Scope options
  const scopeOptions = useMemo(() => {
    const opts = [
      {
        id: 'all',
        label: isHi ? 'सभी कार्य' : 'All Tasks',
        icon: '📋',
        count: tasks.length,
      },
      {
        id: 'personal',
        label: isHi ? 'व्यक्तिगत' : 'Personal',
        icon: '👤',
        count: tasks.filter(
          (t) => !t.householdId || !validHouseholdIds.has(t.householdId)
        ).length,
      },
    ];

    households.forEach((hh) => {
      const count = tasks.filter((t) => t.householdId === hh.id).length;
      const name = getHouseholdDisplayName(hh, user?.id, households);
      opts.push({
        id: hh.id,
        label: name,
        icon: hh.icon || '🏠',
        count,
      });
    });

    return opts;
  }, [tasks, households, isHi, user?.id, validHouseholdIds]);

  return (
    <ScreenShell
      title={translate('insTitle')}
      subtitle={translate('insSub')}
      onRefresh={refreshTasks}
    >
      {/* ── 1. Top Scope Filter Pills (if user has households) ── */}
      {households.length > 0 && (
        <View style={styles.scopeWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scopeRow}
          >
            {scopeOptions.map((opt) => {
              const isActive = activeScope === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setActiveScope(opt.id)}
                  style={[styles.scopePill, isActive && styles.scopePillActive]}
                  activeOpacity={0.75}
                >
                  <Text style={styles.scopeIcon}>{opt.icon}</Text>
                  <Text
                    style={[styles.scopeLabel, isActive && styles.scopeLabelActive]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  <View
                    style={[
                      styles.scopeCountBadge,
                      isActive && styles.scopeCountBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.scopeCountText,
                        isActive && styles.scopeCountTextActive,
                      ]}
                    >
                      {opt.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── 2. Segmented 3-Tab Bar (Overview, Finances, Habits) ── */}
      <InsightSegmentBar
        activeSegment={activeSegment}
        onChangeSegment={setActiveSegment}
        language={language}
      />

      {scopedTasks.length === 0 ? (
        <EmptyState
          icon="◔"
          title={isHi ? 'इस संदर्भ में कोई कार्य नहीं है' : 'No tasks in this scope'}
          subtitle={
            isHi
              ? 'कार्य जोड़ें या दूसरा फ़िल्टर चुनें।'
              : 'Add tasks or switch filter to see insights.'
          }
        />
      ) : (
        <>
          {/* ═══════════════════════════════════════════════════════════ */}
          {/* TAB 1: OVERVIEW                                             */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeSegment === 'overview' && (
            <View style={styles.tabContent}>
              {/* Overall Daily Health Hero Card */}
              <DailyHealthCard
                percent={insights.overallPercent}
                overdueCount={insights.overdueCount}
                status={insights.healthStatus}
                language={language}
              />

              {/* Task Report & Deep-Dive Explorer Entry Banner */}
              <Pressable onPress={() => setReportOpen(true)} style={styles.allTasksCard}>
                <LinearGradient
                  colors={[Colors.indigo950, Colors.indigo900]}
                  style={styles.allTasksInner}
                >
                  <View style={styles.allTasksIconBadge}>
                    <Text style={styles.allTasksIconEmoji}>📋</Text>
                  </View>
                  <View style={styles.allTasksMid}>
                    <Text style={styles.allTasksTitle}>
                      {isHi ? 'कार्य रिपोर्ट एवं इतिहास' : 'Task Report & History'}
                    </Text>
                    <Text style={styles.allTasksSub}>
                      {isHi
                        ? `${scopedTasks.length} कार्यों का विस्तृत विश्लेषण`
                        : `Explore detailed history & metrics for ${scopedTasks.length} tasks`}
                    </Text>
                  </View>
                  <View style={styles.allTasksRightBtn}>
                    <Text style={styles.allTasksHint}>
                      {isHi ? 'खोलें' : 'Open'}
                    </Text>
                    <AppIcon name="chevron-forward" size={14} color="#FFF" />
                  </View>
                </LinearGradient>
              </Pressable>

              {/* Category Slip Callout Card (if slipping) */}
              {slipLabel && insights.slipCategory && insights.bars.length > 1 && (
                <Card style={styles.calloutCard} mode="outlined">
                  <Card.Content style={styles.calloutContent}>
                    <View style={styles.calloutHeaderRow}>
                      <View style={styles.calloutIconBadge}>
                        <AppIcon name="warning-outline" size={18} color={Colors.clayDeep} />
                      </View>
                      <View style={styles.calloutTextMid}>
                        <Text style={styles.calloutTitle}>
                          {translate('categorySlipCallout', { category: slipLabel })}
                        </Text>
                        <Text style={styles.calloutBody}>{translate('categorySlipBody')}</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => router.push('/(tabs)')}
                      style={styles.fixItBtn}
                    >
                      <Text style={styles.fixItText}>
                        {isHi ? `${slipLabel} कार्य देखें →` : `Fix ${slipLabel} tasks →`}
                      </Text>
                    </Pressable>
                  </Card.Content>
                </Card>
              )}

              {/* Performance Overview & Accuracy */}
              <SectionHeader label={isHi ? 'प्रदर्शन एवं सारांश' : 'Performance Overview'} />

              {/* Month Trend Badge if available */}
              {trendText && (
                <Card
                  style={[
                    styles.trendCard,
                    trendIsUp && styles.trendCardUp,
                    trendIsDown && styles.trendCardDown,
                  ]}
                  mode="outlined"
                >
                  <Card.Content style={styles.trendContent}>
                    <AppIcon
                      name={(trendIsUp ? 'trending-up-outline' : 'trending-down-outline') as any}
                      size={18}
                      color={trendIsUp ? '#16A34A' : Colors.clay}
                    />
                    <Text
                      style={[
                        styles.trendText,
                        trendIsUp && { color: '#16A34A' },
                        trendIsDown && { color: Colors.clay },
                      ]}
                    >
                      {trendText}
                    </Text>
                  </Card.Content>
                </Card>
              )}

              {/* Side-by-Side Ring & Metric Grid */}
              <View style={styles.gridRow}>
                {/* Progress Ring Card */}
                <Card style={styles.ringCard} mode="elevated">
                  <Card.Content style={styles.ringContent}>
                    <View style={styles.ringContainer}>
                      <ProgressRing
                        percent={insights.overallPercent}
                        color={Colors.marigold}
                        size={106}
                        stroke={9}
                        animated
                      />
                      <View style={styles.ringTextCenter}>
                        <Text style={styles.ringPctText}>{insights.overallPercent}%</Text>
                      </View>
                    </View>
                    <Text style={styles.cap}>{translate('onTimeThisMonth')}</Text>
                  </Card.Content>
                </Card>

                {/* Task Summary Metrics Card with transparent on-time breakdown */}
                <Card style={styles.metricsCard} mode="elevated">
                  <Card.Content style={styles.metricsContent}>
                    <Text style={styles.metricsHeader}>
                      {isHi ? 'कार्य सारांश' : 'Task Summary'}
                    </Text>
                    <View style={styles.metricsRow}>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricValue}>{insights.activeTasksCount}</Text>
                        <Text style={styles.metricLabel}>{isHi ? 'सक्रिय' : 'Active'}</Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text style={[styles.metricValue, { color: '#16A34A' }]}>
                          {insights.completionsCount}
                        </Text>
                        <Text style={styles.metricLabel}>
                          {isHi ? 'पूर्ण' : 'Done'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.metricsRow, { marginTop: 10 }]}>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricValue}>{insights.skippedCount}</Text>
                        <Text style={styles.metricLabel}>{isHi ? 'छोड़े' : 'Skipped'}</Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text style={[styles.metricValue, { color: Colors.tealDeep }]}>
                          {insights.overallPercent}%
                        </Text>
                        <Text style={styles.metricLabel}>{isHi ? 'समय पर दर' : 'On-Time Rate'}</Text>
                      </View>
                    </View>
                    {/* On-Time Clarity Pill */}
                    {insights.completionsCount > 0 && (
                      <View style={styles.onTimeClarityPill}>
                        <Text style={styles.onTimeClarityText}>
                          {isHi
                            ? `${insights.onTimeCount} समय पर · ${insights.lateCount} देर से`
                            : `${insights.onTimeCount} on-time · ${insights.lateCount} late`}
                        </Text>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              </View>

              {/* Category Performance Breakdown Grid */}
              {insights.bars.length > 0 && (
                <>
                  <SectionHeader label={translate('byCategory')} />
                  <CategoryReliabilityGrid bars={insights.bars} language={language} />
                </>
              )}

              {/* 14-Day Lookahead Upcoming Strip */}
              <SectionHeader
                label={isHi ? 'आने वाले कार्य (14 दिन)' : 'Coming Up (14 Days)'}
                count={upcomingSlots.reduce((sum, s) => sum + s.tasks.length, 0)}
              />
              <UpcomingStrip
                slots={upcomingSlots}
                language={language}
                onTaskPress={() => router.push('/(tabs)')}
              />
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* TAB 2: FINANCES (Full Native Financial Dashboard)           */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeSegment === 'finances' && (
            <View style={styles.tabContent}>
              {financialReport.totalFinanceTasks === 0 ? (
                <EmptyState
                  icon="💰"
                  title={isHi ? 'कोई वित्तीय कार्य नहीं' : 'No finance tasks yet'}
                  subtitle={
                    isHi
                      ? 'राशि के साथ कार्य जोड़ें और यहाँ स्वचालित मासिक बजट पूर्वानुमान देखें।'
                      : 'Add recurring tasks with an amount to track your monthly budget and expenses here.'
                  }
                />
              ) : (
                <>
                  {/* 1. Hero Projected Spend Gauge Card */}
                  <Card style={styles.financeHeroCard} mode="elevated">
                    <Card.Content style={styles.financeHeroContent}>
                      <Text style={styles.financeHeroTag}>
                        {isHi ? 'मासिक अनुमानित खर्च' : 'PROJECTED MONTHLY SPEND'}
                      </Text>
                      <Text style={styles.financeHeroAmount}>
                        ₹{financialReport.projectedSpend.toLocaleString('en-IN')}
                      </Text>

                      {/* Progress Gauge */}
                      <View style={styles.financeProgressBlock}>
                        <View style={styles.financeProgressLabelRow}>
                          <Text style={styles.financeProgressPaidText}>
                            {isHi
                              ? `भुगतान किया: ₹${financialReport.paidSoFar.toLocaleString('en-IN')}`
                              : `Paid: ₹${financialReport.paidSoFar.toLocaleString('en-IN')}`}
                          </Text>
                          <Text style={styles.financeProgressPercentText}>
                            {financialReport.percentPaid}%
                          </Text>
                        </View>
                        <View style={styles.financeProgressTrack}>
                          <View
                            style={[
                              styles.financeProgressFill,
                              { width: `${Math.min(100, financialReport.percentPaid)}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.financeProgressRemText}>
                          {isHi
                            ? `शेष देय: ₹${financialReport.remainingDue.toLocaleString('en-IN')} (${financialReport.pendingCount} बिल लंबित)`
                            : `Remaining due: ₹${financialReport.remainingDue.toLocaleString('en-IN')} (${financialReport.pendingCount} bills pending)`}
                        </Text>
                      </View>
                    </Card.Content>
                  </Card>

                  {/* 2. 4-Metric Financial Grid */}
                  <View style={styles.financeMetricsGrid}>
                    <Card style={styles.financeMetricCard} mode="elevated">
                      <View style={styles.financeMetricContent}>
                        <AppIcon name="bookmark-outline" size={16} color={Colors.tealDeep} />
                        <Text style={styles.financeMetricValue}>
                          ₹{financialReport.projectedSpend.toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.financeMetricLabel}>
                          {isHi ? 'मासिक बजट' : 'Monthly Budget'}
                        </Text>
                      </View>
                    </Card>

                    <Card style={styles.financeMetricCard} mode="elevated">
                      <View style={styles.financeMetricContent}>
                        <AppIcon name="checkmark-circle-outline" size={16} color="#16A34A" />
                        <Text style={[styles.financeMetricValue, { color: '#16A34A' }]}>
                          ₹{financialReport.paidSoFar.toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.financeMetricLabel}>
                          {isHi ? 'भुगतान किया' : 'Paid So Far'}
                        </Text>
                      </View>
                    </Card>

                    <Card style={styles.financeMetricCard} mode="elevated">
                      <View style={styles.financeMetricContent}>
                        <AppIcon name="time-outline" size={16} color={Colors.marigoldDeep} />
                        <Text style={[styles.financeMetricValue, { color: Colors.marigoldDeep }]}>
                          ₹{financialReport.remainingDue.toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.financeMetricLabel}>
                          {isHi ? 'शेष देय' : 'Remaining'}
                        </Text>
                      </View>
                    </Card>

                    <Card style={styles.financeMetricCard} mode="elevated">
                      <View style={styles.financeMetricContent}>
                        <AppIcon name="calendar-outline" size={16} color="#1D4ED8" />
                        <Text style={styles.financeMetricValue}>
                          ₹{financialReport.yearlyEstimate.toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.financeMetricLabel}>
                          {isHi ? 'वार्षिक अनुमान' : 'Yearly Forecast'}
                        </Text>
                      </View>
                    </Card>
                  </View>

                  {/* 3. High-Impact Bills Due Soon */}
                  {forecast.highImpactDueSoon.length > 0 && (
                    <Card style={styles.highImpactCard} mode="outlined">
                      <Card.Content style={styles.highImpactContent}>
                        <View style={styles.highImpactHeader}>
                          <Text style={styles.highImpactEmoji}>⚡</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.highImpactTitle}>
                              {isHi ? 'जल्द देय बड़े खर्चे (7 दिन)' : 'High-Impact Due Soon'}
                            </Text>
                            <Text style={styles.highImpactSub}>
                              {isHi
                                ? '₹1,000 या अधिक के आगामी भुगतान'
                                : 'Upcoming major bills due within the next 7 days'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.highImpactList}>
                          {forecast.highImpactDueSoon.map((item) => {
                            const catInfo = getCategoryDef(item.category);
                            const formattedDate = new Date(item.dueDate).toLocaleDateString(
                              isHi ? 'hi-IN' : 'en-US',
                              { month: 'short', day: 'numeric' }
                            );
                            return (
                              <TouchableOpacity
                                key={item.id}
                                style={styles.highImpactItem}
                                onPress={() => setSelectedTaskId(item.id)}
                                activeOpacity={0.75}
                              >
                                <View style={styles.highImpactItemLeft}>
                                  <Text style={styles.highImpactCatIcon}>{catInfo?.icon ?? '📌'}</Text>
                                  <View>
                                    <Text style={styles.highImpactItemTitle} numberOfLines={1}>
                                      {item.title}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.highImpactItemDate,
                                        item.daysUntil < 0 && { color: Colors.clay, fontFamily: 'Manrope_700Bold' },
                                      ]}
                                    >
                                      {item.daysUntil < 0
                                        ? isHi
                                          ? `⚠️ अतिदेय (${Math.abs(item.daysUntil)} दिन पहले)`
                                          : `⚠️ Overdue (${Math.abs(item.daysUntil)}d ago)`
                                        : isHi
                                        ? `देय: ${formattedDate}`
                                        : `Due: ${formattedDate}`}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={styles.highImpactItemAmount}>
                                  {formatIndian(item.amount)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </Card.Content>
                    </Card>
                  )}

                  {/* 4. Category Spend Breakdown */}
                  {financialReport.categoryBreakdown.length > 0 && (
                    <>
                      <SectionHeader label={isHi ? 'श्रेणी अनुसार खर्च' : 'Category Spend Breakdown'} />
                      <Card style={styles.categorySpendCard} mode="elevated">
                        <Card.Content style={styles.categorySpendContent}>
                          {financialReport.categoryBreakdown.map((cat) => (
                            <View key={cat.key} style={styles.catSpendItem}>
                              <View style={styles.catSpendTop}>
                                <View style={styles.catSpendLeft}>
                                  <Text style={styles.catSpendIcon}>{cat.icon}</Text>
                                  <Text style={styles.catSpendLabel}>{cat.label}</Text>
                                </View>
                                <View style={styles.catSpendRight}>
                                  <Text style={styles.catSpendAmount}>
                                    ₹{cat.paid.toLocaleString('en-IN')} / ₹{cat.projected.toLocaleString('en-IN')}
                                  </Text>
                                  <Text style={styles.catSpendPct}>({cat.percentPaid}%)</Text>
                                </View>
                              </View>
                              <View style={styles.catSpendTrack}>
                                <View
                                  style={[
                                    styles.catSpendFill,
                                    { width: `${Math.min(cat.percentPaid, 100)}%` },
                                  ]}
                                />
                              </View>
                            </View>
                          ))}
                        </Card.Content>
                      </Card>
                    </>
                  )}

                  {/* 5. Financial Tasks Timeline */}
                  <SectionHeader
                    label={
                      isHi
                        ? `वित्तीय कार्य सूची (${financialReport.totalFinanceTasks})`
                        : `Financial Tasks Timeline (${financialReport.totalFinanceTasks})`
                    }
                  />
                  <View style={styles.timelineList}>
                    {financialReport.itemList.map((item, idx) => {
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
                                  styles.itemStatusDot,
                                  isPaid && styles.itemStatusDotPaid,
                                  isOverdue && styles.itemStatusDotOverdue,
                                ]}
                              >
                                <AppIcon
                                  name={isPaid ? 'checkmark-circle' : isOverdue ? 'warning-outline' : 'time-outline'}
                                  size={16}
                                  color={Colors.white}
                                />
                              </View>

                              {/* Content */}
                              <View style={styles.itemContent}>
                                <Text
                                  style={[styles.itemTitle, isPaid && styles.itemTitlePaid]}
                                  numberOfLines={1}
                                >
                                  {item.task.title}
                                </Text>
                                <Text style={styles.itemSubText}>
                                  {isPaid
                                    ? isHi
                                      ? 'इस महीने भुगतान किया गया ✓'
                                      : 'Paid this month ✓'
                                    : isOverdue
                                    ? isHi
                                      ? 'विलंबित बिल ⚠️'
                                      : 'Overdue bill ⚠️'
                                    : isHi
                                    ? `देय तिथि: ${item.dueDate.slice(0, 10)}`
                                    : `Due: ${item.dueDate.slice(0, 10)}`}
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
                </>
              )}
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* TAB 3: HABITS & CONSISTENCY                                 */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeSegment === 'habits' && (
            <View style={styles.tabContent}>
              {/* Daily Streak & 28-day Habit Matrix */}
              <HabitConsistencyHeatmap
                streak={insights.streak}
                matrix={consistencyMatrix}
                velocity={weeklyVelocity}
                language={language}
              />

              {/* Household Member Contribution Leaderboard (shown only for All or Household scopes) */}
              {hasActiveHouseholdMembers && activeScope !== 'personal' && (
                <>
                  <SectionHeader
                    label={isHi ? 'गृहस्थी का योगदान' : 'Household Contribution'}
                  />
                  <Card style={styles.leaderboardCard} mode="elevated">
                    <Card.Content style={styles.leaderboardContent}>
                      {members.map((m, idx) => {
                        const key = m.isYou ? 'you' : (m.code || m.userId || m.name);
                        return (
                          <View key={key} style={styles.leaderboardRow}>
                            <Text style={styles.rankNum}>#{idx + 1}</Text>
                            <View
                              style={[
                                styles.avatar,
                                { backgroundColor: m.color || Colors.marigold },
                              ]}
                            >
                              <Text style={styles.avatarText}>{m.short}</Text>
                            </View>
                            <View style={styles.leaderboardInfo}>
                              <Text style={styles.leaderboardName} numberOfLines={1}>
                                {m.name}{m.isYou ? (isHi ? ' (आप)' : ' (You)') : ''}
                              </Text>
                              <Text style={styles.leaderboardStatText}>
                                {m.onTimePercent}% {isHi ? 'समय पर' : 'on-time'} ·{' '}
                                {m.completedCount ?? 0} {isHi ? 'पूर्ण' : 'done'}
                                {m.taskCount > 0
                                  ? ` (${m.taskCount} ${isHi ? 'कार्य' : 'assigned'})`
                                  : ''}
                              </Text>
                              <View style={styles.leaderboardBarTrack}>
                                <View
                                  style={[
                                    styles.leaderboardBarFill,
                                    {
                                      width: `${m.onTimePercent}%`,
                                      backgroundColor: m.color || Colors.marigold,
                                    },
                                  ]}
                                />
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </Card.Content>
                  </Card>
                </>
              )}
            </View>
          )}
        </>
      )}

      {/* Task Report Modal */}
      <TaskReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        tasks={scopedTasks}
        language={language}
      />

      {/* Task Detail Sheet for managing any tapped task in timeline */}
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
          onEdit={(taskId) => {
            setSelectedTaskId(null);
            router.push(`/(tabs)?editTaskId=${taskId}`);
          }}
        />
      )}
    </ScreenShell>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Scope Pills
  scopeWrapper: {
    marginBottom: 4,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    gap: 6,
    flexShrink: 0,
  },
  scopePillActive: {
    backgroundColor: Colors.indigo950,
    borderColor: Colors.indigo950,
  },
  scopeIcon: {
    fontSize: 13,
  },
  scopeLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: Colors.inkSoft,
  },
  scopeLabelActive: {
    color: Colors.white,
    fontFamily: 'Manrope_700Bold',
  },
  scopeCountBadge: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  scopeCountBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  scopeCountText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    color: Colors.inkFaint,
  },
  scopeCountTextActive: {
    color: Colors.white,
  },

  // Tab Content Container
  tabContent: {
    marginTop: 2,
    gap: 12,
  },

  // Task Report Entry Card
  allTasksCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  allTasksInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  allTasksIconBadge: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allTasksIconEmoji: { fontSize: 20 },
  allTasksMid: { flex: 1 },
  allTasksTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 14.5,
    color: '#FFF',
    marginBottom: 2,
  },
  allTasksSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: 'rgba(255,255,255,0.72)',
  },
  allTasksRightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  allTasksHint: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: '#FFF',
  },

  // Slip Callout Card
  calloutCard: {
    backgroundColor: 'rgba(193,80,46,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(193,80,46,0.25)',
    borderRadius: Radius.md,
  },
  calloutContent: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  calloutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  calloutIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(193,80,46,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  calloutTextMid: { flex: 1 },
  calloutTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 13.5,
    color: Colors.clayDeep,
    marginBottom: 2,
  },
  calloutBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: Colors.clayDeep,
    lineHeight: 17,
  },
  fixItBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
    backgroundColor: Colors.clayDeep,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
  },
  fixItText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: '#FFF',
  },

  // Trend Card
  trendCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderColor: Colors.ivoryLine,
    borderWidth: 1,
  },
  trendCardUp: {
    borderColor: 'rgba(22,163,74,0.3)',
    backgroundColor: 'rgba(22,163,74,0.06)',
  },
  trendCardDown: {
    borderColor: 'rgba(193,80,46,0.25)',
    backgroundColor: 'rgba(193,80,46,0.06)',
  },
  trendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  trendText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12.5,
    color: Colors.inkSoft,
  },

  // Side by Side Grid Cards
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ringCard: {
    flex: 1.1,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 1.5,
    overflow: 'hidden',
  },
  ringContent: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  ringContainer: {
    width: 106,
    height: 106,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringTextCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringPctText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 24,
    color: Colors.ink,
  },
  cap: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
  },
  metricsCard: {
    flex: 1.2,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 1.5,
    overflow: 'hidden',
  },
  metricsContent: {
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  metricsHeader: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.inkFaint,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricItem: { flex: 1 },
  metricValue: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 19,
    color: Colors.marigoldDeep,
  },
  metricLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 10.5,
    color: Colors.inkSoft,
    marginTop: 1,
  },
  onTimeClarityPill: {
    marginTop: 10,
    backgroundColor: 'rgba(13,148,136,0.08)',
    borderRadius: Radius.full,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  onTimeClarityText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    color: Colors.tealDeep,
  },

  // ── Native Financial Dashboard Styles ──
  financeHeroCard: {
    backgroundColor: '#1E293B',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    elevation: 3,
  },
  financeHeroContent: {
    padding: 16,
  },
  financeHeroTag: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 11,
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  financeHeroAmount: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 32,
    color: Colors.white,
    marginBottom: 14,
  },
  financeProgressBlock: { gap: 6 },
  financeProgressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  financeProgressPaidText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12.5,
    color: '#2DD4BF',
  },
  financeProgressPercentText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 12,
    color: Colors.white,
  },
  financeProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  financeProgressFill: {
    height: '100%',
    backgroundColor: '#2DD4BF',
    borderRadius: 4,
  },
  financeProgressRemText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11.5,
    color: '#CBD5E1',
  },

  // 4-Metric Grid
  financeMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  financeMetricCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 0.5,
  },
  financeMetricContent: {
    padding: 12,
    gap: 4,
  },
  financeMetricValue: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 16,
    color: Colors.ink,
  },
  financeMetricLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkSoft,
  },

  // Category Spend Details Card
  categorySpendCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 1,
  },
  categorySpendContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  catSpendItem: {
    gap: 6,
  },
  catSpendTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catSpendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catSpendIcon: {
    fontSize: 14,
  },
  catSpendLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.ink,
  },
  catSpendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  catSpendAmount: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 13,
    color: Colors.tealDeep,
  },
  catSpendPct: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkFaint,
  },
  catSpendTrack: {
    height: 6,
    backgroundColor: Colors.ivoryDim,
    borderRadius: 3,
    overflow: 'hidden',
  },
  catSpendFill: {
    height: '100%',
    backgroundColor: Colors.tealDeep,
    borderRadius: 3,
  },

  // High Impact Card
  highImpactCard: {
    backgroundColor: Colors.white,
    borderColor: 'rgba(232, 163, 61, 0.3)',
    borderRadius: Radius.md,
    borderWidth: 1,
    elevation: 1,
  },
  highImpactContent: {
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  highImpactHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  highImpactEmoji: {
    fontSize: 20,
    marginTop: 1,
  },
  highImpactTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 13.5,
    color: Colors.ink,
  },
  highImpactSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 1,
  },
  highImpactList: {
    gap: 8,
  },
  highImpactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  highImpactItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  highImpactCatIcon: {
    fontSize: 16,
  },
  highImpactItemTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.ink,
  },
  highImpactItemDate: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 10.5,
    color: Colors.inkFaint,
  },
  highImpactItemAmount: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 13.5,
    color: Colors.clayDeep,
  },

  // Financial Timeline
  timelineList: {
    gap: 8,
  },
  itemCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    overflow: 'hidden',
    elevation: 0.5,
  },
  itemCardPaid: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  itemRipple: {
    padding: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemStatusDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemStatusDotPaid: {
    backgroundColor: '#10B981',
  },
  itemStatusDotOverdue: {
    backgroundColor: '#EF4444',
  },
  itemContent: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13.5,
    color: Colors.ink,
  },
  itemTitlePaid: {
    color: '#64748B',
  },
  itemSubText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkSoft,
  },
  amountBadge: {
    backgroundColor: Colors.surfaceMuted,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  amountBadgeText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 12.5,
    color: Colors.tealDeep,
  },

  // Leaderboard Card
  leaderboardCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 1.5,
  },
  leaderboardContent: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankNum: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 12,
    color: Colors.inkFaint,
    width: 20,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    color: Colors.white,
    fontFamily: 'Manrope_800ExtraBold',
  },
  leaderboardInfo: { flex: 1, gap: 3 },
  leaderboardName: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.ink,
  },
  leaderboardStatText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
  },
  leaderboardBarTrack: {
    height: 6,
    backgroundColor: Colors.ivoryDim,
    borderRadius: 3,
    overflow: 'hidden',
  },
  leaderboardBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
