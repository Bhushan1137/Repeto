import { AppIcon } from '@/components/AppIcon';
import { Colors, Radius, Typography } from '@/constants/theme';
import { listHouseholds, memberColor, toSharedMember } from '@/domain/household';
import { initials } from '@/domain/insights';
import type { TranslationKey } from '@/i18n';
import type { HouseholdMemberProfile, Language, SharedMember, UserProfile } from '@/types';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text, TouchableRipple } from 'react-native-paper';

export interface TaskScopeSectionProps {
  householdId: string | null;
  assignedTo: string | null;
  isRotating: boolean;
  rotationMembers: string[];
  user: UserProfile | null;
  language: Language;
  translate: (key: TranslationKey, params?: Record<string, string | number>) => string;
  onChange: (patch: {
    householdId?: string | null;
    assignedTo?: string | null;
    isRotating?: boolean;
    rotationMembers?: string[];
    shared?: SharedMember[];
  }) => void;
}

export function TaskScopeSection({
  householdId,
  assignedTo,
  isRotating,
  rotationMembers: _rotationMembers,
  user,
  language: _language,
  translate,
  onChange,
}: TaskScopeSectionProps) {
  const userHouseholds = useMemo(() => (user ? listHouseholds(user) : []), [user]);

  const selectedHousehold = useMemo(() => {
    if (!householdId) return null;
    return userHouseholds.find((h) => h.id === householdId) ?? null;
  }, [userHouseholds, householdId]);

  // Robust member resolution: combines household.members, user.householdMembers, and guarantees current user is included
  const householdMembers = useMemo(() => {
    const rawList: HouseholdMemberProfile[] = [];
    if (selectedHousehold?.members && selectedHousehold.members.length > 0) {
      rawList.push(...selectedHousehold.members);
    } else if (user?.householdMembers && user.householdMembers.length > 0) {
      rawList.push(...user.householdMembers);
    }

    const map = new Map<string, HouseholdMemberProfile>();
    rawList.forEach((m) => {
      const key = m.userId || m.code;
      if (key && !map.has(key)) {
        map.set(key, m);
      }
    });

    // Ensure current logged-in user is ALWAYS in the list
    if (user) {
      const userKey = user.id || user.userCode || 'me';
      const userCode = user.userCode || user.id || 'YOU';
      const alreadyInList = Array.from(map.values()).some(
        (m) => (user.id && m.userId === user.id) || (user.userCode && m.code === user.userCode)
      );
      if (!alreadyInList) {
        map.set(userKey, {
          code: userCode,
          userId: user.id,
          name: user.name || 'You',
          color: memberColor(user.id || userCode),
          addedAt: new Date().toISOString(),
          status: 'active',
        });
      }
    }

    return Array.from(map.values());
  }, [selectedHousehold, user]);

  // Explicit active mode state so UI never unexpectedly bounces back
  const [activeMode, setActiveMode] = useState<'open' | 'assigned' | 'rotating'>(() => {
    if (isRotating) return 'rotating';
    if (assignedTo) return 'assigned';
    return 'open';
  });

  // Keep activeMode in sync when props change externally (e.g. task edit initial load)
  useEffect(() => {
    if (isRotating) {
      setActiveMode('rotating');
    } else if (assignedTo) {
      setActiveMode('assigned');
    }
  }, [isRotating, assignedTo]);

  const handleSelectScope = (targetHhId: string | null) => {
    if (!targetHhId) {
      // Switched to Personal
      setActiveMode('open');
      onChange({
        householdId: null,
        assignedTo: null,
        isRotating: false,
        rotationMembers: [],
        shared: [],
      });
      return;
    }

    const targetHh = userHouseholds.find((h) => h.id === targetHhId);
    const shared = (targetHh?.members ?? []).map(toSharedMember);
    setActiveMode('open');
    onChange({
      householdId: targetHhId,
      assignedTo: null, // Default to Open to All
      isRotating: false,
      rotationMembers: [],
      shared,
    });
  };

  const handleSelectMode = (mode: 'open' | 'assigned' | 'rotating') => {
    setActiveMode(mode);

    const allMemberIds = householdMembers.map((m) => m.userId || m.code);
    const defaultMember =
      user?.id && allMemberIds.includes(user.id)
        ? user.id
        : (user?.userCode && allMemberIds.includes(user.userCode)
          ? user.userCode
          : allMemberIds[0] ?? (user?.id || user?.userCode || 'me'));

    if (mode === 'open') {
      onChange({
        assignedTo: null,
        isRotating: false,
        rotationMembers: [],
      });
    } else if (mode === 'assigned') {
      const currentValid = assignedTo && allMemberIds.includes(assignedTo);
      const targetAssignee = currentValid ? assignedTo : defaultMember;
      onChange({
        assignedTo: targetAssignee,
        isRotating: false,
        rotationMembers: [],
      });
    } else if (mode === 'rotating') {
      const currentValid = assignedTo && allMemberIds.includes(assignedTo);
      const targetAssignee = currentValid ? assignedTo : defaultMember;
      onChange({
        isRotating: true,
        rotationMembers: allMemberIds,
        assignedTo: targetAssignee,
      });
    }
  };

  const handleSelectMember = (member: HouseholdMemberProfile) => {
    const memberId = member.userId || member.code;
    setActiveMode('assigned');
    onChange({
      assignedTo: memberId,
      isRotating: false,
      rotationMembers: [],
    });
  };

  const handleSelectStartingMember = (member: HouseholdMemberProfile) => {
    const memberId = member.userId || member.code;
    onChange({
      assignedTo: memberId,
      isRotating: true,
      rotationMembers: householdMembers.map((m) => m.userId || m.code),
    });
  };

  return (
    <View style={styles.container}>
      {/* ── TIER 1: TASK SCOPE ─────────────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeNum}>5</Text>
        </View>
        <Text style={styles.sectionLabel}>{translate('taskScopeLabel')}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scopePillsRow}
      >
        {/* Personal Pill */}
        <Pressable
          onPress={() => handleSelectScope(null)}
          style={[styles.scopePill, !householdId && styles.scopePillActive]}
        >
          <Text style={styles.scopePillIcon}>👤</Text>
          <Text style={[styles.scopePillText, !householdId && styles.scopePillTextActive]}>
            {translate('scopePersonal')}
          </Text>
        </Pressable>

        {/* Household Context Pills */}
        {userHouseholds.map((hh) => {
          const isSelected = householdId === hh.id;
          return (
            <Pressable
              key={hh.id}
              onPress={() => handleSelectScope(hh.id)}
              style={[styles.scopePill, isSelected && styles.scopePillActive]}
            >
              <Text style={styles.scopePillIcon}>{hh.icon || '🏠'}</Text>
              <Text style={[styles.scopePillText, isSelected && styles.scopePillTextActive]}>
                {hh.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Helper text when Personal is selected */}
      {!householdId && (
        <View style={styles.personalHintContainer}>
          <AppIcon name="lock-closed-outline" size={14} color={Colors.inkSoft} />
          <Text style={styles.personalHintText}>{translate('scopePersonalSub')}</Text>
        </View>
      )}

      {/* ── TIER 2: RESPONSIBILITY & ASSIGNMENT (Household only) ───────── */}
      {householdId && (
        <Card style={styles.responsibilityCard} mode="elevated">
          <Card.Content style={styles.responsibilityContent}>
            <View style={styles.respHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppIcon name="people-outline" size={18} color={Colors.tealDeep} />
                <Text style={styles.respHeading}>{translate('responsibilityLabel')}</Text>
              </View>
              {selectedHousehold && (
                <View style={styles.hhTag}>
                  <Text style={styles.hhTagText}>
                    {selectedHousehold.icon || '🏠'} {selectedHousehold.name} ({householdMembers.length})
                  </Text>
                </View>
              )}
            </View>

            {/* 3-Way Mode Segmented Control */}
            <View style={styles.modeTabsRow}>
              {/* 1. Open to All */}
              <TouchableRipple
                style={[styles.modeTab, activeMode === 'open' && styles.modeTabActive]}
                onPress={() => handleSelectMode('open')}
                borderless
              >
                <View style={styles.modeTabInner}>
                  <AppIcon
                    name="globe-outline"
                    size={16}
                    color={activeMode === 'open' ? Colors.tealDeep : Colors.inkSoft}
                  />
                  <Text
                    style={[
                      styles.modeTabLabel,
                      activeMode === 'open' && styles.modeTabLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {translate('respOpenTab') || translate('respOpen')}
                  </Text>
                </View>
              </TouchableRipple>

              {/* 2. Specific Member */}
              <TouchableRipple
                style={[styles.modeTab, activeMode === 'assigned' && styles.modeTabActive]}
                onPress={() => handleSelectMode('assigned')}
                borderless
              >
                <View style={styles.modeTabInner}>
                  <AppIcon
                    name="person-outline"
                    size={16}
                    color={activeMode === 'assigned' ? Colors.tealDeep : Colors.inkSoft}
                  />
                  <Text
                    style={[
                      styles.modeTabLabel,
                      activeMode === 'assigned' && styles.modeTabLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {translate('respAssignedTab') || translate('respAssigned')}
                  </Text>
                </View>
              </TouchableRipple>

              {/* 3. Rotate Turns */}
              <TouchableRipple
                style={[styles.modeTab, activeMode === 'rotating' && styles.modeTabActive]}
                onPress={() => handleSelectMode('rotating')}
                borderless
              >
                <View style={styles.modeTabInner}>
                  <AppIcon
                    name="refresh-outline"
                    size={16}
                    color={activeMode === 'rotating' ? Colors.marigoldDeep : Colors.inkSoft}
                  />
                  <Text
                    style={[
                      styles.modeTabLabel,
                      activeMode === 'rotating' && styles.modeTabLabelActiveRotating,
                    ]}
                    numberOfLines={1}
                  >
                    {translate('respRotatingTab') || translate('respRotating')}
                  </Text>
                </View>
              </TouchableRipple>
            </View>

            {/* ── Mode 1: Open to All Details ── */}
            {activeMode === 'open' && (
              <View style={styles.modeExplainerBox}>
                <View style={styles.explainerIconWrap}>
                  <AppIcon name="globe-outline" size={20} color={Colors.tealDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.explainerTitle}>{translate('respOpen')}</Text>
                  <Text style={styles.modeExplainerText}>{translate('respOpenSub')}</Text>
                  <View style={styles.claimBadge}>
                    <AppIcon name="checkmark-circle-outline" size={13} color="#059669" />
                    <Text style={styles.claimBadgeText}>{"Shows 'Claim Task' button on detail screen"}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* ── Mode 2: Assign to Member Details ── */}
            {activeMode === 'assigned' && (
              <View style={styles.membersSection}>
                <Text style={styles.subSectionTitle}>{translate('respAssignedSub')}:</Text>
                <View style={styles.memberChipsGrid}>
                  {householdMembers.map((m) => {
                    const memberId = m.userId || m.code;
                    const isSelected = assignedTo === memberId;
                    const isYou = user?.id === m.userId || user?.userCode === m.code;
                    return (
                      <Pressable
                        key={m.code || m.userId}
                        onPress={() => handleSelectMember(m)}
                        style={[
                          styles.memberChip,
                          isSelected && styles.memberChipSelected,
                        ]}
                      >
                        <View style={[styles.memberAvatar, { backgroundColor: m.color }]}>
                          <Text style={styles.memberAvatarText}>{initials(m.name)}</Text>
                        </View>
                        <View style={styles.memberChipTextWrap}>
                          <Text
                            style={[
                              styles.memberChipName,
                              isSelected && styles.memberChipNameSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {isYou ? `${m.name} (${translate('you')})` : m.name}
                          </Text>
                          <Text style={[styles.memberChipSub, isSelected && styles.memberChipSubSelected]}>
                            {isSelected ? '✓ Assigned' : 'Tap to assign'}
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={styles.checkBadge}>
                            <AppIcon name="checkmark" size={12} color={Colors.white} />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── Mode 3: Rotate Turns Details ── */}
            {activeMode === 'rotating' && (
              <View style={styles.rotationSection}>
                <Text style={styles.subSectionTitle}>{translate('respRotatingSub')}</Text>
                <View style={styles.turnOrderBox}>
                  <View style={styles.turnOrderHeaderRow}>
                    <Text style={styles.turnOrderLabel}>{translate('turnOrder')}:</Text>
                    <Text style={styles.turnOrderHint}>Tap member to start first</Text>
                  </View>
                  <View style={styles.turnSequenceRow}>
                    {householdMembers.map((m, idx) => {
                      const memberId = m.userId || m.code;
                      const isStarting = assignedTo === memberId || (!assignedTo && idx === 0);
                      const isFirst = idx === 0;
                      return (
                        <React.Fragment key={m.code || m.userId}>
                          {!isFirst && (
                            <Text style={styles.turnArrow}>➔</Text>
                          )}
                          <Pressable
                            onPress={() => handleSelectStartingMember(m)}
                            style={[
                              styles.turnPill,
                              isStarting && styles.turnPillStarting,
                            ]}
                          >
                            <View style={[styles.turnDot, { backgroundColor: m.color }]} />
                            <Text style={[styles.turnName, isStarting && styles.turnNameStarting]} numberOfLines={1}>
                              {user?.id === m.userId ? translate('you') : m.name}
                            </Text>
                            {isStarting && (
                              <View style={styles.firstBadge}>
                                <Text style={styles.firstBadgeText}>1st</Text>
                              </View>
                            )}
                          </Pressable>
                        </React.Fragment>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(228, 219, 199, 0.7)',
    shadowColor: '#171B36',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    marginTop: 18,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(245, 197, 110, 0.25)',
    borderWidth: 1,
    borderColor: Colors.marigoldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeNum: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 11,
    color: Colors.marigoldDeep,
  },
  sectionLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12.5,
    color: Colors.ink,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  scopePillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
  },
  scopePillActive: {
    backgroundColor: Colors.tealDeep,
    borderColor: Colors.tealDeep,
  },
  scopePillIcon: {
    fontSize: 14,
  },
  scopePillText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: Colors.ink,
  },
  scopePillTextActive: {
    color: Colors.white,
    fontFamily: 'Manrope_700Bold',
  },
  personalHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(23, 27, 54, 0.04)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    marginTop: 10,
  },
  personalHintText: {
    ...Typography.caption,
    fontSize: 11.5,
    color: Colors.inkSoft,
    fontFamily: 'Manrope_500Medium',
  },

  // Responsibility Card
  responsibilityCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    elevation: 2,
    overflow: 'hidden',
  },
  responsibilityContent: {
    padding: 14,
  },
  respHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  respHeading: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13.5,
    color: Colors.ink,
  },
  hhTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  hhTagText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10.5,
    color: Colors.inkSoft,
  },
  modeTabsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(27,31,59,0.06)',
    borderRadius: Radius.md,
    padding: 4,
    gap: 6,
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  modeTabActive: {
    backgroundColor: Colors.white,
    elevation: 2,
    shadowColor: Colors.indigo950,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  modeTabInner: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    gap: 4,
  },
  modeTabLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  modeTabLabelActive: {
    color: Colors.tealDeep,
    fontFamily: 'Manrope_700Bold',
  },
  modeTabLabelActiveRotating: {
    color: Colors.marigoldDeep,
    fontFamily: 'Manrope_700Bold',
  },

  // Explainer Box for Open mode
  modeExplainerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
  },
  explainerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  explainerTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: '#065F46',
    marginBottom: 2,
  },
  modeExplainerText: {
    ...Typography.caption,
    fontSize: 11.5,
    color: '#047857',
    fontFamily: 'Manrope_500Medium',
    lineHeight: 16,
  },
  claimBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    backgroundColor: '#ECFDF5',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: Radius.xs,
    alignSelf: 'flex-start',
  },
  claimBadgeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    color: '#059669',
  },

  // Members Grid for Assigned mode
  membersSection: {
    marginTop: 2,
  },
  subSectionTitle: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.inkSoft,
    marginBottom: 10,
    fontFamily: 'Manrope_600SemiBold',
  },
  memberChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    minWidth: '47%',
    flexGrow: 1,
  },
  memberChipSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: Colors.tealDeep,
  },
  memberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: Colors.white,
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 11,
  },
  memberChipTextWrap: {
    flex: 1,
  },
  memberChipName: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.ink,
  },
  memberChipNameSelected: {
    color: Colors.tealDeep,
  },
  memberChipSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 9.5,
    color: Colors.inkFaint,
    marginTop: 1,
  },
  memberChipSubSelected: {
    color: '#059669',
    fontFamily: 'Manrope_600SemiBold',
  },
  checkBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Rotation section
  rotationSection: {
    marginTop: 2,
  },
  turnOrderBox: {
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    gap: 8,
  },
  turnOrderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  turnOrderLabel: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 10.5,
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  turnOrderHint: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 10,
    color: '#92400E',
    fontStyle: 'italic',
  },
  turnSequenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  turnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  turnPillStarting: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
    borderWidth: 1.5,
  },
  turnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  turnName: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11.5,
    color: Colors.ink,
  },
  turnNameStarting: {
    fontFamily: 'Manrope_800ExtraBold',
    color: '#92400E',
  },
  firstBadge: {
    backgroundColor: '#D97706',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.xs,
    marginLeft: 2,
  },
  firstBadgeText: {
    color: Colors.white,
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 9,
  },
  turnArrow: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: 'bold',
  },
});
