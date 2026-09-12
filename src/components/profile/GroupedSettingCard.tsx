import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { Colors, Radius, Typography } from '@/constants/theme';
import { AppIcon, type AppIconName } from '@/components/AppIcon';

interface GroupedSettingCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function GroupedSettingCard({ children, style, testID }: GroupedSettingCardProps) {
  return (
    <Card style={[styles.card, style]} mode="elevated" testID={testID}>
      {children}
    </Card>
  );
}

interface SettingItemProps {
  icon: AppIconName;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  danger?: boolean;
  badge?: string | number;
  valueText?: string;
  isLast?: boolean;
  testID?: string;
}

export function SettingItem({
  icon,
  iconColor = Colors.indigo900,
  iconBg = 'rgba(23, 27, 54, 0.06)',
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = true,
  danger = false,
  badge,
  valueText,
  isLast = false,
  testID,
}: SettingItemProps) {
  const content = (
    <View style={styles.itemInner}>
      {/* Icon Badge */}
      <View style={[styles.iconContainer, { backgroundColor: danger ? 'rgba(193, 80, 46, 0.1)' : iconBg }]}>
        <AppIcon name={icon} size={18} color={danger ? Colors.clayDeep : iconColor} />
      </View>

      {/* Label and Subtitle */}
      <View style={styles.textContainer}>
        <Text style={[styles.title, danger && styles.dangerText]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Right Side */}
      <View style={styles.rightContainer}>
        {badge !== undefined && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        {valueText ? <Text style={styles.valueText}>{valueText}</Text> : null}
        {rightElement}
        {showChevron && onPress && !rightElement && (
          <AppIcon name="chevron-forward" size={18} color={Colors.inkFaint} />
        )}
      </View>
    </View>
  );

  return (
    <View testID={testID}>
      {onPress ? (
        <TouchableRipple
          onPress={onPress}
          style={styles.ripple}
          testID={testID ? `${testID}-ripple` : undefined}
          borderless
        >
          {content}
        </TouchableRipple>
      ) : (
        <View style={styles.ripple}>{content}</View>
      )}
      {!isLast && <View style={styles.divider} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 14,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    overflow: 'hidden',
  },
  ripple: {
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  itemInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...Typography.title,
    fontSize: 14.5,
    color: Colors.ink,
    fontFamily: 'Manrope_700Bold',
  },
  subtitle: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.inkSoft,
    marginTop: 2,
    lineHeight: 16,
  },
  dangerText: {
    color: Colors.clayDeep,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  badgeContainer: {
    backgroundColor: 'rgba(232, 163, 61, 0.16)',
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: Colors.marigoldDeep,
  },
  valueText: {
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.inkSoft,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.ivoryLine,
    marginLeft: 66,
    marginRight: 16,
  },
});
