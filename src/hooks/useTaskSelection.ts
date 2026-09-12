import { useState, useCallback } from 'react';

export function useTaskSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((allIds: string[]) => {
    setSelectedIds(new Set(allIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelecting = selectedIds.size > 0;

  return {
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    isSelecting,
  };
}
