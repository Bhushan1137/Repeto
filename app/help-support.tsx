import React, { useState, useEffect, useMemo } from 'react';
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
import { Text, Card, TouchableRipple, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, doc, setDoc, query, where, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { getFirestoreDb, getFirebaseAuth } from '@/services/firebase/app';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/providers/ToastProvider';
import { useNetworkStatus } from '@/providers/AppProviders';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/Button';
import { Colors, Radius, Shadows, Typography } from '@/constants/theme';

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

interface FAQItem {
  id: string;
  category: 'tasks' | 'household' | 'offline' | 'account';
  qEn: string;
  qHi: string;
  aEn: string;
  aHi: string;
  icon: 'calendar-outline' | 'people-outline' | 'checkmark-done-outline' | 'shield-checkmark-outline' | 'refresh-outline';
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'faq-1',
    category: 'tasks',
    qEn: 'How do repeating tasks & reminders work?',
    qHi: 'रिपीटिंग टास्क और रिमाइंडर कैसे काम करते हैं?',
    aEn: 'You can set tasks to repeat Daily, Weekly, Monthly, Yearly, or on Custom intervals (e.g. Every 15 days, every 2nd Saturday). Repeto schedules precise local alarms so you get reminded even without internet.',
    aHi: 'आप कार्यों को दैनिक, साप्ताहिक, मासिक, वार्षिक या कस्टम अंतराल (उदा. हर 15 दिन) पर सेट कर सकते हैं। Repeto सटीक अलार्म सेट करता है ताकि इंटरनेट न होने पर भी रिमाइंडर मिले।',
    icon: 'calendar-outline',
  },
  {
    id: 'faq-2',
    category: 'household',
    qEn: 'How do I share tasks with family or flatmates?',
    qHi: 'परिवार या रूममेट्स के साथ टास्क कैसे शेयर करें?',
    aEn: 'Go to the Household tab, create a household, and tap "Share Invite Code". When your roommate joins, you can assign shared chores and bills to each other in real-time.',
    aHi: 'Household टैब पर जाएं, घर बनाएं और "Share Invite Code" दबाएं। जब सदस्य शामिल होंगे, तो आप घरेलू काम और बिल एक दूसरे को सौंप सकते हैं।',
    icon: 'people-outline',
  },
  {
    id: 'faq-3',
    category: 'offline',
    qEn: 'Does Repeto work offline?',
    qHi: 'क्या Repeto बिना इंटरनेट के काम करता है?',
    aEn: 'Yes! All your routines, tasks, and history are stored safely on your phone using SQLite. You can mark tasks done or add new ones offline — they sync to the cloud automatically once you reconnect.',
    aHi: 'हाँ! आपके सभी कार्य और इतिहास आपके फोन पर सुरक्षित रहते हैं। आप बिना इंटरनेट के भी टास्क पूरे कर सकते हैं — ऑनलाइन आने पर वे अपने आप सिंक हो जाते हैं।',
    icon: 'checkmark-done-outline',
  },
  {
    id: 'faq-4',
    category: 'account',
    qEn: 'How do I delete or restore my account?',
    qHi: 'मैं अपना खाता कैसे हटा या वापस ला सकता हूँ?',
    aEn: 'You can delete your account anytime in Profile → Delete My Account. We offer a 30-day recovery grace period. If you sign back in within 30 days, you can restore all your tasks or choose "Start Fresh" to wipe everything.',
    aHi: 'आप प्रोफ़ाइल → खाता हटाएं में जाकर कभी भी अपना खाता हटा सकते हैं। हम 30 दिनों की रिकवरी विंडो देते हैं जिसमें आप सब वापस ला सकते हैं या नए सिरे से शुरू कर सकते हैं।',
    icon: 'refresh-outline',
  },
  {
    id: 'faq-5',
    category: 'tasks',
    qEn: 'Why am I not receiving reminders?',
    qHi: 'मुझे रिमाइंडर नोटिफिकेशन क्यों नहीं मिल रहे हैं?',
    aEn: 'Make sure Notifications are enabled in Profile settings. On Android, check that Battery Optimization is disabled for Repeto so background alarms can fire on time.',
    aHi: 'जांचें कि प्रोफ़ाइल में सूचनाएं चालू हैं। Android पर, बैटरी ऑप्टिमाइज़ेशन में Repeto के लिए छूट दें ताकि समय पर अलार्म बज सके।',
    icon: 'shield-checkmark-outline',
  },
  {
    id: 'faq-6',
    category: 'account',
    qEn: 'Is my financial and task data private?',
    qHi: 'क्या मेरा वित्तीय और टास्क डेटा सुरक्षित है?',
    aEn: 'Absolutely. We do not sell or share your data with advertisers. Your personal reminders stay private to you, and only tasks explicitly shared inside a household are visible to household members.',
    aHi: 'बिल्कुल। हम विज्ञापनदाताओं को आपका डेटा कभी नहीं बेचते। आपके व्यक्तिगत कार्य पूरी तरह निजी रहते हैं।',
    icon: 'shield-checkmark-outline',
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { translate, language } = useTranslation();
  const { showToast } = useToast();
  const { isOnline } = useNetworkStatus();

  const isHi = language === 'hi';
  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;

  // Active top tab: 'faq' | 'tickets'
  const [activeTab, setActiveTab] = useState<'faq' | 'tickets'>('faq');

  // FAQ search and expanded state
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>('faq-1');

  // Ticket lists
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // New ticket form
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('low');
  const [submitting, setSubmitting] = useState(false);

  // Chat modal
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [lastSendTime, setLastSendTime] = useState(0);

  // Subscribe to tickets
  useEffect(() => {
    if (!db || !user) {
      setLoadingTickets(false);
      return;
    }
    const q = query(
      collection(db, 'support_tickets'),
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: SupportTicket[] = [];
      snap.forEach((d) => {
        list.push(d.data() as SupportTicket);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTickets(list);
      setLoadingTickets(false);

      if (selectedTicket) {
        const updated = list.find((t) => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    });

    return () => unsub();
  }, [db, user, selectedTicket?.id]);

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_ITEMS;
    const q = searchQuery.toLowerCase();
    return FAQ_ITEMS.filter((f) =>
      f.qEn.toLowerCase().includes(q) ||
      f.qHi.toLowerCase().includes(q) ||
      f.aEn.toLowerCase().includes(q) ||
      f.aHi.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const checkSpamCooldown = (): boolean => {
    const elapsed = Date.now() - lastSendTime;
    if (elapsed < 5000) {
      const secondsLeft = Math.ceil((5000 - elapsed) / 1000);
      showToast(
        isHi
          ? `कृपया बहुत तेज़ मैसेज भेजने से बचें। ${secondsLeft} सेकंड प्रतीक्षा करें।`
          : `Please wait ${secondsLeft}s before sending another message.`
      );
      return false;
    }
    return true;
  };

  const handleSubmitTicket = async () => {
    if (!isOnline) {
      showToast(translate('offlineSupportAction'));
      return;
    }
    if (!db || !user) {
      showToast(isHi ? 'त्रुटि: प्रमाणीकरण आवश्यक है' : 'Error: Authentication required');
      return;
    }
    if (!subject.trim() || !message.trim()) {
      showToast(isHi ? 'कृपया विषय और विवरण दोनों भरें' : 'Please fill out both subject and message');
      return;
    }
    if (!checkSpamCooldown()) return;

    setSubmitting(true);
    const ticketId = `tkt_${Date.now()}`;
    const newTicket: SupportTicket = {
      id: ticketId,
      userId: user.uid,
      userName: user.displayName || 'Repeto User',
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
      setShowNewTicketForm(false);
      setLastSendTime(Date.now());
      showToast(isHi ? 'टिकट सफलतापूर्वक सबमिट किया गया!' : 'Support ticket submitted successfully!');
    } catch (err) {
      console.error(err);
      showToast(isHi ? 'टिकट सबमिट करने में विफल' : 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!isOnline) {
      showToast(translate('offlineSupportAction'));
      return;
    }
    if (!db || !selectedTicket || !replyText.trim()) return;
    if (!checkSpamCooldown()) return;

    if (selectedTicket.replies && selectedTicket.replies.length >= 25) {
      showToast(
        isHi
          ? 'टिकट में मैसेज की सीमा पूरी हो गई है। कृपया नया टिकट बनाएं।'
          : 'Reply limit reached for this ticket. Please create a new ticket.'
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
        status: 'open',
      });
      setReplyText('');
      setLastSendTime(Date.now());
    } catch (err) {
      console.error(err);
      showToast(isHi ? 'जवाब भेजने में विफल' : 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return { label: isHi ? 'खुला है' : 'Open', color: '#D97706', bg: '#FEF3C7' };
      case 'in_progress':
        return { label: isHi ? 'प्रगति पर' : 'In Progress', color: '#2563EB', bg: '#DBEAFE' };
      case 'resolved':
        return { label: isHi ? 'सुलझाया गया' : 'Resolved', color: '#059669', bg: '#D1FAE5' };
      default:
        return { label: status, color: Colors.inkSoft, bg: Colors.ivoryDim };
    }
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(isHi ? 'hi-IN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: Colors.surfaceMuted }}
    >
      {/* ── 1. Top Navigation Bar ── */}
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 16) + 8 },
        ]}
      >
        <TouchableRipple
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
          style={styles.backBtn}
          borderless
          testID="help-back-button"
        >
          <AppIcon name="chevron-back" size={22} color={Colors.indigo950} />
        </TouchableRipple>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>
            {isHi ? 'सहायता और संपर्क' : 'Help & Support'}
          </Text>
          <Text style={styles.headerSub}>
            {isHi ? 'त्वरित उत्तर पाएं या टीम से संपर्क करें' : 'Quick answers & friendly human support'}
          </Text>
        </View>
      </View>

      {/* ── 2. Segmented Navigation Tabs ── */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tabBtn, activeTab === 'faq' && styles.tabBtnActive]}
          onPress={() => setActiveTab('faq')}
          testID="help-tab-faq"
        >
          <AppIcon
            name="help-circle-outline"
            size={18}
            color={activeTab === 'faq' ? Colors.indigo950 : Colors.inkSoft}
          />
          <Text style={[styles.tabBtnText, activeTab === 'faq' && styles.tabBtnTextActive]}>
            {isHi ? 'पूछे जाने वाले सवाल' : 'FAQs & Guides'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, activeTab === 'tickets' && styles.tabBtnActive]}
          onPress={() => setActiveTab('tickets')}
          testID="help-tab-tickets"
        >
          <AppIcon
            name="chatbox-ellipses-outline"
            size={18}
            color={activeTab === 'tickets' ? Colors.indigo950 : Colors.inkSoft}
          />
          <Text style={[styles.tabBtnText, activeTab === 'tickets' && styles.tabBtnTextActive]}>
            {isHi ? 'मेरे टिकट' : 'My Tickets'}
          </Text>
          {tickets.length > 0 && (
            <View style={styles.ticketCountBadge}>
              <Text style={styles.ticketCountText}>{tickets.length}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ── 3. Tab Contents ── */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + (showNewTicketForm ? 140 : 32) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {activeTab === 'faq' ? (
          <>
            {/* Search Bar */}
            <View style={styles.searchBar}>
              <AppIcon name="search-outline" size={20} color={Colors.inkSoft} />
              <TextInput
                style={styles.searchInput}
                placeholder={isHi ? 'सवाल या विषय खोजें...' : 'Search questions, topics...'}
                placeholderTextColor={Colors.inkFaint}
                value={searchQuery}
                onChangeText={setSearchQuery}
                testID="faq-search-input"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <AppIcon name="close-circle-outline" size={18} color={Colors.inkFaint} />
                </Pressable>
              )}
            </View>

            {/* Accordion FAQ List */}
            <View style={styles.faqList}>
              {filteredFaqs.map((faq) => {
                const isExpanded = expandedFaq === faq.id;
                return (
                  <Card
                    key={faq.id}
                    style={[styles.faqCard, isExpanded && styles.faqCardExpanded]}
                    mode="elevated"
                  >
                    <TouchableRipple
                      onPress={() => setExpandedFaq(isExpanded ? null : faq.id)}
                      borderless
                      testID={`faq-toggle-${faq.id}`}
                    >
                      <View style={styles.faqHeader}>
                        <View style={[styles.faqIconBadge, { backgroundColor: isExpanded ? Colors.marigoldLight : Colors.ivoryDim }]}>
                          <AppIcon name={faq.icon} size={20} color={Colors.indigo950} />
                        </View>
                        <Text style={styles.faqQuestion}>
                          {isHi ? faq.qHi : faq.qEn}
                        </Text>
                        <AppIcon
                          name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                          size={20}
                          color={Colors.inkSoft}
                        />
                      </View>
                    </TouchableRipple>

                    {isExpanded && (
                      <View style={styles.faqAnswerContainer}>
                        <Text style={styles.faqAnswer}>
                          {isHi ? faq.aHi : faq.aEn}
                        </Text>
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>

            {/* Direct Contact Card */}
            <Card style={styles.contactCard} mode="elevated">
              <Card.Content style={styles.contactCardContent}>
                <View style={styles.contactIconCircle}>
                  <AppIcon name="mail-outline" size={26} color={Colors.marigoldDeep} />
                </View>
                <Text style={styles.contactTitle}>
                  {isHi ? 'क्या आपको और मदद चाहिए?' : 'Still have questions?'}
                </Text>
                <Text style={styles.contactSub}>
                  {isHi
                    ? 'हमारी टीम आपकी सहायता के लिए सदैव उपलब्ध है। ऐप के भीतर सीधे नया टिकट बनाकर अपनी समस्या या सवाल साझा करें।'
                    : 'Our team is here to help! Submit a support ticket right inside the app to get fast, dedicated assistance.'}
                </Text>

                <View style={styles.contactButtonsRow}>
                  <Button
                    title={isHi ? 'नया टिकट बनाएं ✍️' : 'Submit Support Ticket ✍️'}
                    variant="primary"
                    onPress={() => {
                      setActiveTab('tickets');
                      setShowNewTicketForm(true);
                    }}
                    style={{ flex: 1 }}
                    testID="faq-open-ticket-btn"
                  />
                </View>
              </Card.Content>
            </Card>
          </>
        ) : (
          <>
            {/* My Tickets Tab */}
            <View style={styles.ticketsActionRow}>
              <Text style={styles.ticketsHeading}>
                {isHi ? 'सक्रिय और पिछले टिकट' : 'Your Inquiries & Tickets'}
              </Text>
              <Button
                title={showNewTicketForm ? (isHi ? 'बंद करें ✕' : 'Close ✕') : (isHi ? '+ नया टिकट' : '+ New Ticket')}
                variant={showNewTicketForm ? 'ghost' : 'primary'}
                compact
                onPress={() => setShowNewTicketForm(!showNewTicketForm)}
                testID="toggle-new-ticket-form-btn"
              />
            </View>

            {/* Collapsible Ticket Creation Card */}
            {showNewTicketForm && (
              <Card style={styles.newTicketCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.newTicketTitle}>
                    {isHi ? 'नया सपोर्ट टिकट बनाएं' : 'Create a Support Ticket'}
                  </Text>
                  <Text style={styles.newTicketSub}>
                    {isHi
                      ? 'अपनी समस्या का विवरण दें। हमारी टीम जल्द से जल्द जवाब देगी।'
                      : 'Describe what happened. We typically reply within a few hours.'}
                  </Text>

                  <Text style={styles.fieldLabel}>{isHi ? 'विषय' : 'Subject'}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder={isHi ? 'उदा. नोटिफिकेशन नहीं आ रहे हैं' : 'e.g. Alarms not ringing'}
                    placeholderTextColor={Colors.inkFaint}
                    value={subject}
                    onChangeText={setSubject}
                    maxLength={100}
                    testID="support-subject-input"
                  />
                  <Text style={styles.charCount}>{subject.length}/100</Text>

                  <Text style={styles.fieldLabel}>{isHi ? 'विस्तार से विवरण' : 'Message Details'}</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder={isHi ? 'समस्या के बारे में विस्तार से बताएं...' : 'Explain the issue in detail...'}
                    placeholderTextColor={Colors.inkFaint}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    numberOfLines={4}
                    maxLength={1000}
                    testID="support-message-input"
                  />
                  <Text style={styles.charCount}>{message.length}/1000</Text>

                  <Text style={styles.fieldLabel}>{isHi ? 'प्राथमिकता' : 'Priority'}</Text>
                  <View style={styles.prioritySelector}>
                    {(['low', 'medium', 'high'] as const).map((p) => {
                      const active = priority === p;
                      const labels = { low: 'Normal', medium: 'Important', high: 'Urgent' };
                      const hiLabels = { low: 'सामान्य', medium: 'ज़रूरी', high: 'अति आवश्यक' };
                      return (
                        <Pressable
                          key={p}
                          onPress={() => setPriority(p)}
                          style={[
                            styles.priorityOption,
                            active && styles.priorityOptionActive,
                            active && p === 'high' && { backgroundColor: Colors.clay, borderColor: Colors.clay },
                          ]}
                          testID={`priority-${p}`}
                        >
                          <Text style={[styles.priorityOptionText, active && styles.priorityOptionTextActive]}>
                            {isHi ? hiLabels[p] : labels[p]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Button
                    title={isHi ? 'टिकट सबमिट करें' : 'Submit Ticket'}
                    loading={submitting}
                    disabled={submitting}
                    onPress={handleSubmitTicket}
                    style={{ marginTop: 16 }}
                    testID="submit-ticket-btn"
                  />
                </Card.Content>
              </Card>
            )}

            {/* Ticket List */}
            {loadingTickets ? (
              <View style={styles.centeredState}>
                <ActivityIndicator size="small" color={Colors.marigoldDeep} />
                <Text style={styles.centeredStateText}>
                  {isHi ? 'टिकट लोड हो रहे हैं...' : 'Loading ticket history...'}
                </Text>
              </View>
            ) : tickets.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <AppIcon name="chatbox-ellipses-outline" size={32} color={Colors.marigoldDeep} />
                </View>
                <Text style={styles.emptyTitle}>
                  {isHi ? 'कोई खुला टिकट नहीं है' : 'No Support Tickets Yet'}
                </Text>
                <Text style={styles.emptySub}>
                  {isHi
                    ? 'यदि आपके पास कोई प्रश्न या समस्या है, तो नया टिकट बनाएं।'
                    : 'Have an issue or idea? Tap "+ New Ticket" above to reach us.'}
                </Text>
              </View>
            ) : (
              <View style={styles.ticketsList}>
                {tickets.map((t) => {
                  const badge = getStatusBadge(t.status);
                  return (
                    <Card
                      key={t.id}
                      style={styles.ticketCard}
                      mode="elevated"
                      onPress={() => setSelectedTicket(t)}
                    >
                      <Card.Content style={styles.ticketCardContent}>
                        <View style={styles.ticketTopRow}>
                          <Text style={styles.ticketSubject} numberOfLines={1}>
                            {t.subject}
                          </Text>
                          <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                            <Text style={[styles.statusPillText, { color: badge.color }]}>
                              {badge.label}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.ticketMessagePreview} numberOfLines={2}>
                          {t.message}
                        </Text>

                        <View style={styles.ticketBottomRow}>
                          <Text style={styles.ticketTimestamp}>
                            {formatTime(t.createdAt)}
                          </Text>
                          {t.replies?.length > 0 && (
                            <View style={styles.repliesPill}>
                              <AppIcon name="chatbox-ellipses-outline" size={14} color={Colors.tealDeep} />
                              <Text style={styles.repliesCountText}>
                                {t.replies.length} {isHi ? 'उत्तर' : (t.replies.length === 1 ? 'reply' : 'replies')}
                              </Text>
                            </View>
                          )}
                        </View>
                      </Card.Content>
                    </Card>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── 4. Chat Thread Detail Modal ── */}
      {selectedTicket && (
        <Modal
          visible={selectedTicket !== null}
          animationType="slide"
          onRequestClose={() => setSelectedTicket(null)}
        >
          <KeyboardAvoidingView
            style={[styles.modalRoot, { paddingTop: Math.max(insets.top, 16) }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableRipple
                onPress={() => setSelectedTicket(null)}
                style={styles.modalCloseBtn}
                borderless
              >
                <AppIcon name="close" size={22} color={Colors.indigo950} />
              </TouchableRipple>
              <View style={styles.modalHeaderInfo}>
                <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                  {selectedTicket.subject}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <Text style={styles.modalHeaderSub}>ID: {selectedTicket.id}</Text>
                  {(() => {
                    const b = getStatusBadge(selectedTicket.status);
                    return (
                      <View style={[styles.statusPillSmall, { backgroundColor: b.bg }]}>
                        <Text style={[styles.statusPillTextSmall, { color: b.color }]}>
                          {b.label}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </View>
            </View>

            {/* Chat Thread Messages */}
            <ScrollView
              contentContainerStyle={[
                styles.chatThreadContent,
                { paddingBottom: 24 },
              ]}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* Initial User Message */}
              <View style={styles.bubbleUser}>
                <View style={styles.bubbleSenderRow}>
                  <Text style={styles.bubbleSenderName}>{selectedTicket.userName || 'You'}</Text>
                  <Text style={styles.bubbleTimestamp}>{formatTime(selectedTicket.createdAt)}</Text>
                </View>
                <Text style={styles.bubbleMessageText}>{selectedTicket.message}</Text>
              </View>

              {/* Replies Thread */}
              {selectedTicket.replies?.map((r, i) => {
                const isAdmin = r.sender === 'admin';
                return (
                  <View
                    key={i}
                    style={[
                      styles.bubbleBase,
                      isAdmin ? styles.bubbleAdmin : styles.bubbleUser,
                    ]}
                  >
                    <View style={styles.bubbleSenderRow}>
                      <Text style={[styles.bubbleSenderName, isAdmin && styles.bubbleAdminName]}>
                        {isAdmin ? (isHi ? 'Repeto सहायता टीम' : 'Repeto Support') : (selectedTicket.userName || 'You')}
                      </Text>
                      <Text style={styles.bubbleTimestamp}>{formatTime(r.timestamp)}</Text>
                    </View>
                    <Text style={styles.bubbleMessageText}>{r.message}</Text>
                  </View>
                );
              })}
            </ScrollView>

            {/* Quick Reply Bar */}
            <View
              style={[
                styles.replyBar,
                { paddingBottom: Math.max(insets.bottom, 12) + 6 },
              ]}
            >
              <TextInput
                style={styles.replyTextInput}
                placeholder={isHi ? 'जवाब लिखें...' : 'Type a reply...'}
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
                  styles.sendReplyBtn,
                  (!replyText.trim() || sendingReply) && styles.sendReplyBtnDisabled,
                ]}
                borderless
              >
                {sendingReply ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <AppIcon name="send-outline" size={18} color={Colors.white} />
                )}
              </TouchableRipple>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ivoryDim,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.title,
    fontSize: 18,
    color: Colors.ink,
  },
  headerSub: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.inkSoft,
    marginTop: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.ivoryDim,
  },
  tabBtnActive: {
    backgroundColor: Colors.marigoldLight,
  },
  tabBtnText: {
    ...Typography.bodySm,
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkSoft,
  },
  tabBtnTextActive: {
    color: Colors.indigo950,
  },
  ticketCountBadge: {
    backgroundColor: Colors.marigoldDeep,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ticketCountText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: Colors.white,
  },
  scrollContent: {
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    gap: 10,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 14,
    color: Colors.ink,
    padding: 0,
  },
  faqList: {
    gap: 10,
    marginBottom: 20,
  },
  faqCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    overflow: 'hidden',
  },
  faqCardExpanded: {
    borderColor: Colors.marigold,
    borderWidth: 1.5,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  faqIconBadge: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqQuestion: {
    flex: 1,
    ...Typography.title,
    fontSize: 14.5,
    color: Colors.ink,
  },
  faqAnswerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryDim,
    backgroundColor: '#FAFAF8',
  },
  faqAnswer: {
    ...Typography.bodySm,
    fontSize: 13.5,
    lineHeight: 21,
    color: Colors.inkSoft,
  },
  contactCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    ...Shadows.sm,
  },
  contactCardContent: {
    padding: 20,
    alignItems: 'center',
  },
  contactIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.marigoldLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  contactTitle: {
    ...Typography.title,
    fontSize: 17,
    color: Colors.ink,
    marginBottom: 6,
    textAlign: 'center',
  },
  contactSub: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
    maxWidth: 300,
  },
  contactButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  ticketsActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  ticketsHeading: {
    ...Typography.title,
    fontSize: 16,
    color: Colors.ink,
  },
  newTicketCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.marigold,
    ...Shadows.sm,
  },
  newTicketTitle: {
    ...Typography.title,
    fontSize: 16,
    color: Colors.ink,
    marginBottom: 4,
  },
  newTicketSub: {
    ...Typography.caption,
    color: Colors.inkSoft,
    marginBottom: 14,
    lineHeight: 18,
  },
  fieldLabel: {
    ...Typography.label,
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 10,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.ink,
    fontFamily: 'Manrope_500Medium',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.inkFaint,
    alignSelf: 'flex-end',
    marginTop: 3,
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
  },
  priorityOptionActive: {
    backgroundColor: Colors.marigold,
    borderColor: Colors.marigold,
  },
  priorityOptionText: {
    ...Typography.bodySm,
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkSoft,
  },
  priorityOptionTextActive: {
    color: Colors.white,
  },
  centeredState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  centeredStateText: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.ivoryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    ...Typography.title,
    fontSize: 17,
    color: Colors.ink,
    marginBottom: 6,
  },
  emptySub: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
  },
  ticketsList: {
    gap: 12,
  },
  ticketCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  ticketCardContent: {
    padding: 14,
  },
  ticketTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketSubject: {
    flex: 1,
    ...Typography.title,
    fontSize: 15,
    color: Colors.ink,
    marginRight: 8,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
  },
  ticketMessagePreview: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    lineHeight: 19,
    marginBottom: 10,
  },
  ticketBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketTimestamp: {
    ...Typography.caption,
    color: Colors.inkFaint,
    fontSize: 11.5,
  },
  repliesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.tealLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  repliesCountText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: Colors.tealDeep,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
    gap: 12,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ivoryDim,
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalHeaderTitle: {
    ...Typography.title,
    fontSize: 16,
    color: Colors.ink,
  },
  modalHeaderSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.inkFaint,
  },
  statusPillSmall: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  statusPillTextSmall: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
  },
  chatThreadContent: {
    padding: 16,
    gap: 14,
  },
  bubbleBase: {
    maxWidth: '84%',
    borderRadius: Radius.lg,
    padding: 14,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    maxWidth: '84%',
    borderRadius: Radius.lg,
    padding: 14,
    ...Shadows.sm,
  },
  bubbleAdmin: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.marigoldLight,
    borderWidth: 1,
    borderColor: Colors.marigold,
  },
  bubbleSenderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 10,
  },
  bubbleSenderName: {
    ...Typography.caption,
    fontFamily: 'Manrope_700Bold',
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  bubbleAdminName: {
    color: Colors.indigo950,
  },
  bubbleTimestamp: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.inkFaint,
  },
  bubbleMessageText: {
    ...Typography.bodySm,
    fontSize: 13.5,
    lineHeight: 20,
    color: Colors.ink,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryLine,
    gap: 10,
  },
  replyTextInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 90,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.ink,
    fontFamily: 'Manrope_500Medium',
  },
  sendReplyBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.marigoldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendReplyBtnDisabled: {
    backgroundColor: Colors.inkFaint,
    opacity: 0.5,
  },
});
