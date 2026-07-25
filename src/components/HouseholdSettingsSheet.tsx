import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Alert, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { AppIcon } from '@/components/AppIcon';
import { Colors, Radius, Typography } from '@/constants/theme';
import type { HouseholdContext, HouseholdMemberProfile } from '@/types';

interface HouseholdSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  activeHousehold: HouseholdContext;
  currentUserId: string;
  currentUserName: string;
  language: 'en' | 'hi';
  onDeleteHousehold: (householdId: string) => Promise<{ ok: boolean; error?: string }>;
  onLeaveHousehold: (householdId: string) => Promise<{ ok: boolean; error?: string }>;
  onRemoveMember: (householdId: string, memberCode: string, memberUserId?: string) => Promise<{ ok: boolean; error?: string }>;
  showToast: (msg: string) => void;
}

export function HouseholdSettingsSheet({
  visible,
  onClose,
  activeHousehold,
  currentUserId,
  currentUserName,
  language,
  onDeleteHousehold,
  onLeaveHousehold,
  onRemoveMember,
  showToast,
}: HouseholdSettingsSheetProps) {
  const [loading, setLoading] = useState(false);
  const [removingCode, setRemovingCode] = useState<string | null>(null);
  const isOwner = activeHousehold.ownerUid === currentUserId;
  const hi = language === 'hi';

  const handleDeleteHousehold = () => {
    const doDelete = () => {
      setLoading(true);
      onDeleteHousehold(activeHousehold.id)
        .then((res) => {
          setLoading(false);
          if (res.ok) { showToast(hi ? 'घर हटा दिया गया' : 'Household deleted'); onClose(); }
          else showToast(hi ? 'घर हटाने में विफल' : 'Failed to delete household');
        })
        .catch(() => setLoading(false));
    };
    if (Platform.OS === 'web') {
      if (window.confirm(hi ? `"${activeHousehold.name}" हटाएं? सभी सदस्यों की पहुंच समाप्त होगी।` : `Delete "${activeHousehold.name}"? All members will lose access.`)) doDelete();
    } else {
      Alert.alert(
        hi ? 'घर हटाएं?' : 'Delete Household?',
        hi ? `"${activeHousehold.name}" हटाने पर सभी सदस्यों की पहुंच समाप्त हो जाएगी। यह क्रिया पूर्ववत नहीं की जा सकती।` : `Deleting "${activeHousehold.name}" will remove access for all ${activeHousehold.members.length} member(s). This cannot be undone.`,
        [{ text: hi ? 'रद्द करें' : 'Cancel', style: 'cancel' }, { text: hi ? 'हटाएं' : 'Delete', style: 'destructive', onPress: doDelete }]
      );
    }
  };

  const handleLeaveHousehold = () => {
    const doLeave = () => {
      setLoading(true);
      onLeaveHousehold(activeHousehold.id)
        .then((res) => {
          setLoading(false);
          if (res.ok) { showToast(hi ? 'घर छोड़ दिया' : 'Left household'); onClose(); }
          else showToast(hi ? 'घर छोड़ने में विफल' : 'Failed to leave household');
        })
        .catch(() => setLoading(false));
    };
    if (Platform.OS === 'web') {
      if (window.confirm(hi ? `"${activeHousehold.name}" छोड़ें?` : `Leave "${activeHousehold.name}"?`)) doLeave();
    } else {
      Alert.alert(
        hi ? 'घर छोड़ें?' : 'Leave Household?',
        hi ? `"${activeHousehold.name}" छोड़ने पर साझा कार्यों तक पहुंच समाप्त होगी।` : `You will lose access to shared tasks in "${activeHousehold.name}".`,
        [{ text: hi ? 'रद्द करें' : 'Cancel', style: 'cancel' }, { text: hi ? 'छोड़ें' : 'Leave', style: 'destructive', onPress: doLeave }]
      );
    }
  };

  const handleRemoveMember = (member: HouseholdMemberProfile) => {
    const doRemove = () => {
      setRemovingCode(member.code);
      onRemoveMember(activeHousehold.id, member.code, member.userId)
        .then((res) => {
          setRemovingCode(null);
          if (res.ok) showToast(hi ? `${member.name} को हटाया गया` : `${member.name} removed`);
          else showToast(hi ? 'सदस्य हटाने में विफल' : 'Failed to remove member');
        })
        .catch(() => setRemovingCode(null));
    };
    if (Platform.OS === 'web') {
      if (window.confirm(hi ? `"${member.name}" को हटाएं?` : `Remove ${member.name}?`)) doRemove();
    } else {
      Alert.alert(
        hi ? 'सदस्य हटाएं?' : 'Remove Member?',
        hi ? `"${member.name}" को हटाने पर उनके साझा कार्य अनशेयर होंगे।` : `Remove ${member.name} from "${activeHousehold.name}"? Their shared tasks will be unshared.`,
        [{ text: hi ? 'रद्द करें' : 'Cancel', style: 'cancel' }, { text: hi ? 'हटाएं' : 'Remove', style: 'destructive', onPress: doRemove }]
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.hhIcon}>{activeHousehold.icon || '🏠'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.hhName}>{activeHousehold.name}</Text>
              <Text style={styles.hhMeta}>
                {isOwner ? (hi ? 'आप स्वामी हैं' : 'You are the owner') : (hi ? 'आप सदस्य हैं' : 'You are a member')}
                {' · '}{activeHousehold.members.length} {hi ? 'सदस्य' : 'members'}
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <AppIcon name="close" size={20} color={Colors.ink} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* ── Members List ── */}
          <Text style={styles.sectionLabel}>{hi ? 'सदस्य' : 'Members'}</Text>
          <Card style={styles.membersCard} mode="elevated">
            <Card.Content style={{ padding: 0 }}>
              {activeHousehold.members.map((m, idx) => {
                const isYou = m.userId === currentUserId;
                const isBeingRemoved = removingCode === m.code;
                const isLast = idx === activeHousehold.members.length - 1;
                return (
                  <View key={m.code || m.userId || m.name} style={[styles.memberRow, !isLast && styles.memberRowBorder]}>
                    <View style={[styles.memberAvatar, { backgroundColor: m.color || '#363E71' }]}>
                      <Text style={styles.memberAvatarText}>{(m.name || '?').slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{isYou ? `${hi ? 'आप' : 'You'} (${m.name})` : m.name}</Text>
                      <Text style={styles.memberRole}>
                        {m.userId === activeHousehold.ownerUid
                          ? (hi ? '👑 स्वामी' : '👑 Owner')
                          : m.status === 'pending'
                            ? (hi ? '⏳ अनुलंबित' : '⏳ Pending')
                            : (hi ? 'सदस्य' : 'Member')}
                      </Text>
                    </View>
                    {/* Only owner can remove non-owner, non-self members */}
                    {isOwner && !isYou && m.userId !== activeHousehold.ownerUid && (
                      <TouchableRipple onPress={() => handleRemoveMember(m)} style={styles.removeBtn} borderless disabled={isBeingRemoved}>
                        {isBeingRemoved
                          ? <ActivityIndicator size={16} color={Colors.inkSoft} />
                          : <AppIcon name="person-remove-outline" size={18} color="#C1502E" />}
                      </TouchableRipple>
                    )}
                  </View>
                );
              })}
            </Card.Content>
          </Card>

          <View style={styles.divider} />

          {/* ── Action Button ── */}
          {loading ? (
            <ActivityIndicator color={Colors.marigoldDeep} style={{ marginVertical: 16 }} />
          ) : isOwner ? (
            <Pressable style={styles.dangerBtn} onPress={handleDeleteHousehold}>
              <AppIcon name="trash-outline" size={18} color="#C1502E" />
              <Text style={styles.dangerBtnText}>{hi ? 'घर हटाएं' : 'Delete Household'}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.warnBtn} onPress={handleLeaveHousehold}>
              <AppIcon name="exit-outline" size={18} color="#D97706" />
              <Text style={styles.warnBtnText}>{hi ? 'घर छोड़ें' : 'Leave Household'}</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(23,27,54,0.45)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.ivoryLine },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  hhIcon: { fontSize: 28 },
  hhName: { fontFamily: 'Fraunces_700Bold', fontSize: 17, color: Colors.ink },
  hhMeta: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: Colors.inkSoft, marginTop: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.ivoryDim, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionLabel: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, letterSpacing: 0.5, color: Colors.inkFaint, marginBottom: 8, textTransform: 'uppercase' },
  membersCard: { backgroundColor: Colors.white, borderRadius: Radius.md, elevation: 1, overflow: 'hidden' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.ivoryLine },
  memberAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: Colors.white, fontFamily: 'Manrope_700Bold', fontSize: 14 },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: Colors.ink },
  memberRole: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: Colors.inkSoft },
  removeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  divider: { height: 1, backgroundColor: Colors.ivoryLine, marginVertical: 16 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: Radius.md, paddingVertical: 14, borderWidth: 1, borderColor: '#FECACA' },
  dangerBtnText: { fontFamily: 'Manrope_700Bold', fontSize: 15, color: '#C1502E' },
  warnBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFBEB', borderRadius: Radius.md, paddingVertical: 14, borderWidth: 1, borderColor: '#FDE68A' },
  warnBtnText: { fontFamily: 'Manrope_700Bold', fontSize: 15, color: '#D97706' },
});

