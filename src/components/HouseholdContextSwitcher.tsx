import React from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import type { HouseholdContext } from "@/types";
import { Colors, Radius } from "@/constants/theme";

import { getHouseholdDisplayName } from "@/domain/household";

interface HouseholdContextSwitcherProps {
  households: HouseholdContext[];
  activeHouseholdId: string | undefined;
  onSwitch: (id: string) => void;
  onCreateNew: () => void;
  language: "en" | "hi";
  currentUserId?: string;
}

export function HouseholdContextSwitcher({
  households,
  activeHouseholdId,
  onSwitch,
  onCreateNew,
  language,
  currentUserId,
}: HouseholdContextSwitcherProps) {
  const isHi = language === "hi";
  const newLabel = isHi ? "+ नया" : "+ New";

  if (households.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {households.map((hh) => {
          const isActive = hh.id === activeHouseholdId || (!activeHouseholdId && households[0]?.id === hh.id);
          const displayName = getHouseholdDisplayName(hh, currentUserId, households);
          return (
            <Pressable
              key={hh.id}
              onPress={() => onSwitch(hh.id)}
              style={[
                styles.pill,
                isActive && { backgroundColor: hh.color, borderColor: hh.color },
              ]}
            >
              <Text style={styles.pillIcon}>{hh.icon}</Text>
              <Text
                style={[
                  styles.pillLabel,
                  isActive && styles.pillLabelActive,
                ]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              {isActive && <View style={[styles.activeDot, { backgroundColor: "#fff" }]} />}
            </Pressable>
          );
        })}

        {/* + New button */}
        <Pressable onPress={onCreateNew} style={styles.newPill}>
          <Text style={styles.newPillLabel}>{newLabel}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  row: { flexDirection: "row", gap: 8, paddingHorizontal: 2, paddingVertical: 2 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
  },
  pillIcon: { fontSize: 15 },
  pillLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: Colors.inkSoft,
    maxWidth: 100,
  },
  pillLabelActive: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#fff",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.85,
  },
  newPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.marigold,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  newPillLabel: {
    fontFamily: "Manrope_700Bold",
    fontSize: 13,
    color: Colors.marigold,
  },
});
