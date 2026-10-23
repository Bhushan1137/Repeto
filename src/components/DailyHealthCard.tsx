import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, Card } from "react-native-paper";
import { Colors, Radius } from "@/constants/theme";

type HealthStatus = "great" | "ok" | "attention";

interface DailyHealthCardProps {
  percent: number;
  overdueCount: number;
  status: HealthStatus;
  language: "en" | "hi";
}

const STATUS_CONFIG: Record<
  HealthStatus,
  { borderColor: string; icon: string; titleEn: string; titleHi: string }
> = {
  great: {
    borderColor: "#16A34A",
    icon: "✅",
    titleEn: "You're on track this month",
    titleHi: "इस महीने आप सही राह पर हैं",
  },
  ok: {
    borderColor: Colors.marigold,
    icon: "⚠️",
    titleEn: "Slipping a little",
    titleHi: "थोड़ा पिछड़ रहे हैं",
  },
  attention: {
    borderColor: Colors.clay,
    icon: "🚨",
    titleEn: "Needs attention",
    titleHi: "ध्यान देने की जरूरत है",
  },
};

function getCurrentMonthLabel(): string {
  return new Date().toLocaleString("en", { month: "long", year: "numeric" });
}

export function DailyHealthCard({ percent, overdueCount, status, language }: DailyHealthCardProps) {
  const cfg = STATUS_CONFIG[status];
  const isHi = language === "hi";

  const title = isHi ? cfg.titleHi : cfg.titleEn;

  let subtitle: string;
  if (overdueCount === 0 && status === "great") {
    subtitle = isHi ? "सब ठीक है!" : "All caught up!";
  } else {
    const pctPart = isHi ? `${percent}% समय पर` : `${percent}% on-time`;
    const overduePart =
      overdueCount > 0
        ? isHi
          ? ` · ${overdueCount} विलंबित`
          : ` · ${overdueCount} overdue`
        : "";
    subtitle = pctPart + overduePart;
  }

  return (
    <Card style={[styles.card, { borderLeftColor: cfg.borderColor }]} mode="elevated">
      <Card.Content style={styles.content}>
        <View style={styles.left}>
          <Text style={styles.icon}>{cfg.icon}</Text>
        </View>
        <View style={styles.mid}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.monthLabel}>{getCurrentMonthLabel()}</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderLeftWidth: 4,
    marginBottom: 14,
    elevation: 2,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  left: { width: 32, alignItems: "center" },
  icon: { fontSize: 22 },
  mid: { flex: 1, gap: 2 },
  title: {
    fontFamily: "Manrope_700Bold",
    fontSize: 14,
    color: Colors.ink,
    lineHeight: 20,
  },
  subtitle: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    color: Colors.inkSoft,
    lineHeight: 17,
  },
  right: { alignItems: "flex-end" },
  monthLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 10,
    color: Colors.inkFaint,
    textAlign: "right",
  },
});
