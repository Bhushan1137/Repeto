import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useTasks } from '@/providers/TaskProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useInsights } from '@/hooks/useInsights';
import { ProgressRing } from '@/components/ProgressRing';
import { ScreenShell, SectionHeader, EmptyState } from '@/components/ScreenShell';
import { AccentHex, Colors, Gradients, Radius, Typography } from '@/constants/theme';
import { getCategoryAccent, getCategoryLabel } from '@/constants/categoryHelpers';

export default function InsightsScreen() {
  const { tasks } = useTasks();
  const { translate, language } = useTranslation();
  const insights = useInsights(tasks);

  const slipLabel = insights.slipCategory ? getCategoryLabel(insights.slipCategory, language) : null;

  const totalTasks = tasks.length;
  const completions = tasks.reduce((sum, t) => sum + t.history.filter(h => h.status === 'on_time' || h.status === 'late').length, 0);
  const skipped = tasks.reduce((sum, t) => sum + t.history.filter(h => h.status === 'skipped').length, 0);

  return (
    <ScreenShell title={translate('insTitle')} subtitle={translate('insSub')}>
      {insights.isEmpty ? (
        <EmptyState icon="◔" title={translate('insightsEmpty')} subtitle="" />
      ) : (
        <>
          <View style={styles.gridRow}>
            <Card style={styles.ringCard} mode="elevated">
              <Card.Content style={styles.ringContent}>
                <ProgressRing percent={insights.overallPercent} color={Colors.marigold} size={110} stroke={9} />
                <Text style={styles.pct}>{insights.overallPercent}%</Text>
                <Text style={styles.cap}>{translate('onTimeThisMonth')}</Text>
              </Card.Content>
            </Card>

            <Card style={styles.metricsCard} mode="elevated">
              <Card.Content style={styles.metricsContent}>
                <Text style={styles.metricsHeader}>{language === 'hi' ? 'कार्य सारांश' : 'Task Summary'}</Text>
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{totalTasks}</Text>
                    <Text style={styles.metricLabel}>{language === 'hi' ? 'सक्रिय कार्य' : 'Active Tasks'}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{completions}</Text>
                    <Text style={styles.metricLabel}>{language === 'hi' ? 'कुल पूर्ण' : 'Completions'}</Text>
                  </View>
                </View>
                <View style={[styles.metricsRow, { marginTop: 10 }]}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{skipped}</Text>
                    <Text style={styles.metricLabel}>{language === 'hi' ? 'छोड़े गए' : 'Skipped'}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricValue, { color: Colors.tealDeep }]}>{insights.overallPercent}%</Text>
                    <Text style={styles.metricLabel}>{language === 'hi' ? 'समय पर दर' : 'On-time Rate'}</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </View>

          <SectionHeader label={translate('weeklyActivity')} />
          <Card style={styles.heatmapCard} mode="elevated">
            <Card.Content style={styles.heatmapContent}>
              {insights.weeklyActivity.map((activity, idx) => (
                <View key={idx} style={styles.dayCol}>
                  <Text style={[styles.dayLabel, activity.isToday && styles.dayLabelToday]}>
                    {activity.dayName}
                  </Text>
                  <View
                    style={[
                      styles.dayCircle,
                      activity.hasCompletion && styles.dayCircleCompleted,
                      activity.isToday && !activity.hasCompletion && styles.dayCircleToday,
                    ]}
                  >
                    {activity.hasCompletion ? (
                      <Text style={styles.checkText}>✓</Text>
                    ) : activity.isToday ? (
                      <View style={styles.todayIndicator} />
                    ) : null}
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>

          <SectionHeader label={translate('byCategory')} />
          {insights.bars.map((bar) => (
            <Card key={bar.key} style={styles.barCard} mode="elevated">
              <Card.Content style={styles.barContent}>
                <View style={styles.barTop}>
                  <Text style={styles.barCat}>{bar.label}</Text>
                  <Text style={styles.barVal}>{bar.percent}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${bar.percent}%`, backgroundColor: AccentHex[getCategoryAccent(bar.key)] },
                    ]}
                  />
                </View>
              </Card.Content>
            </Card>
          ))}

          {slipLabel && insights.slipCategory && insights.bars.length > 1 && (
            <Card style={styles.calloutCard} mode="outlined">
              <Card.Content>
                <Text style={styles.calloutTitle}>⚠ {translate('categorySlipCallout', { category: slipLabel })}</Text>
                <Text style={styles.calloutBody}>{translate('categorySlipBody')}</Text>
              </Card.Content>
            </Card>
          )}
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  ringCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    elevation: 1.5,
    overflow: 'hidden',
  },
  ringContent: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  pct: { fontFamily: 'Fraunces_700Bold', fontSize: 30, color: Colors.ink, marginTop: -74, marginBottom: 38 },
  cap: { ...Typography.bodySm, fontSize: 11.5, color: Colors.inkSoft, textAlign: 'center', marginTop: 4, lineHeight: 16 },
  metricsCard: {
    flex: 1.2,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    elevation: 1.5,
    overflow: 'hidden',
  },
  metricsContent: {
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  metricsHeader: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.ink,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricItem: {
    flex: 1,
  },
  metricValue: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: Colors.marigoldDeep,
  },
  metricLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.inkSoft,
    marginTop: 1,
  },
  heatmapCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 14,
    elevation: 1.5,
  },
  heatmapContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLabel: { ...Typography.caption, fontSize: 11, color: Colors.inkSoft },
  dayLabelToday: { color: Colors.marigoldDeep, fontFamily: 'Manrope_800ExtraBold' },
  dayCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleCompleted: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  dayCircleToday: { borderColor: Colors.marigold },
  checkText: { color: Colors.white, fontSize: 11, fontFamily: 'Manrope_800ExtraBold', lineHeight: 14 },
  todayIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.marigold },
  barCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    marginBottom: 10,
    elevation: 1.5,
  },
  barContent: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  barCat: { ...Typography.title, fontSize: 13, color: Colors.ink },
  barVal: { ...Typography.caption, color: Colors.inkSoft },
  barTrack: { height: 8, backgroundColor: Colors.ivoryDim, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  calloutCard: {
    backgroundColor: 'rgba(193,80,46,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(193,80,46,0.2)',
    borderRadius: Radius.md,
    marginTop: 8,
  },
  calloutTitle: { ...Typography.title, fontSize: 13, color: Colors.clayDeep, marginBottom: 4 },
  calloutBody: { ...Typography.bodySm, color: Colors.clayDeep, lineHeight: 19 },
});
