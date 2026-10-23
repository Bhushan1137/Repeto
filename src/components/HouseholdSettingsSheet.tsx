import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  Platform,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { AppIcon } from '@/components/AppIcon';
import { Colors, Radius, Typography } from '@/constants/theme';
import type { HouseholdContext, HouseholdMemberProfile } from '@/types';
import { initials } from '@/domain/insights';

export interface MemberWithStats {
  code?: string;
  userId?: string;
  name: string;
  short: string;
  color: string;
  taskCount: number;
  onTimePercent: number;
  isYou?: boolean;
  status?: string;
}

export interface HouseholdSettingsSheetProps {
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
  membersWithStats?: MemberWithStats[];
  onAddMemberPress?: () => void;
}

export function HouseholdSettingsSheet({
  visible,
  onClose,
  activeHousehold,
  currentUserId,
  currentUserName: _currentUserName,
  language,
  onDeleteHousehold,
  onLeaveHousehold,
  onRemoveMember,
  showToast,
  membersWithStats = [],
  onAddMemberPress,
}: HouseholdSettingsSheetProps) {
  const [loading, setLoading] = useState(false);
  const [removingCode, setRemovingCode] = useState<string | null>(null);
  const isOwner = activeHousehold?.ownerUid === currentUserId;
  const hi = language === 'hi';

  const sortedStats = useMemo(() => {
    return [...membersWithStats].sort((a, b) => b.onTimePercent - a.onTimePercent);
  }, [membersWithStats]);

  const handleDeleteHousehold = () => {
    const doDelete = () => {
      setLoading(true);
      onDeleteHousehold(activeHousehold.id)
        .then((res) => {
          setLoading(false);
          if (res.ok) {
            showToast(hi ? 'घर हटा दिया गया' : 'Household deleted');
            onClose();
          } else {
            showToast(hi ? 'घर हटाने में विफल' : 'Failed to delete household');
          }
        })
        .catch(() => setLoading(false));
    };

    const confirmMsg = hi
      ? `"${activeHousehold.name}" हटाएं? सभी सदस्यों की पहुंच समाप्त होगी। यह क्रिया पूर्ववत नहीं की जा सकती।`
      : `Delete "${activeHousehold.name}"? All ${activeHousehold.members?.length ?? 1} member(s) will lose access. This cannot be undone.`;

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) doDelete();
    } else {
      Alert.alert(
        hi ? 'घर हटाएं?' : 'Delete Household?',
        confirmMsg,
        [
          { text: hi ? 'रद्द करें' : 'Cancel', style: 'cancel' },
          { text: hi ? 'हटाएं' : 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const handleLeaveHousehold = () => {
    const doLeave = () => {
      setLoading(true);
      onLeaveHousehold(activeHousehold.id)
        .then((res) => {
          setLoading(false);
          if (res.ok) {
            showToast(hi ? 'घर छोड़ दिया' : 'Left household');
            onClose();
          } else {
            showToast(hi ? 'घर छोड़ने में विफल' : 'Failed to leave household');
          }
        })
        .catch(() => setLoading(false));
    };

    const confirmMsg = hi
      ? `"${activeHousehold.name}" छोड़ें? आप साझा कार्यों तक पहुंच खो देंगे।`
      : `Leave "${activeHousehold.name}"? You will lose access to shared tasks.`;

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) doLeave();
    } else {
      Alert.alert(
        hi ? 'घर छोड़ें?' : 'Leave Household?',
        confirmMsg,
        [
          { text: hi ? 'रद्द करें' : 'Cancel', style: 'cancel' },
          { text: hi ? 'छोड़ें' : 'Leave', style: 'destructive', onPress: doLeave },
        ]
      );
    }
  };

  const handleRemoveMember = (member: HouseholdMemberProfile) => {
    const doRemove = () => {
      setRemovingCode(member.code);
      onRemoveMember(activeHousehold.id, member.code, member.userId)
        .then((res) => {
          setRemovingCode(null);
          if (res.ok) {
            showToast(hi ? `${member.name} को हटाया गया` : `${member.name} removed`);
          } else if (res.error === 'offline') {
            showToast(hi ? 'आप ऑफ़लाइन हैं। इंटरनेट आवश्यक है।' : 'You are offline. Connection required.');
          } else {
            showToast(hi ? 'सदस्य हटाने में विफल' : 'Failed to remove member');
          }
        })
        .catch(() => setRemovingCode(null));
    };

    const confirmMsg = hi
      ? `"${member.name}" को "${activeHousehold.name}" से हटाएं?`
      : `Remove ${member.name} from "${activeHousehold.name}"?`;

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) doRemove();
    } else {
      Alert.alert(
        hi ? 'सदस्य हटाएं?' : 'Remove Member?',
        confirmMsg,
        [
          { text: hi ? 'रद्द करें' : 'Cancel', style: 'cancel' },
          { text: hi ? 'हटाएं' : 'Remove', style: 'destructive', onPress: doRemove },
        ]
      );
    }
  };

  if (!activeHousehold) return null;

  const membersList = activeHousehold.members || [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.hhIconWrap}>
              <Text style={styles.hhIcon}>{activeHousehold.icon || '🏠'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hhName} numberOfLines={1}>
                {activeHousehold.name}
              </Text>
              <Text style={styles.hhMeta}>
                {isOwner ? (hi ? '👑 आप स्वामी हैं' : '👑 You are the owner') : (hi ? 'सदस्य' : 'Member')}
                {' · '}{membersList.length} {hi ? 'सदस्य' : 'members'}
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <AppIcon name="close" size={20} color={Colors.ink} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* ── Members & Progress Section ── */}
          <View style={styles.membersSectionHeader}>
            <View>
              <Text style={styles.sectionLabel}>
                {hi ? 'घर के सदस्य' : 'Household Members'} ({membersList.length})
              </Text>
              <Text style={styles.sectionSubLabel}>
                {hi ? 'कार्य पूरा करने की प्रगति' : 'Task completion on-time'}
              </Text>
            </View>
            {onAddMemberPress && (
              <TouchableOpacity
                onPress={onAddMemberPress}
                style={styles.addMemberHeaderBtn}
                activeOpacity={0.7}
                testID="settings-invite-member-btn"
              >
                <AppIcon name="add" size={13} color={Colors.marigoldDeep} />
                <Text style={styles.addMemberHeaderText}>
                  {hi ? 'आमंत्रित करें' : 'Invite'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Card style={styles.membersCard} mode="elevated">
            <Card.Content style={{ padding: 0 }}>
              {membersList.map((m, idx) => {
                const isYou = m.userId === currentUserId;
                const isBeingRemoved = removingCode === m.code;
                const isLast = idx === membersList.length - 1;

                // Match with stats if available
                const stat = membersWithStats.find(
                  (s) => (s.isYou && isYou) || (m.userId && s.userId === m.userId) || (m.code && s.code === m.code)
                );

                const taskCount = stat?.taskCount ?? 0;
                const onTimePercent = stat?.onTimePercent ?? 100;

                const rank = sortedStats.findIndex(
                  (sm) => (sm.isYou && isYou) || (sm.code && sm.code === m.code) || (m.userId && sm.userId === m.userId)
                ) + 1;
                const rankBadge = rank === 1 ? '👑 #1' : rank > 1 ? `#${rank}` : null;

                const isHouseholdOwner = m.userId === activeHousehold.ownerUid;

                return (
                  <View key={m.code || m.userId || m.name} style={[styles.memberRow, !isLast && styles.memberRowBorder]}>
                    <View style={[styles.memberAvatar, { backgroundColor: m.color || '#363E71' }]}>
                      <Text style={styles.memberAvatarText}>
                        {initials(m.name || '?')}
                      </Text>
                    </View>

                    <View style={styles.memberInfo}>
                      <View style={styles.memberNameRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {isYou ? `${hi ? 'आप' : 'You'} (${m.name})` : m.name}
                        </Text>
                        {rankBadge && taskCount > 0 && (
                          <View style={styles.rankBadge}>
                            <Text style={styles.rankBadgeText}>{rankBadge}</Text>
                          </View>
                        )}
                        <Text style={styles.memberRoleTag}>
                          {isHouseholdOwner ? (hi ? '👑 स्वामी' : '👑 Owner') : m.status === 'pending' ? (hi ? '⏳ अनुलंबित' : '⏳ Pending') : ''}
                        </Text>
                      </View>

                      {/* Performance stats & progress */}
                      <View style={styles.memberMetaRow}>
                        <Text style={styles.memberStat}>
                          {m.status === 'pending'
                            ? (hi ? 'आमंत्रण लंबित' : 'Invite pending')
                            : `${taskCount} ${hi ? 'कार्य' : 'tasks'}`}
                        </Text>
                        {m.status !== 'pending' && (
                          <>
                            <Text style={styles.memberBullet}>·</Text>
                            <Text style={styles.memberOnTimeText}>{onTimePercent}% {hi ? 'समय पर' : 'on-time'}</Text>
                          </>
                        )}
                      </View>

                      {m.status !== 'pending' && (
                        <View style={styles.progressBarBg}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${Math.min(100, Math.max(0, onTimePercent))}%`,
                                backgroundColor: onTimePercent >= 80 ? '#10B981' : onTimePercent >= 50 ? Colors.marigoldDeep : '#EF4444',
                              },
                            ]}
                          />
                        </View>
                      )}
                    </View>

                    {/* Owner can remove members (except themselves and household owner) */}
                    {isOwner && !isYou && !isHouseholdOwner && (
                      <TouchableRipple
                        onPress={() => handleRemoveMember(m)}
                        style={styles.removeBtn}
                        borderless
                        disabled={isBeingRemoved}
                        hitSlop={8}
                      >
                        {isBeingRemoved ? (
                          <ActivityIndicator size={16} color={Colors.inkSoft} />
                        ) : (
                          <AppIcon name="trash-outline" size={17} color="#C1502E" />
                        )}
                      </TouchableRipple>
                    )}
                  </View>
                );
              })}
            </Card.Content>
          </Card>

          <View style={styles.divider} />

          {/* ── Household Danger Actions ── */}
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
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23,27,54,0.48)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  hhIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  hhIcon: { fontSize: 24 },
  hhName: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
    color: Colors.ink,
  },
  hhMeta: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12.5,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.ivoryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },

  addMemberHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8EC',
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.35)',
    borderRadius: Radius.full,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  addMemberHeaderText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11.5,
    color: Colors.marigoldDeep,
  },

  // Members Section
  membersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    letterSpacing: 0.6,
    color: Colors.ink,
    textTransform: 'uppercase',
  },
  sectionSubLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkSoft,
  },
  membersCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    elevation: 1.5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  memberRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: Colors.white,
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 13,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: Colors.ink,
    maxWidth: 160,
  },
  rankBadge: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.4)',
  },
  rankBadgeText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 10,
    color: Colors.marigoldDeep,
  },
  memberRoleTag: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
  },
  memberMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  memberStat: {
    ...Typography.caption,
    fontSize: 11.5,
    color: Colors.inkSoft,
    fontFamily: 'Manrope_600SemiBold',
  },
  memberBullet: {
    color: Colors.inkFaint,
    fontSize: 12,
  },
  memberOnTimeText: {
    ...Typography.caption,
    fontSize: 11.5,
    color: Colors.tealDeep,
    fontFamily: 'Manrope_700Bold',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: Colors.ivoryLine,
    borderRadius: 2,
    marginTop: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  divider: {
    height: 1,
    backgroundColor: Colors.ivoryLine,
    marginVertical: 18,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#C1502E',
  },
  warnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warnBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#D97706',
  },
});
