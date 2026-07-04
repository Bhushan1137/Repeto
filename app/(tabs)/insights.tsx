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

            <Card style={styles.streakCard} mode="elevated">
              <LinearGradient
                colors={[Colors.marigold, Colors.marigoldDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Card.Content style={styles.streakContent}>
                <View style={styles.streakEmojiCircle}>
                  <Text style={styles.streakEmoji}>🔥</Text>
                </View>
                <Text style={styles.streakVal}>{insights.streak}</Text>
                <Text style={styles.streakTitle}>{translate('currentStreak')}</Text>
                <Text style={styles.streakSub}>
                  {translate('streakDetail', { count: insights.streak })}
                </Text>
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
  streakCard: {
    flex: 1,
    borderRadius: Radius.lg,
    elevation: 1.5,
    overflow: 'hidden',
  },
  streakContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  streakEmojiCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  streakEmoji: { fontSize: 18 },
  streakVal: { fontFamily: 'Fraunces_700Bold', fontSize: 32, color: Colors.onDark, marginBottom: 2 },
  streakTitle: { ...Typography.title, fontSize: 12.5, color: Colors.onDark, textAlign: 'center' },
  streakSub: { ...Typography.caption, fontSize: 10, color: Colors.onDarkMuted, textAlign: 'center', marginTop: 1 },
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
