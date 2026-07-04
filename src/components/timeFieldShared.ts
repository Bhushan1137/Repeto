import { StyleSheet } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

export interface TimeFieldProps {
  label: string;
  value: string | null;
  onChange: (time: string) => void;
  hint?: string;
}

export function parseTime(value: string | null): Date {
  const d = new Date();
  if (!value) {
    d.setHours(9, 0, 0, 0);
    return d;
  }
  const [h, m] = value.split(':').map(Number);
  d.setHours(h || 9, m || 0, 0, 0);
  return d;
}

export function formatTime(value: string | null): string {
  if (!value) return '—';
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function toTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export const timeFieldStyles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 11.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkSoft,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: Colors.white,
  },
  triggerText: { fontFamily: 'Manrope_600SemiBold', fontSize: 14.5, color: Colors.ink },
  chevron: { fontSize: 14, color: Colors.inkSoft },
  hint: { fontSize: 11.5, color: Colors.inkFaint, marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(23,27,54,0.45)' },
  webSheet: {
    position: 'absolute',
    bottom: '30%',
    left: '10%',
    right: '10%',
    backgroundColor: Colors.ivory,
    borderRadius: 16,
    padding: 20,
  },
  iosSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.ivory,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  iosBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  cancel: { fontFamily: 'Manrope_600SemiBold', color: Colors.inkSoft, fontSize: 15 },
  done: { fontFamily: 'Manrope_700Bold', color: Colors.tealDeep, fontSize: 15 },
  sheetTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 18, color: Colors.ink, marginBottom: 12 },
});
