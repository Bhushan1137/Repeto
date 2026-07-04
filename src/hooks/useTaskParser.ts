import { useMemo } from 'react';
import { parseTaskInput } from '@/domain/parser';
import { useTranslation } from '@/hooks/useTranslation';

export function useTaskParser(text: string) {
  const { language } = useTranslation();
  return useMemo(() => (text.trim() ? parseTaskInput(text, language) : null), [text, language]);
}
