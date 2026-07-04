import { StyleSheet } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

export interface DateFieldProps {
  label: string;
  value: string | null;
  onChange: (isoDate: string) => void;
  hint?: string;
  minimumDate?: Date;
}

export function parseDate(iso: string | null): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function formatDisplayDate(iso: string | null, lang: 'en' | 'hi' = 'en'): string {
  if (!iso) return '—';
  const d = parseDate(iso);
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const dateFieldStyles = StyleSheet.create({
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
    borderRadius: Radius.md,
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
