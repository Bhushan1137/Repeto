import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Share, Linking, Platform, Image, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Card, TouchableRipple, TextInput as PaperInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'qrcode';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTasks } from '@/providers/TaskProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import type { AppNotification } from '@/types/notification';
import { useHousehold } from '@/hooks/useInsights';
import { TaskCard } from '@/components/TaskCard';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { TaskFormSheet } from '@/components/TaskFormSheet';
import { ProgressRing } from '@/components/ProgressRing';
import { ScreenShell, SectionHeader, EmptyState } from '@/components/ScreenShell';
import { Button } from '@/components/Button';
import { AppIcon } from '@/components/AppIcon';
import { ActivityFeed } from '@/components/ActivityFeed';
import { taskToFormValues } from '@/domain/preset';
import { userRepository } from '@/data/repositories/userRepository';
import {
  addHouseholdMember,
  householdMemberFromInvite,
  inviteMessage,
  normalizeInviteCode,
  pendingMemberFromCode,
  removeHouseholdMember,
  inviteProfileFromUser,
} from '@/domain/household';
import { Colors, Gradients, Radius, Typography } from '@/constants/theme';
import type { RepeatingTask } from '@/types';

export default function HouseholdScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const { tasks, completeTask, snoozeTask, skipTask, deleteTask, archiveTask, pinTask, duplicateTask, setTaskDueDate, updateTask, deleteHistoryEntry } = useTasks();
  const { showToast } = useToast();
  const { translate, language } = useTranslation();
  const { addNotification } = useNotifications();
  const { stats, members } = useHousehold(tasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [filterMemberCode, setFilterMemberCode] = useState<string | null>(null);

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  const [codeInput, setCodeInput] = useState('');
  const [addingCode, setAddingCode] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const editingTask = editingTaskId ? tasks.find((t) => t.id === editingTaskId) ?? null : null;
  const ringPercent = stats.total > 0 ? (stats.onTime / stats.total) * 100 : 0;
  const myCode = user?.householdCode ?? '';

  useEffect(() => {
    if (myCode) {
      QRCode.toDataURL(myCode, { margin: 1 })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.warn('[Repeato] QR generation failed', err));
    }
  }, [myCode]);

  const message = user ? inviteMessage(user) : '';

  const handleAction = async (action: () => Promise<void>) => {
    await action();
    setSelectedTaskId(null);
  };

  const shareAny = async () => {
    if (!message) return;
    await Share.share({ message });
  };

  const shareWhatsApp = async () => {
    if (!message) return;
    const encoded = encodeURIComponent(message);
    const url = Platform.OS === 'web' ? `https://wa.me/?text=${encoded}` : `whatsapp://send?text=${encoded}`;
    try {
      await Linking.openURL(url);
    } catch {
      await shareAny();
    }
  };

  const shareSms = async () => {
    if (!message) return;
    const encoded = encodeURIComponent(message);
    const url = `sms:${Platform.OS === 'ios' ? '&' : '?'}body=${encoded}`;
    try {
      await Linking.openURL(url);
    } catch {
      await shareAny();
    }
  };

  const addByCode = async (customCode?: string) => {
    if (!user) return;
    const code = normalizeInviteCode(customCode ?? codeInput);
    if (!code || code.length < 7) {
      showToast(translate('invalidInviteCode'));
      return;
    }
    if (code === user.householdCode) {
      showToast(translate('cannotAddOwnCode'));
      return;
    }
    if ((user.householdMembers ?? []).some((m) => normalizeInviteCode(m.code) === code)) {
      showToast(translate('memberAlreadyAdded'));
      return;
    }

    setAddingCode(true);
    const invite = await userRepository.resolveHouseholdInvite(code);
    const member = invite ? householdMemberFromInvite(invite) : pendingMemberFromCode(code);
    
    // 1. Add other user to my profile
    await updateUser(addHouseholdMember(user, member));

    // Add local notification
    await addNotification(
      'household',
      language === 'hi' ? 'परिवार का सदस्य जुड़ गया' : 'Household Member Linked',
      language === 'hi' ? `${member.name || code} को परिवार में जोड़ा गया।` : `Linked ${member.name || code} to your household.`
    );

    // 2. Add myself to other user's profile if registered
    if (invite && invite.userId) {
      try {
        const remoteB = await userRepository.loadRemote(invite.userId);
        if (remoteB) {
          const myInvite = inviteProfileFromUser(user);
          const meAsMember = householdMemberFromInvite(myInvite);
          const updatedB = addHouseholdMember(remoteB, meAsMember);
          await userRepository.saveOther(invite.userId, updatedB);

          // Add remote notification for User B
          const peerNotif: AppNotification = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'household',
            title: language === 'hi' ? 'नया परिवार सदस्य जुड़ा' : 'Household Member Joined',
            body: language === 'hi' ? `${user.name} आपके परिवार में शामिल हो गए हैं।` : `${user.name} joined your household.`,
            timestamp: new Date().toISOString(),
            read: false,
          };
          await userRepository.saveNotification(invite.userId, peerNotif);
        }
      } catch (err) {
        console.warn('[Repeato] Bidirectional household linking failed:', err);
      }
    }

    setAddingCode(false);
    setCodeInput('');
    showToast(invite ? translate('memberAdded') : translate('memberAddedPending'));
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setScannerVisible(false);
    if (data) {
      setCodeInput(data);
      await addByCode(data);
    }
  };

  const removeMember = async (code?: string) => {
    if (!user || !code) return;
    await updateUser(removeHouseholdMember(user, code));
  };

  // Sort members for the leaderboard
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => b.onTimePercent - a.onTimePercent);
  }, [members]);

  const filteredSharedTasks = useMemo(() => {
    let list = stats.shared;
    if (filterMemberCode) {
      list = list.filter((t) => {
        if (filterMemberCode === 'you') {
          return !t.assignedTo || t.assignedTo === user?.id;
        }
        return (
          t.sharedWith.some((m) => m.code === filterMemberCode || m.userId === filterMemberCode) ||
          t.assignedTo === filterMemberCode
        );
      });
    }
    return list;
  }, [stats.shared, filterMemberCode, user?.id]);

  return (
    <View style={styles.root}>
      <ScreenShell title={translate('hhTitle')} subtitle={translate('hhSub')}>
        {user ? (
          <Card style={styles.inviteCard} mode="elevated">
            <Card.Content>
              <Text style={styles.inviteLabel}>{translate('yourInviteCode')}</Text>
              <View style={styles.codeRow}>
                <Text style={styles.codeText}>{myCode}</Text>
                <View style={styles.codeActions}>
                  <TouchableRipple style={styles.shareIconBtn} onPress={() => setQrVisible(true)} borderless>
                    <AppIcon name="qr-code-outline" size={18} color={Colors.indigo950} />
                  </TouchableRipple>
                  <TouchableRipple style={styles.shareIconBtn} onPress={shareAny} borderless>
                    <AppIcon name="share-outline" size={18} color={Colors.indigo950} />
                  </TouchableRipple>
                </View>
              </View>
              <Text style={styles.inviteHint}>{translate('inviteCodeHint')}</Text>
              
              <View style={styles.shareRow}>
                <Button
                  title={translate('shareWhatsapp')}
                  onPress={shareWhatsApp}
                  style={styles.shareBtn}
                  variant="ghost"
                />
                <Button
                  title={translate('shareText')}
                  onPress={shareSms}
                  style={styles.shareBtn}
                  variant="ghost"
                />
              </View>

              <Text style={styles.joinLabel}>{translate('addMemberByCode')}</Text>
              <View style={styles.joinRow}>
                <PaperInput
                  mode="outlined"
                  value={codeInput}
                  onChangeText={setCodeInput}
                  autoCapitalize="characters"
                  placeholder="CODE123"
                  outlineColor={Colors.ivoryLine}
                  activeOutlineColor={Colors.marigoldDeep}
                  style={styles.codeInput}
                  textColor={Colors.ink}
                  right={
                    <PaperInput.Icon
                      icon={() => <AppIcon name="camera-outline" size={20} color={Colors.indigo950} />}
                      onPress={async () => {
                        if (!permission || !permission.granted) {
                          const res = await requestPermission();
                          if (!res.granted) {
                            showToast(language === 'hi' ? 'कैमरा अनुमति आवश्यक है' : 'Camera permission is required');
                            return;
                          }
                        }
                        setScannerVisible(true);
                      }}
                    />
                  }
                  theme={{
                    colors: {
                      background: Colors.white,
                    },
                  }}
                />
                <Button
                  title={translate('addContact')}
                  loading={addingCode}
                  onPress={() => addByCode()}
                  style={styles.joinBtn}
                />
              </View>
            </Card.Content>
          </Card>
        ) : null}

        {stats.total === 0 ? (
          <EmptyState
            icon="🏠"
            title={translate('householdEmptyTitle')}
            subtitle={translate('householdEmptySub')}
          />
        ) : (
          <Card style={styles.summaryCard} mode="elevated">
            <LinearGradient colors={[...Gradients.hero]} style={styles.summary}>
              <ProgressRing percent={ringPercent} color={Colors.marigold} size={64} stroke={6} />
              <View>
                <Text style={styles.summaryBig}>
                  {stats.onTime}/{stats.total}
                </Text>
                <Text style={styles.summaryLbl}>{translate('householdOnTime')}</Text>
              </View>
            </LinearGradient>
          </Card>
        )}

        <SectionHeader label={translate('members')} count={members.length} />
        <Card style={styles.memberCard} mode="elevated">
          <Card.Content style={styles.memberCardContent}>
            {members.map((m, idx) => {
              const key = m.isYou ? 'you' : (m.code || m.userId || m.name);
              const isSelected = filterMemberCode === key;
              const rank = sortedMembers.findIndex((sm) => (sm.isYou && m.isYou) || (sm.code && sm.code === m.code)) + 1;
              const rankLabel = rank === 1 ? '👑 #1' : `#${rank}`;

              return (
                <TouchableRipple
                  key={key}
                  onPress={() => setFilterMemberCode((prev) => (prev === key ? null : key))}
                  style={[styles.memberRowRipple, isSelected && styles.memberRowRippleActive]}
                  borderless
                >
                  <View style={[styles.memberRow, idx === members.length - 1 && styles.lastRow]}>
                    <View style={[styles.memberAvatar, { backgroundColor: m.color }, isSelected && styles.memberAvatarSelected]}>
                      <Text style={styles.memberAvatarText}>{m.short}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.memberName}>
                          {m.isYou ? `${translate('you')} (${m.name.split(' ')[0]})` : m.name}
                        </Text>
                        {m.status !== 'pending' && (
                          <View style={styles.rankBadge}>
                            <Text style={styles.rankBadgeText}>{rankLabel}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.memberMetaRow}>
                        <Text style={styles.memberStat}>
                          {m.status === 'pending' ? translate('pendingMember') : `${m.taskCount} ${translate('tasks')}`}
                        </Text>
                        {m.status !== 'pending' && (
                          <>
                            <Text style={styles.memberBullet}>·</Text>
                            <Text style={styles.memberOnTimeText}>{m.onTimePercent}% {translate('memberOnTime')}</Text>
                          </>
                        )}
                      </View>
                      {m.status !== 'pending' && (
                        <View style={styles.progressLineBg}>
                          <View style={[styles.progressLineFill, { width: `${m.onTimePercent}%` }]} />
                        </View>
                      )}
                    </View>
                    {!m.isYou && m.code ? (
                      <TouchableRipple onPress={() => removeMember(m.code)} style={styles.removeBtn} borderless>
                        <AppIcon name="close" size={16} color={Colors.inkFaint} />
                      </TouchableRipple>
                    ) : null}
                  </View>
                </TouchableRipple>
              );
            })}
          </Card.Content>
        </Card>

        <SectionHeader label={language === 'hi' ? 'हालिया गतिविधि' : 'Recent Activity'} />
        <ActivityFeed
          tasks={tasks}
          members={user?.householdMembers ?? []}
          currentUserId={user?.id}
          currentUserName={user?.name ?? 'You'}
          language={language}
        />

        <View style={styles.sharedHeaderRow}>
          <SectionHeader label={translate('sharedTasks')} count={filteredSharedTasks.length} />
          <TouchableRipple
            style={styles.customAddBtn}
            onPress={() => router.push('/(tabs)/add?household=true')}
            borderless
          >
            <View style={styles.customAddInner}>
              <AppIcon name="people" size={14} color={Colors.indigo950} />
              <Text style={styles.customAddText}>
                {language === 'hi' ? 'नया साझा कार्य' : 'Create Shared Task'}
              </Text>
            </View>
          </TouchableRipple>
        </View>
        {filteredSharedTasks.length === 0 ? (
          <Text style={styles.emptySub}>{translate('noSharedTasks')}</Text>
        ) : (
          filteredSharedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              language={language}
              onPress={() => setSelectedTaskId(task.id)}
              onCompletePress={() => completeTask(task.id)}
            />
          ))
        )}
      </ScreenShell>

      <TaskDetailSheet
        task={selectedTask}
        visible={!!selectedTask}
        language={language}
        translate={translate}
        onClose={() => setSelectedTaskId(null)}
        onComplete={(id, note) => handleAction(() => completeTask(id, note))}
        onSnooze={(id, days) => handleAction(() => snoozeTask(id, days))}
        onSkip={(id) => handleAction(() => skipTask(id))}
        onDelete={(id) => handleAction(() => deleteTask(id))}
        onArchive={(id) => handleAction(() => archiveTask(id))}
        onPin={(id) => handleAction(() => pinTask(id))}
        onDuplicate={(id) => { duplicateTask(id); setSelectedTaskId(null); }}
        onEdit={(id) => {
          setSelectedTaskId(null);
          setEditingTaskId(id);
        }}
        onSetDueDate={(id, date) => handleAction(() => setTaskDueDate(id, date))}
        onDeleteHistoryEntry={deleteHistoryEntry}
      />

      <TaskFormSheet
        visible={!!editingTask}
        language={language}
        translate={translate}
        heading={translate('editTask')}
        initial={editingTask ? taskToFormValues(editingTask, language) : null}
        initialShared={editingTask?.sharedWith}
        editingTaskId={editingTask?.id}
        mode="edit"
        saveLabel={translate('savePreset')}
        onClose={() => setEditingTaskId(null)}
        onSave={async (values, shared) => {
          if (!editingTaskId) return;
          await updateTask(editingTaskId, values, shared);
          setEditingTaskId(null);
        }}
      />

      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <View style={styles.qrCenteredView}>
          <Pressable style={styles.qrBackdrop} onPress={() => setQrVisible(false)} />
          <Card style={styles.qrSheet} mode="elevated">
            <Card.Content style={styles.qrContent}>
              <Text style={styles.qrTitle}>{language === 'hi' ? 'स्कैन कर आमंत्रण भेजें' : 'Scan to join household'}</Text>
              {qrDataUrl ? (
                <Image
                  source={{ uri: qrDataUrl }}
                  style={styles.qrImage}
                />
              ) : null}
              <Text style={styles.qrCodeText}>{myCode}</Text>
              <Button title={language === 'hi' ? 'बंद करें' : 'Close'} onPress={() => setQrVisible(false)} style={styles.qrCloseBtn} />
            </Card.Content>
          </Card>
        </View>
      </Modal>

      {/* QR Scanner Camera Modal */}
      <Modal visible={scannerVisible} transparent={false} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scanTarget} />
            <Text style={styles.scannerInstructions}>
              {language === 'hi' ? 'आमंत्रण कोड स्कैन करने के लिए क्यूआर कोड को फ्रेम में रखें' : 'Align QR code inside the frame to scan'}
            </Text>
            <Button
              title={language === 'hi' ? 'रद्द करें' : 'Cancel'}
              onPress={() => setScannerVisible(false)}
              style={styles.scannerCloseBtn}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inviteCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: 14,
    elevation: 2,
  },
  inviteLabel: { ...Typography.label, color: Colors.inkFaint, marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  codeActions: { flexDirection: 'row', gap: 8 },
  qrCenteredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23, 27, 54, 0.45)',
  },
  qrSheet: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    width: 290,
    elevation: 8,
    overflow: 'hidden',
  },
  qrContent: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16,
  },
  qrTitle: {
    ...Typography.title,
    fontSize: 16,
    color: Colors.ink,
    textAlign: 'center',
  },
  qrImage: {
    width: 180,
    height: 180,
  },
  qrCodeText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 22,
    color: Colors.marigoldDeep,
    letterSpacing: 2,
  },
  qrCloseBtn: {
    width: '90%',
    marginVertical: 0,
  },
  codeText: {
    flex: 1,
    fontFamily: 'Fraunces_700Bold',
    fontSize: 28,
    letterSpacing: 1.8,
    color: Colors.indigo950,
  },
  shareIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.ivoryDim,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inviteHint: { ...Typography.bodySm, color: Colors.inkSoft, marginTop: 6, lineHeight: 19 },
  shareRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  shareBtn: {
    flex: 1,
    marginVertical: 0,
  },
  joinLabel: { ...Typography.label, color: Colors.inkFaint, marginTop: 18, marginBottom: 8 },
  joinRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  codeInput: {
    flex: 1,
    fontSize: 15,
    height: 48,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 1,
  },
  joinBtn: { minWidth: 82, marginVertical: 0 },
  summaryCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: 14,
    elevation: 2,
  },
  summary: {
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  summaryBig: { fontFamily: 'Fraunces_700Bold', fontSize: 28, color: Colors.onDark },
  summaryLbl: { ...Typography.caption, color: Colors.onDarkMuted, marginTop: 2 },
  memberCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 12,
    elevation: 1.5,
    overflow: 'hidden',
  },
  memberCardContent: {
    padding: 0,
  },
  memberRowRipple: {
    width: '100%',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  memberAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: Colors.white, fontFamily: 'Manrope_800ExtraBold', fontSize: 12 },
  memberInfo: { flex: 1 },
  memberName: { ...Typography.title, fontSize: 14, color: Colors.ink, marginBottom: 2 },
  memberMetaRow: { flexDirection: 'row', alignItems: 'center' },
  memberStat: { ...Typography.caption, color: Colors.inkSoft, fontSize: 11 },
  memberBullet: { color: Colors.inkFaint, marginHorizontal: 4, fontSize: 10 },
  memberOnTimeText: { ...Typography.caption, color: Colors.tealDeep, fontSize: 11, fontFamily: 'Manrope_700Bold' },
  progressLineBg: {
    height: 3,
    backgroundColor: Colors.ivoryLine,
    borderRadius: 2,
    marginTop: 6,
    width: '80%',
    overflow: 'hidden',
  },
  progressLineFill: {
    height: '100%',
    backgroundColor: Colors.teal,
    borderRadius: 2,
  },
  removeBtn: {
    padding: 6,
    borderRadius: 999,
  },
  emptySub: { ...Typography.bodySm, color: Colors.inkSoft, textAlign: 'center', paddingVertical: 16, lineHeight: 20 },

  memberRowRippleActive: {
    backgroundColor: 'rgba(232,163,61,0.06)',
  },
  memberAvatarSelected: {
    borderWidth: 2,
    borderColor: Colors.marigold,
  },
  rankBadge: {
    backgroundColor: Colors.marigold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  rankBadgeText: {
    color: Colors.white,
    fontSize: 9.5,
    fontFamily: 'Manrope_800ExtraBold',
  },
  sharedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 4,
  },
  customAddBtn: {
    backgroundColor: Colors.marigold,
    borderRadius: Radius.full,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: Colors.marigold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  customAddInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  customAddText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 11,
    color: Colors.indigo950,
  },

  // Scanner Styles
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTarget: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: Colors.marigold,
    backgroundColor: 'transparent',
    borderRadius: Radius.md,
    marginBottom: 24,
  },
  scannerInstructions: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginHorizontal: 40,
    marginBottom: 30,
    lineHeight: 20,
    fontFamily: 'Manrope_500Medium',
  },
  scannerCloseBtn: {
    minWidth: 150,
  },
});
