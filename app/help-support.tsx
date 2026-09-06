import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { collection, doc, setDoc, query, where, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { getFirestoreDb, getFirebaseAuth } from '@/services/firebase/app';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/providers/ToastProvider';
import { useNetworkStatus } from '@/providers/AppProviders';
import { AppIcon } from '@/components/AppIcon';

import { Button } from '@/components/Button';
import { Colors, Radius, Typography } from '@/constants/theme';

interface TicketReply {
  sender: 'user' | 'admin';
  message: string;
  timestamp: string;
}

interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  replies: TicketReply[];
}

export default function HelpSupportScreen() {
  const router = useRouter();
  const { translate, language } = useTranslation();
  const { showToast } = useToast();
  const { isOnline } = useNetworkStatus();
  
  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;

  // Tickets lists
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('low');
  const [submitting, setSubmitting] = useState(false);

  // Detail Modal states
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [lastSendTime, setLastSendTime] = useState(0);

  const checkSpamCooldown = (): boolean => {
    const elapsed = Date.now() - lastSendTime;
    if (elapsed < 5000) {
      const secondsLeft = Math.ceil((5000 - elapsed) / 1000);
      showToast(
        language === 'hi'
          ? `कृपया बहुत तेज़ मैसेज भेजने से बचें। ${secondsLeft} सेकंड प्रतीक्षा करें।`
          : `Please avoid sending messages too fast. Wait ${secondsLeft}s.`
      );
      return false;
    }
    return true;
  };

  // 1. Subscribe to support tickets for the current user
  useEffect(() => {
    if (!db || !user) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'support_tickets'),
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: SupportTicket[] = [];
      snap.forEach((doc) => {
        list.push(doc.data() as SupportTicket);
      });
      // Sort by creation time descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTickets(list);
      setLoading(false);
      
      // Update selected ticket in real time if open
      if (selectedTicket) {
        const updated = list.find((t) => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    });

    return () => unsub();
  }, [db, user, selectedTicket?.id]);

  // 2. Submit new ticket
  const handleSubmitTicket = async () => {
    if (!isOnline) {
      showToast(translate('offlineSupportAction'));
      return;
    }
    if (!db || !user) {
      showToast(language === 'hi' ? 'त्रुटि: प्रमाणीकरण आवश्यक है' : 'Error: Authentication required');
      return;
    }
    if (!subject.trim() || !message.trim()) {
      showToast(language === 'hi' ? 'कृपया सभी फ़ील्ड भरें' : 'Please fill out all fields');
      return;
    }
    if (!checkSpamCooldown()) return;

    setSubmitting(true);
    const ticketId = `tkt_${Date.now()}`;
    const newTicket: SupportTicket = {
      id: ticketId,
      userId: user.uid,
      userName: user.displayName || 'Repeato User',
      userEmail: user.email || '',
      subject: subject.trim(),
      message: message.trim(),
      priority,
      status: 'open',
      createdAt: new Date().toISOString(),
      replies: [],
    };

    try {
      await setDoc(doc(db, 'support_tickets', ticketId), newTicket);
      setSubject('');
      setMessage('');
      setPriority('low');
      setLastSendTime(Date.now());
      showToast(language === 'hi' ? 'टिकट सफलतापूर्वक सबमिट किया गया!' : 'Ticket submitted successfully!');
    } catch (err) {
      console.error(err);
      showToast(language === 'hi' ? 'टिकट सबमिट करने में विफल' : 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. User reply submission
  const handleSendReply = async () => {
    if (!isOnline) {
      showToast(translate('offlineSupportAction'));
      return;
    }
    if (!db || !selectedTicket || !replyText.trim()) return;
    if (!checkSpamCooldown()) return;

    
    if (selectedTicket.replies && selectedTicket.replies.length >= 25) {
      showToast(
        language === 'hi'
          ? 'टिकट में मैसेज की सीमा पूरी हो गई है। कृपया नया टिकट बनाएं।'
          : 'Ticket reply limit reached. Please open a new support ticket.'
      );
      return;
    }

    setSendingReply(true);
    const replyObj: TicketReply = {
      sender: 'user',
      message: replyText.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      const ticketRef = doc(db, 'support_tickets', selectedTicket.id);
      await updateDoc(ticketRef, {
        replies: arrayUnion(replyObj),
        status: 'open', // Re-open status so admin gets flagged
      });
      setReplyText('');
      setLastSendTime(Date.now());
    } catch (err) {
      console.error(err);
      showToast(language === 'hi' ? 'जवाब भेजने में विफल' : 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return { text: '#D97706', bg: '#FEF3C7' };
      case 'in_progress':
        return { text: '#2563EB', bg: '#DBEAFE' };
      case 'resolved':
        return { text: '#059669', bg: '#D1FAE5' };
      default:
        return { text: '#6B7280', bg: '#F3F4F6' };
    }
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.root}>
      {/* Header Row */}
      <View style={styles.header}>
        <TouchableRipple
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }}
          style={styles.backBtn}
          borderless
        >
          <AppIcon name="chevron-back" size={22} color={Colors.indigo950} />
        </TouchableRipple>
        <Text style={styles.headerTitle}>{language === 'hi' ? 'सहायता और टिकट' : 'Help & Support'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Create Ticket Form */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text style={styles.sectionTitle}>
              {language === 'hi' ? 'नया टिकट बनाएँ' : 'Submit a Support Ticket'}
            </Text>
            
            <Text style={styles.label}>{language === 'hi' ? 'विषय' : 'Subject'}</Text>
            <TextInput
              style={styles.input}
              placeholder={language === 'hi' ? 'शीर्षक लिखें...' : 'e.g. Sync Error'}
              placeholderTextColor={Colors.inkFaint}
              value={subject}
              onChangeText={setSubject}
              maxLength={100}
              testID="support-subject-input"
            />
            <Text style={styles.counterText}>{subject.length}/100</Text>

            <Text style={styles.label}>{language === 'hi' ? 'विवरण' : 'Message'}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder={language === 'hi' ? 'कृपया अपनी समस्या यहाँ विस्तार से लिखें...' : 'Explain the issue you are facing...'}
              placeholderTextColor={Colors.inkFaint}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              maxLength={1000}
              testID="support-message-input"
            />
            <Text style={styles.counterText}>{message.length}/1000</Text>

            <Text style={styles.label}>{language === 'hi' ? 'प्राथमिकता' : 'Priority'}</Text>
            <View style={styles.priorityGroup}>
              {(['low', 'medium', 'high'] as const).map((p) => {
                const active = priority === p;
                const labels = { low: 'Low', medium: 'Medium', high: 'High' };
                const hiLabels = { low: 'निम्न', medium: 'मध्यम', high: 'उच्च' };
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPriority(p)}
                    testID={`support-priority-pill-${p}`}
                    style={[
                      styles.priorityPill,
                      active && styles.priorityPillActive,
                      active && p === 'high' && styles.priorityHighActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        active && styles.priorityTextActive,
                      ]}
                    >
                      {language === 'hi' ? hiLabels[p] : labels[p]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Button
              title={language === 'hi' ? 'सबमिट करें' : 'Submit Ticket'}
              onPress={handleSubmitTicket}
              loading={submitting}
              style={styles.submitBtn}
              testID="support-submit-btn"
            />
          </Card.Content>
        </Card>

        {/* Support History */}
        <Text style={styles.historyHeading}>
          {language === 'hi' ? 'आपके टिकट' : 'Your Ticket History'}
        </Text>

        {loading ? (
          <Text style={styles.loadingText}>
            {language === 'hi' ? 'लोड हो रहा है...' : 'Loading ticket history...'}
          </Text>
        ) : tickets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>💬</Text>
            <Text style={styles.emptyText}>
              {language === 'hi' ? 'कोई टिकट नहीं मिला' : 'No support tickets yet.'}
            </Text>
          </View>
        ) : (
          tickets.map((t) => {
            const badge = getStatusColor(t.status);
            return (
              <Card key={t.id} style={styles.ticketCard} onPress={() => setSelectedTicket(t)}>
                <Card.Content style={styles.ticketCardContent}>
                  <View style={styles.ticketHeaderRow}>
                    <Text style={styles.ticketSubject} numberOfLines={1}>{t.subject}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                        {t.status === 'in_progress' ? 'In Progress' : t.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.ticketPreview} numberOfLines={2}>{t.message}</Text>
                  <View style={styles.ticketFooterRow}>
                    <Text style={styles.ticketDate}>{formatTime(t.createdAt)}</Text>
                    {t.replies.length > 0 && (
                      <View style={styles.repliesIndicator}>
                        <AppIcon name="chatbox-ellipses-outline" size={14} color={Colors.teal} />
                        <Text style={styles.repliesCountText}>
                          {t.replies.length} {t.replies.length === 1 ? 'reply' : 'replies'}
                        </Text>
                      </View>
                    )}
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Ticket Details Chat Modal */}
      {selectedTicket && (
        <Modal
          visible={selectedTicket !== null}
          animationType="slide"
          onRequestClose={() => setSelectedTicket(null)}
        >
          <KeyboardAvoidingView
            style={styles.modalRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableRipple onPress={() => setSelectedTicket(null)} style={styles.backBtn} borderless>
                <AppIcon name="close" size={24} color={Colors.indigo950} />
              </TouchableRipple>
              <View style={styles.modalHeaderTitleBox}>
                <Text style={styles.modalHeaderTitle} numberOfLines={1}>{selectedTicket.subject}</Text>
                <Text style={styles.modalHeaderSub}>ID: {selectedTicket.id}</Text>
              </View>
            </View>

            {/* Chat Thread */}
            <ScrollView contentContainerStyle={styles.chatThreadContainer} showsVerticalScrollIndicator={true}>
              {/* Original Message */}
              <View style={styles.userBubble}>
                <Text style={styles.chatSenderName}>{selectedTicket.userName}</Text>
                <Text style={styles.chatMessageText}>{selectedTicket.message}</Text>
                <Text style={styles.chatTimeText}>{formatTime(selectedTicket.createdAt)}</Text>
              </View>

              {/* Replies list */}
              {selectedTicket.replies?.map((r, index) => {
                const isAdmin = r.sender === 'admin';
                return (
                  <View
                    key={index}
                    style={[
                      styles.replyBubble,
                      isAdmin ? styles.adminBubble : styles.userBubble,
                    ]}
                  >
                    <Text style={styles.chatSenderName}>
                      {isAdmin ? 'Repeato Support' : selectedTicket.userName}
                    </Text>
                    <Text style={styles.chatMessageText}>{r.message}</Text>
                    <Text style={styles.chatTimeText}>{formatTime(r.timestamp)}</Text>
                  </View>
                );
              })}
            </ScrollView>

            {/* Quick Reply footer */}
            <View style={styles.replyFooter}>
              <TextInput
                style={styles.replyInput}
                placeholder={language === 'hi' ? 'जवाब लिखें...' : 'Type a reply...'}
                placeholderTextColor={Colors.inkFaint}
                value={replyText}
                onChangeText={setReplyText}
                multiline
                maxLength={1000}
              />
              <TouchableRipple
                onPress={handleSendReply}
                disabled={sendingReply || !replyText.trim()}
                style={[
                  styles.sendBtn,
                  (!replyText.trim() || sendingReply) && styles.sendBtnDisabled,
                ]}
                borderless
              >
                <AppIcon name="send-outline" size={18} color={Colors.white} />
              </TouchableRipple>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    height: Platform.OS === 'ios' ? 95 : 70,
    paddingTop: Platform.OS === 'ios' ? 45 : 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    ...Typography.body,
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
    color: Colors.indigo950,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 16,
    color: Colors.indigo950,
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12.5,
    color: Colors.inkSoft,
    marginTop: 12,
    marginBottom: 6,
  },
  counterText: {
    alignSelf: 'flex-end',
    fontSize: 10,
    color: Colors.inkFaint,
    marginTop: 4,
    fontFamily: 'Manrope_500Medium',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    borderRadius: Radius.sm,
    backgroundColor: Colors.ivoryDim,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14.5,
    fontFamily: 'Manrope_500Medium',
    color: Colors.ink,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  priorityGroup: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 4,
  },
  priorityPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    backgroundColor: Colors.white,
  },
  priorityPillActive: {
    backgroundColor: Colors.marigold,
    borderColor: Colors.marigold,
  },
  priorityHighActive: {
    backgroundColor: Colors.clay,
    borderColor: Colors.clay,
  },
  priorityText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12.5,
    color: Colors.inkSoft,
  },
  priorityTextActive: {
    color: Colors.white,
  },
  submitBtn: {
    marginTop: 20,
  },
  historyHeading: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 15.5,
    color: Colors.indigo950,
    marginBottom: 12,
  },
  loadingText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginTop: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13.5,
    color: Colors.inkSoft,
  },
  ticketCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    marginBottom: 10,
    borderColor: Colors.ivoryLine,
    borderWidth: 1,
  },
  ticketCardContent: {
    padding: 12,
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketSubject: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14.5,
    color: Colors.indigo950,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  statusBadgeText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 9,
  },
  ticketPreview: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12.5,
    color: Colors.inkSoft,
    lineHeight: 18,
    marginBottom: 8,
  },
  ticketFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketDate: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkFaint,
  },
  repliesIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  repliesCountText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.teal,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  modalHeader: {
    height: Platform.OS === 'ios' ? 95 : 70,
    paddingTop: Platform.OS === 'ios' ? 45 : 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  modalHeaderTitleBox: {
    flex: 1,
  },
  modalHeaderTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 16.5,
    color: Colors.indigo950,
  },
  modalHeaderSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkFaint,
    marginTop: 2,
  },
  chatThreadContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  replyBubble: {
    width: '85%',
    padding: 12,
    borderRadius: Radius.md,
    marginBottom: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFFBEF',
    borderWidth: 1,
    borderColor: '#FBE8BD30',
    borderTopRightRadius: 2,
    width: '85%',
    padding: 12,
    borderRadius: Radius.md,
  },
  adminBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    borderTopLeftRadius: 2,
  },
  chatSenderName: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 11,
    color: Colors.marigoldDeep,
    marginBottom: 4,
  },
  chatMessageText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13.5,
    color: Colors.ink,
    lineHeight: 18,
  },
  chatTimeText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 9.5,
    color: Colors.inkFaint,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  replyFooter: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryLine,
    alignItems: 'center',
    gap: 10,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    maxHeight: 80,
    backgroundColor: Colors.ivoryDim,
    color: Colors.ink,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.inkFaint,
  },
});
