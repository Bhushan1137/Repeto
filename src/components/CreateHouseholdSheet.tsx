import React, { useState } from "react";
import { View, Modal, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput as PaperInput, Card } from "react-native-paper";
import { Colors, Radius } from "@/constants/theme";
import { HOUSEHOLD_ICONS, HOUSEHOLD_COLORS, MAX_HOUSEHOLDS } from "@/domain/household";

interface CreateHouseholdSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, icon: string, color: string) => Promise<{ ok: boolean; error?: string }>;
  existingCount: number;
  language: "en" | "hi";
}

export function CreateHouseholdSheet({
  visible,
  onClose,
  onCreate,
  existingCount,
  language,
}: CreateHouseholdSheetProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(HOUSEHOLD_ICONS[0]);
  const [color, setColor] = useState(HOUSEHOLD_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isHi = language === "hi";
  const isLimitReached = existingCount >= MAX_HOUSEHOLDS;
  const isValid = name.trim().length >= 2 && name.trim().length <= 30;

  const reset = () => {
    setName("");
    setIcon(HOUSEHOLD_ICONS[0]);
    setColor(HOUSEHOLD_COLORS[0]);
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!isValid || loading) return;
    setError("");
    setLoading(true);
    const result = await onCreate(name, icon, color);
    setLoading(false);
    if (result.ok) {
      reset();
      onClose();
    } else {
      if (result.error === "name_exists") {
        setError(isHi ? "इस नाम का घर पहले से मौजूद है" : "A household with this name already exists");
      } else if (result.error === "limit_reached") {
        setError(isHi ? `अधिकतम ${MAX_HOUSEHOLDS} घर बना सकते हैं` : `You can have at most ${MAX_HOUSEHOLDS} households`);
      } else {
        setError(isHi ? "कुछ गलत हुआ। फिर कोशिश करें।" : "Something went wrong. Please try again.");
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrapper}
      >
        <Card style={styles.sheet} mode="elevated">
          <Card.Content style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {isHi ? "नया घर बनाएं" : "New Household"}
              </Text>
              <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
                <Text style={styles.closeX}>✕</Text>
              </Pressable>
            </View>

            {isLimitReached ? (
              <View style={styles.limitBox}>
                <Text style={styles.limitText}>
                  {isHi
                    ? `आप अधिकतम ${MAX_HOUSEHOLDS} घर बना सकते हैं।`
                    : `Free plan allows up to ${MAX_HOUSEHOLDS} households.`}
                </Text>
              </View>
            ) : (
              <>
                {/* Name input */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    {isHi ? "घर का नाम" : "Household name"}
                  </Text>
                  <PaperInput
                    mode="outlined"
                    value={name}
                    onChangeText={setName}
                    placeholder={isHi ? "जैसे: ऑफिस, पैरेंट्स होम" : "e.g. Office, Parents Home"}
                    maxLength={30}
                    outlineColor={Colors.ivoryLine}
                    activeOutlineColor={color}
                    textColor={Colors.ink}
                    style={styles.input}
                    theme={{ colors: { background: Colors.white } }}
                  />
                  {name.trim().length > 0 && name.trim().length < 2 && (
                    <Text style={styles.validationText}>
                      {isHi ? "कम से कम 2 अक्षर" : "At least 2 characters"}
                    </Text>
                  )}
                </View>

                {/* Icon picker */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    {isHi ? "आइकॉन चुनें" : "Pick an icon"}
                  </Text>
                  <View style={styles.iconGrid}>
                    {HOUSEHOLD_ICONS.map((ic) => (
                      <Pressable
                        key={ic}
                        onPress={() => setIcon(ic)}
                        style={[
                          styles.iconCell,
                          icon === ic && { backgroundColor: color, borderColor: color },
                        ]}
                      >
                        <Text style={styles.iconEmoji}>{ic}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Color picker */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    {isHi ? "रंग" : "Color"}
                  </Text>
                  <View style={styles.colorRow}>
                    {HOUSEHOLD_COLORS.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setColor(c)}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: c },
                          color === c && styles.colorSwatchActive,
                        ]}
                      >
                        {color === c && <Text style={styles.colorCheck}>✓</Text>}
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Error */}
                {!!error && <Text style={styles.errorText}>{error}</Text>}

                {/* Preview pill */}
                {name.trim().length >= 2 && (
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>{isHi ? "पूर्वावलोकन:" : "Preview:"}</Text>
                    <View style={[styles.previewPill, { backgroundColor: color }]}>
                      <Text style={styles.previewIcon}>{icon}</Text>
                      <Text style={styles.previewName}>{name.trim()}</Text>
                    </View>
                  </View>
                )}

                {/* Save button */}
                <Pressable
                  onPress={handleSave}
                  disabled={!isValid || loading}
                  style={[
                    styles.saveBtn,
                    { backgroundColor: color },
                    (!isValid || loading) && styles.saveBtnDisabled,
                  ]}
                >
                  <Text style={styles.saveBtnText}>
                    {loading
                      ? (isHi ? "बना रहे हैं..." : "Creating...")
                      : (isHi ? "घर बनाएं" : "Create Household")}
                  </Text>
                </Pressable>
              </>
            )}
          </Card.Content>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(23, 27, 54, 0.5)",
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.ivory,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    elevation: 12,
    maxHeight: "88%",
  },
  content: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 20,
    color: Colors.ink,
  },
  closeBtn: {
    padding: 6,
  },
  closeX: {
    fontSize: 16,
    color: Colors.inkSoft,
  },
  field: { gap: 8 },
  fieldLabel: {
    fontFamily: "Manrope_700Bold",
    fontSize: 12,
    color: Colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.white,
    fontFamily: "Manrope_500Medium",
    fontSize: 15,
  },
  validationText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 11,
    color: Colors.clay,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 2,
    borderColor: "transparent",
  },
  iconEmoji: { fontSize: 22 },
  colorRow: {
    flexDirection: "row",
    gap: 10,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchActive: {
    borderColor: Colors.ink,
    transform: [{ scale: 1.15 }],
  },
  colorCheck: { color: "#fff", fontSize: 14, fontFamily: "Manrope_800ExtraBold" },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: Colors.inkSoft,
  },
  previewPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
  },
  previewIcon: { fontSize: 15 },
  previewName: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 13,
    color: "#fff",
  },
  errorText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: Colors.clay,
    textAlign: "center",
  },
  saveBtn: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 15,
    color: "#fff",
  },
  limitBox: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: "center",
  },
  limitText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: "center",
  },
});
