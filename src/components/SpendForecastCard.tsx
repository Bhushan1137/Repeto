import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, Card, TouchableRipple } from "react-native-paper";
import type { SpendForecast } from "@/domain/insights";
import { Colors, Radius } from "@/constants/theme";

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

  const thisMonthLabel = isHi ? "इस महीने" : "This Month";
  const nextMonthLabel = isHi ? "अगले महीने" : "Next Month";
  const yearlyLabel = isHi ? "अनुमानित वार्षिक" : "Estimated yearly";
  const emptyTitle = isHi ? "कोई वित्त कार्य नहीं" : "No finance tasks yet";
  const emptySub = isHi
    ? "राशि के साथ कार्य जोड़ें और यहाँ पूर्वानुमान देखें"
    : "Add tasks with an amount to see your forecast here";

  if (forecast.financeTaskCount === 0) {
    return (
      <Card style={styles.card} mode="elevated" onPress={onPress}>
        <TouchableRipple onPress={onPress} style={{ padding: 16 }} borderless>
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
    <Card style={styles.card} mode="elevated" onPress={onPress}>
      <TouchableRipple onPress={onPress} style={styles.contentRipple} borderless>
        <View style={styles.content}>
          {/* Two-column totals */}
          <View style={styles.totalsRow}>
            <View style={styles.totalCol}>
              <Text style={styles.totalLabel}>{thisMonthLabel}</Text>
              <Text style={styles.totalAmount}>
                {formatIndian(forecast.thisMonthTotal)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalCol}>
              <Text style={styles.totalLabel}>{nextMonthLabel}</Text>
              <Text style={[styles.totalAmount, styles.totalAmountNext]}>
                {formatIndian(forecast.nextMonthTotal)}
              </Text>
            </View>
          </View>

          {/* Yearly estimate */}
          {forecast.yearlyEstimate > 0 && (
            <Text style={styles.yearlyText}>
              {yearlyLabel}: {formatIndian(forecast.yearlyEstimate)}
            </Text>
          )}

          {/* Category chips */}
          {forecast.byCategory.length > 0 && (
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
          )}

          {/* Explore CTA Bar */}
          <View style={styles.exploreBar}>
            <Text style={styles.exploreText}>
              {isHi ? "वित्तीय विवरण देखें →" : "View Financial Explorer & Breakdown →"}
            </Text>
          </View>
        </View>
      </TouchableRipple>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 14,
    elevation: 1.5,
  },
  content: { paddingVertical: 16, paddingHorizontal: 16 },
  totalsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  totalCol: { flex: 1, alignItems: "center" },
  totalLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 11,
    color: Colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  totalAmount: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 26,
    color: Colors.tealDeep,
    letterSpacing: -0.5,
  },
  totalAmountNext: { color: Colors.indigo700, opacity: 0.75 },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.ivoryLine,
    marginHorizontal: 12,
  },
  yearlyText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 11.5,
    color: Colors.inkFaint,
    textAlign: "center",
    marginBottom: 12,
  },
  chipsRow: { flexDirection: "row", gap: 8, paddingBottom: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  chipIcon: { fontSize: 13 },
  chipLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 11,
    color: Colors.inkSoft,
    maxWidth: 80,
  },
  chipAmount: {
    fontFamily: "Manrope_700Bold",
    fontSize: 11,
    color: Colors.tealDeep,
  },
  emptyContent: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 6,
  },
  emptyIcon: { fontSize: 28 },
  emptyTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 14,
    color: Colors.ink,
  },
  emptySub: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    color: Colors.inkSoft,
    textAlign: "center",
    lineHeight: 18,
  },
  contentRipple: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  exploreBar: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryLine,
    alignItems: 'center',
  },
  exploreText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.marigoldDeep,
  },
});
