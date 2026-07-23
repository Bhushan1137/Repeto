import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { Colors, Radius, Typography } from '@/constants/theme';
import { Toggle } from '@/components/Toggle';

interface SettingRowProps {
  label: string;
  sub?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  flat?: boolean;
  testID?: string;
}

export function SettingRow({ label, sub, value, onValueChange, flat = false, testID }: SettingRowProps) {
  return (
    <Card style={[styles.card, flat && styles.cardFlat]} mode={flat ? 'contained' : 'elevated'} testID={testID}>
      <Card.Content style={styles.cardContent}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.label}>{label}</Text>
          {sub ? <Text style={styles.sub}>{sub}</Text> : null}
        </View>
        <Toggle value={value} onValueChange={onValueChange} testID={testID ? `${testID}-toggle` : undefined} />
      </Card.Content>
    </Card>
  );
}

interface LanguagePickerProps {
  options: Array<{ code: string; label: string; native: string }>;
  selected: string;
  onSelect: (code: string) => void;
  testID?: string;
}

export function LanguagePicker({ options, selected, onSelect, testID }: LanguagePickerProps) {
  return (
    <>
      {options.map((opt) => {
        const active = selected === opt.code;
        return (
          <Card
            key={opt.code}
            style={[styles.langCard, active && styles.langCardActive]}
            mode="elevated"
            testID={testID ? `${testID}-card-${opt.code}` : undefined}
          >
            <TouchableRipple
              onPress={() => onSelect(opt.code)}
              style={styles.ripple}
              testID={testID ? `${testID}-btn-${opt.code}` : undefined}
              borderless
            >
              <View style={styles.langInner}>
                <View>
                  <Text style={styles.langName}>{opt.label}</Text>
                  <Text style={styles.langNative}>{opt.native}</Text>
                </View>
                {active ? (
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkIcon}>✓</Text>
                  </View>
                ) : (
                  <View style={styles.checkCircleEmpty} />
                )}
              </View>
            </TouchableRipple>
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 10,
    elevation: 1,
  },
  cardFlat: {
    elevation: 0,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    backgroundColor: Colors.white,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  label: { ...Typography.title, fontSize: 14.5, color: Colors.ink },
  sub: { ...Typography.caption, color: Colors.inkSoft, marginTop: 3 },
  langCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 12,
    elevation: 1,
    overflow: 'hidden',
  },
  langCardActive: {
    borderWidth: 1.5,
    borderColor: Colors.marigold,
    backgroundColor: 'rgba(232,163,61,0.04)',
    elevation: 0,
  },
  ripple: {
    padding: 16,
  },
  langInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  langName: { ...Typography.title, fontSize: 15, color: Colors.ink },
  langNative: { fontFamily: 'Fraunces_600SemiBold', fontSize: 13, color: Colors.inkSoft, marginTop: 2 },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    color: Colors.white,
    fontSize: 12,
    fontFamily: 'Manrope_800ExtraBold',
    lineHeight: 14,
  },
  checkCircleEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    backgroundColor: 'transparent',
  },
});

