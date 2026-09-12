import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, Card, TouchableRipple } from "react-native-paper";
import type { SpendForecast } from "@/domain/insights";
import { Colors, Radius, Typography } from "@/constants/theme";
import { CATEGORY_MAP } from "@/constants/categories";

interface SpendForecastCardProps {
  forecast: SpendForecast;
  language: "en" | "hi";
  onPress?: () => void;
}

export function formatIndian(amount: number): string {
  if (!amount || amount === 0) return '₹0';
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} Lakh`;
  }
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function SpendForecastCard({ forecast, language, onPress }: SpendForecastCardProps) {
  const isHi = language === "hi";

  const emptyTitle = isHi ? "कोई वित्त कार्य नहीं" : "No finance tasks yet";
  const emptySub = isHi
    ? "राशि के साथ कार्य जोड़ें और यहाँ सटीक पूर्वानुमान देखें"
    : "Add tasks with an amount to see normalized spend forecasts here";

  if (forecast.financeTaskCount === 0) {
    return (
      <Card style={styles.card} mode="elevated">
        <TouchableRipple onPress={onPress} style={styles.emptyRipple} borderless>
          <View style={styles.emptyContent}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptySub}>{emptySub}</Text>
          </View>
        </TouchableRipple>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Main Forecast Card ── */}
      <Card style={styles.card} mode="elevated">
        <TouchableRipple onPress={onPress} style={styles.contentRipple} borderless>
          <View style={styles.content}>
            {/* Header / Monthly Projection */}
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerEyebrow}>
                  {isHi ? 'इस महीने का अनुमानित खर्च' : 'This Month Projected Spend'}
                </Text>
                <Text style={styles.mainAmount}>
                  {formatIndian(forecast.thisMonthTotal)}
                </Text>
              </View>
              <View style={styles.taskCountBadge}>
                <Text style={styles.taskCountText}>
                  {forecast.financeTaskCount} {isHi ? 'कार्य' : 'bills'}
                </Text>
              </View>
            </View>

            {/* Split Metrics: Paid so far vs Upcoming */}
            <View style={styles.splitRow}>
              <View style={[styles.splitCard, styles.paidCard]}>
                <View style={styles.splitLabelRow}>
                  <View style={[styles.statusDot, { backgroundColor: '#16A34A' }]} />
                  <Text style={styles.splitLabel}>
                    {isHi ? 'अब तक चुकाया' : 'Paid So Far'}
                  </Text>
                </View>
                <Text style={[styles.splitAmount, { color: '#16A34A' }]}>
                  {formatIndian(forecast.spentSoFarThisMonth)}
                </Text>
              </View>

              <View style={[styles.splitCard, styles.upcomingCard]}>
                <View style={styles.splitLabelRow}>
                  <View style={[styles.statusDot, { backgroundColor: Colors.marigoldDeep }]} />
                  <Text style={styles.splitLabel}>
                    {isHi ? 'बाकी / आने वाला' : 'Remaining / Due'}
                  </Text>
                </View>
                <Text style={[styles.splitAmount, { color: Colors.marigoldDeep }]}>
                  {formatIndian(forecast.upcomingThisMonth)}
                </Text>
              </View>
            </View>

            {/* Category horizontal chips */}
            {forecast.byCategory.length > 0 && (
              <View style={styles.categorySection}>
                <Text style={styles.subHeader}>
                  {isHi ? 'श्रेणी अनुसार खर्च' : 'Spend By Category'}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                >
                  {forecast.byCategory.map((cat) => (
                    <View key={cat.key} style={styles.chip}>
                      <Text style={styles.chipIcon}>{cat.icon}</Text>
                      <Text style={styles.chipLabel} numberOfLines={1}>
                        {cat.label}
                      </Text>
                      <Text style={styles.chipAmount}>{formatIndian(cat.amount)}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Footnote / Annual Estimate */}
            <View style={styles.footerRow}>
              <Text style={styles.yearlyText}>
                {isHi ? 'वार्षिक अनुमानित:' : 'Estimated annual:'}{' '}
                <Text style={styles.yearlyValue}>{formatIndian(forecast.yearlyEstimate)}</Text>
              </Text>
              <Text style={styles.ctaLink}>
                {isHi ? 'पूरा विवरण देखें →' : 'Explore Details →'}
              </Text>
            </View>
          </View>
        </TouchableRipple>
      </Card>

      {/* ── High Impact Expenses Due Soon (< 7 days & >= ₹1,000) ── */}
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
                const catInfo = CATEGORY_MAP[item.category] ?? CATEGORY_MAP['home'];
                const formattedDate = new Date(item.dueDate).toLocaleDateString(
                  language === 'hi' ? 'hi-IN' : 'en-US',
                  { month: 'short', day: 'numeric' }
                );

                return (
                  <View key={item.id} style={styles.highImpactItem}>
                    <View style={styles.highImpactItemLeft}>
                      <Text style={styles.highImpactCatIcon}>{catInfo?.icon ?? '📌'}</Text>
                      <View>
                        <Text style={styles.highImpactItemTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.highImpactItemDate}>
                          {isHi ? `देय: ${formattedDate}` : `Due: ${formattedDate}`}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.highImpactItemAmount}>
                      {formatIndian(item.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card.Content>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 1.5,
    overflow: 'hidden',
  },
  contentRipple: {
    borderRadius: Radius.md,
  },
  content: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerEyebrow: {
    ...Typography.caption,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  mainAmount: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 32,
    color: Colors.tealDeep,
    letterSpacing: -0.5,
  },
  taskCountBadge: {
    backgroundColor: Colors.surfaceMuted,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  taskCountText: {
    ...Typography.caption,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
  },

  // Split Paid vs Remaining
  splitRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  splitCard: {
    flex: 1,
    padding: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  paidCard: {
    backgroundColor: 'rgba(22, 163, 74, 0.05)',
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  upcomingCard: {
    backgroundColor: 'rgba(232, 163, 61, 0.07)',
    borderColor: 'rgba(232, 163, 61, 0.25)',
  },
  splitLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  splitLabel: {
    ...Typography.caption,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 10.5,
    color: Colors.inkSoft,
  },
  splitAmount: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
  },

  // Categories
  categorySection: {
    marginBottom: 14,
  },
  subHeader: {
    ...Typography.caption,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkFaint,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  chipIcon: { fontSize: 13 },
  chipLabel: {
    ...Typography.caption,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
    maxWidth: 90,
  },
  chipAmount: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.tealDeep,
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryLine,
  },
  yearlyText: {
    ...Typography.caption,
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkFaint,
  },
  yearlyValue: {
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkSoft,
  },
  ctaLink: {
    ...Typography.caption,
    fontFamily: 'Manrope_700Bold',
    fontSize: 11.5,
    color: Colors.marigoldDeep,
  },

  // Empty State
  emptyRipple: {
    padding: 20,
  },
  emptyContent: {
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: {
    ...Typography.body,
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: Colors.ink,
  },
  emptySub: {
    ...Typography.caption,
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: Colors.inkSoft,
    textAlign: 'center',
    lineHeight: 18,
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
    ...Typography.body,
    fontFamily: 'Fraunces_700Bold',
    fontSize: 13.5,
    color: Colors.ink,
  },
  highImpactSub: {
    ...Typography.caption,
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
    ...Typography.body,
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.ink,
  },
  highImpactItemDate: {
    ...Typography.caption,
    fontFamily: 'Manrope_500Medium',
    fontSize: 10.5,
    color: Colors.inkFaint,
  },
  highImpactItemAmount: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 13.5,
    color: Colors.clayDeep,
  },
});
