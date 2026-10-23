import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { Text, Card } from "react-native-paper";
import type { UpcomingDaySlot, UpcomingTaskItem } from "@/domain/insights";
import { Colors, Radius } from "@/constants/theme";
import { getCategoryAccent } from "@/constants/categoryHelpers";
import { AccentHex } from "@/constants/theme";

interface UpcomingStripProps {
  slots: UpcomingDaySlot[];
  language: "en" | "hi";
  onTaskPress: (taskId: string) => void;
  showHeader?: boolean;
}

function formatAmount(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  return `₹${amount}`;
}

function DayPill({
  slot,
  isSelected,
  onPress,
}: {
  slot: UpcomingDaySlot;
  isSelected: boolean;
  onPress: () => void;
}) {
  const hasFinance = slot.tasks.some((t) => t.finance && t.amount);
  const totalAmount = slot.tasks.reduce((s, t) => s + (t.amount ?? 0), 0);
  const dotColors = slot.tasks
    .slice(0, 3)
    .map((t) => AccentHex[getCategoryAccent(t.category)] ?? Colors.marigold);

  const containerStyle = [
    styles.dayPill,
    slot.isOverdue && styles.dayPillOverdue,
    slot.isToday && !slot.isOverdue && styles.dayPillToday,
    isSelected && styles.dayPillSelected,
  ];

  return (
    <Pressable onPress={onPress} style={containerStyle}>
      <Text
        style={[
          styles.dayPillLabel,
          slot.isOverdue && styles.dayPillLabelOverdue,
          slot.isToday && styles.dayPillLabelToday,
        ]}
        numberOfLines={1}
      >
        {slot.dayLabel}
      </Text>

      {/* Task dots */}
      {slot.tasks.length > 0 ? (
        <View style={styles.dotsRow}>
          {dotColors.map((color, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: color }]} />
          ))}
          {slot.tasks.length > 3 && (
            <Text style={styles.dotMore}>+{slot.tasks.length - 3}</Text>
          )}
        </View>
      ) : (
        <View style={styles.dotsRow}>
          <View style={[styles.dot, { backgroundColor: Colors.ivoryLine }]} />
        </View>
      )}

      {/* Finance amount */}
      {hasFinance && totalAmount > 0 && (
        <Text style={[styles.amountLabel, slot.isOverdue && styles.amountLabelOverdue]}>
          {formatAmount(totalAmount)}
        </Text>
      )}
    </Pressable>
  );
}

function TaskRow({ task, onPress }: { task: UpcomingTaskItem; onPress: () => void }) {
  const accentColor = AccentHex[getCategoryAccent(task.category)] ?? Colors.marigold;
  return (
    <Pressable onPress={onPress} style={styles.taskRow}>
      <View style={[styles.taskDot, { backgroundColor: accentColor }]} />
      {task.icon ? <Text style={styles.taskIcon}>{task.icon}</Text> : null}
      <View style={styles.taskInfo}>
        <Text style={styles.taskTitle} numberOfLines={1}>
          {task.title}
        </Text>
      </View>
      {task.finance && task.amount ? (
        <Text style={styles.taskAmount}>{formatAmount(task.amount)}</Text>
      ) : null}
      <Text style={styles.taskChevron}>›</Text>
    </Pressable>
  );
}

export function UpcomingStrip({ slots, language, onTaskPress, showHeader = false }: UpcomingStripProps) {
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);

  const isHi = language === "hi";
  const totalTaskCount = slots.reduce((s, sl) => s + sl.tasks.length, 0);

  const headerTitle = isHi ? "आने वाले कार्य" : "Coming Up";
  const emptyText = isHi ? "अगले 2 हफ्तों में कोई कार्य नहीं" : "Nothing due in the next 2 weeks";

  const selectedSlot = slots.find(
    (s) => (s.isOverdue ? "overdue" : s.dateStr) === selectedSlotKey
  );

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      {showHeader && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📅 {headerTitle}</Text>
          {totalTaskCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalTaskCount}</Text>
            </View>
          )}
        </View>
      )}

      <Card style={styles.card} mode="elevated">
        <Card.Content style={styles.cardContent}>
          {slots.length === 0 || (slots.length === 1 && slots[0].isToday && slots[0].tasks.length === 0) ? (
            /* Empty state */
            <Text style={styles.emptyText}>✅ {emptyText}</Text>
          ) : (
            <>
              {/* Horizontal scroll strip */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stripRow}
              >
                {slots.map((slot) => {
                  const key = slot.isOverdue ? "overdue" : slot.dateStr;
                  return (
                    <DayPill
                      key={key}
                      slot={slot}
                      isSelected={selectedSlotKey === key}
                      onPress={() =>
                        setSelectedSlotKey(selectedSlotKey === key ? null : key)
                      }
                    />
                  );
                })}
              </ScrollView>

              {/* Expanded task list */}
              {selectedSlot && selectedSlot.tasks.length > 0 && (
                <View style={styles.expandedList}>
                  {selectedSlot.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onPress={() => onTaskPress(task.id)}
                    />
                  ))}
                </View>
              )}

              {/* Tap hint when today slot is selected and empty */}
              {selectedSlot && selectedSlot.tasks.length === 0 && (
                <Text style={styles.emptyDayText}>
                  {isHi ? "आज कोई कार्य देय नहीं" : "Nothing due today"}
                </Text>
              )}
            </>
          )}
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  headerTitle: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 13,
    color: Colors.ink,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    flex: 1,
  },
  badge: {
    backgroundColor: Colors.marigold,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 11,
    color: Colors.white,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    elevation: 1.5,
  },
  cardContent: { paddingVertical: 14, paddingHorizontal: 12 },
  stripRow: { flexDirection: "row", gap: 8, paddingRight: 4 },
  dayPill: {
    alignItems: "center",
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minWidth: 58,
    gap: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  dayPillOverdue: {
    backgroundColor: "rgba(193,80,46,0.08)",
    borderColor: "rgba(193,80,46,0.25)",
  },
  dayPillToday: {
    borderColor: Colors.marigold,
    backgroundColor: "#FFF8EC",
  },
  dayPillSelected: {
    borderColor: Colors.indigo700,
    backgroundColor: Colors.ivoryDim,
  },
  dayPillLabel: {
    fontFamily: "Manrope_700Bold",
    fontSize: 11,
    color: Colors.inkSoft,
    textAlign: "center",
  },
  dayPillLabelOverdue: { color: Colors.clay },
  dayPillLabelToday: { color: Colors.marigoldDeep, fontFamily: "Manrope_800ExtraBold" },
  dotsRow: { flexDirection: "row", gap: 3, alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotMore: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 9,
    color: Colors.inkFaint,
  },
  amountLabel: {
    fontFamily: "Manrope_700Bold",
    fontSize: 10,
    color: Colors.tealDeep,
  },
  amountLabelOverdue: { color: Colors.clay },
  expandedList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryLine,
    paddingTop: 10,
    gap: 10,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  taskInfo: { flex: 1 },
  taskIcon: { fontSize: 14 },
  taskTitle: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: Colors.ink,
  },
  taskAmount: {
    fontFamily: "Manrope_700Bold",
    fontSize: 12,
    color: Colors.tealDeep,
  },
  taskChevron: {
    fontSize: 18,
    color: Colors.inkFaint,
    lineHeight: 20,
  },
  emptyText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: "center",
    paddingVertical: 8,
  },
  emptyDayText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    color: Colors.inkSoft,
    textAlign: "center",
    marginTop: 10,
  },
});
