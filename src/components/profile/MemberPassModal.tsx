import React from 'react';
import { View, StyleSheet, Modal, Pressable, Share } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import type { UserProfile, Language } from '@/types';
import { Colors, Radius } from '@/constants/theme';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/Button';
import { useToast } from '@/providers/ToastProvider';
import { initials } from '@/domain/insights';

interface MemberPassModalProps {
  visible: boolean;
  onClose: () => void;
  user: UserProfile;
  language: Language;
}

export function MemberPassModal({ visible, onClose, user, language }: MemberPassModalProps) {
  const { showToast } = useToast();
  const isHi = language === 'hi';

  const userCode = user.userCode || 'RPT-PENDING';

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(userCode);
    showToast(isHi ? 'सदस्य कोड कॉपी किया गया!' : 'Member code copied to clipboard!');
  };

  const handleShare = async () => {
    try {
      const message = isHi
        ? `Repeato पर मुझसे जुड़ें! मेरा सदस्य कोड है: ${userCode}`
        : `Join me on Repeato! My member code is: ${userCode}`;
      await Share.share({ message });
    } catch {
      // Ignored
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <Card style={styles.passCard} mode="elevated">
          {/* Top Banner Ribbon */}
          <LinearGradient colors={[Colors.indigo950, Colors.indigo900]} style={styles.passHeader}>
            <View style={styles.ribbonPill}>
              <AppIcon name="qr-code-outline" size={13} color={Colors.marigold} />
              <Text style={styles.ribbonText}>
                {isHi ? 'मेरा क्यूआर कोड' : 'MY QR CODE'}
              </Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <AppIcon name="close" size={18} color={Colors.onDarkMuted} />
            </Pressable>

            {/* Avatar & Name */}
            <View style={styles.identityRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(user.name || 'User')}</Text>
              </View>
              <View style={styles.identityTextCol}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user.name || 'Repeato Member'}
                </Text>
                <Text style={styles.userPhone} numberOfLines={1}>
                  {user.email || user.phone || ''}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Pass Body (QR Code + Code) */}
          <View style={styles.passBody}>
            <Text style={styles.instructionText}>
              {isHi
                ? 'परिवार में शामिल होने के लिए एडमिन को यह कोड दिखाएं।'
                : 'Show this QR code to a Household Admin to get added to their household.'}
            </Text>

            {/* QR Code Container */}
            <View style={styles.qrFrame}>
              <QRCode value={userCode} size={168} />
            </View>

            {/* Tap to copy code pill */}
            <TouchableRipple style={styles.codePill} onPress={handleCopyCode} borderless>
              <View style={styles.codePillInner}>
                <Text style={styles.codePillText}>{userCode}</Text>
                <AppIcon name="copy-outline" size={15} color={Colors.marigoldDeep} />
              </View>
            </TouchableRipple>

            {/* Action Buttons */}
            <View style={styles.buttonStack}>
              <Button
                title={isHi ? 'आमंत्रण लिंक शेयर करें' : 'Share Invite Link'}
                onPress={handleShare}
                style={styles.shareBtn}
              />

              <Button
                title={isHi ? 'कोड कॉपी करें' : 'Copy Code'}
                variant="ghost"
                onPress={handleCopyCode}
                style={styles.copyBtn}
              />
            </View>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(23, 27, 54, 0.58)',
  },
  passCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    elevation: 16,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  passHeader: {
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(232, 163, 61, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: 14,
  },
  ribbonText: {
    fontSize: 10.5,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.marigold,
    letterSpacing: 1.2,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(251,247,239,0.4)',
  },
  avatarText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
    color: Colors.indigo950,
  },
  identityTextCol: {
    flex: 1,
  },
  userName: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 16,
    color: Colors.onDark,
  },
  userPhone: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11.5,
    color: Colors.onDarkMuted,
    marginTop: 2,
  },
  passBody: {
    padding: 22,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  instructionText: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    color: Colors.inkSoft,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  qrFrame: {
    padding: 14,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 14,
  },
  codePill: {
    borderRadius: Radius.full,
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.25)',
  },
  codePillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codePillText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 17,
    color: Colors.marigoldDeep,
    letterSpacing: 2,
  },
  buttonStack: {
    width: '100%',
    gap: 8,
  },
  shareBtn: {
    width: '100%',
  },
  copyBtn: {
    width: '100%',
  },
});
