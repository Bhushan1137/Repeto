/**
 * useCategories
 * ─────────────
 * Manages user-created (custom) categories stored in AsyncStorage.
 *
 * Returns:
 *  - `customCategories`  — array of user-defined categories
 *  - `allCategories`     — built-in CATEGORIES + customCategories merged
 *  - `addCategory`       — create a new custom category
 *  - `updateCategory`    — edit an existing custom category
 *  - `deleteCategory`    — remove a custom category by key
 *  - `loading`           — true while hydrating from storage
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATEGORIES, type CategoryDef } from '@/constants/categories';
import { registerCustomCategories } from '@/constants/categoryHelpers';
import type { CustomCategoryDef, CustomCategoryKey } from '@/types';

const STORAGE_KEY = 'repeato_custom_categories_v1';

// Prime registry on bundle evaluation if available
loadFromStorage().then(registerCustomCategories).catch(() => {});

/** Shape accepted when creating a custom category (key is auto-generated) */
export interface CreateCustomCategoryInput {
  labelEn: string;
  labelHi?: string;
  icon: string;
  accent: CustomCategoryDef['accent'];
  group: CustomCategoryDef['group'];
  defaultFreqLabel?: string;
}

/** Merged representation — built-in CategoryDef + custom subset */
export interface MergedCategoryDef {
  key: string;            // CategoryKey | CustomCategoryKey
  labelEn: string;
  labelHi: string;
  icon: string;
  accent: 'clay' | 'teal' | 'marigold';
  group: 'money' | 'home' | 'life';
  isCustom: boolean;
}

function makeKey(): CustomCategoryKey {
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return `custom_${suffix}` as CustomCategoryKey;
}

async function loadFromStorage(): Promise<CustomCategoryDef[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CustomCategoryDef[];
  } catch {
    return [];
  }
}

async function saveToStorage(categories: CustomCategoryDef[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
}

export function useCategories() {
  const [customCategories, setCustomCategories] = useState<CustomCategoryDef[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Hydrate from AsyncStorage on mount ──
  useEffect(() => {
    let cancelled = false;
    loadFromStorage().then((data) => {
      if (!cancelled) {
        setCustomCategories(data);
        registerCustomCategories(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Merge built-in + custom into a unified list ──
  const allCategories: MergedCategoryDef[] = [
    ...CATEGORIES.map((c: CategoryDef): MergedCategoryDef => ({
      key: c.key,
      labelEn: c.labelEn,
      labelHi: c.labelHi,
      icon: c.icon,
      accent: c.accent,
      group: c.group,
      isCustom: false,
    })),
    ...customCategories.map((c: CustomCategoryDef): MergedCategoryDef => ({
      key: c.key,
      labelEn: c.labelEn,
      labelHi: c.labelHi ?? c.labelEn,
      icon: c.icon,
      accent: c.accent,
      group: c.group,
      isCustom: true,
    })),
  ];

  // ── CRUD operations ──

  const addCategory = useCallback(
    async (input: CreateCustomCategoryInput): Promise<CustomCategoryDef> => {
      const newCat: CustomCategoryDef = {
        key: makeKey(),
        labelEn: input.labelEn.trim(),
        labelHi: input.labelHi?.trim() || undefined,
        icon: input.icon,
        accent: input.accent,
        group: input.group,
        createdAt: new Date().toISOString(),
        defaultFreqLabel: input.defaultFreqLabel,
      };

      setCustomCategories((prev) => {
        const next = [...prev, newCat];
        registerCustomCategories(next);
        saveToStorage(next).catch(console.warn);
        return next;
      });

      return newCat;
    },
    []
  );

  const updateCategory = useCallback(
    async (
      key: CustomCategoryKey,
      patch: Partial<Omit<CustomCategoryDef, 'key' | 'createdAt'>>
    ): Promise<void> => {
      setCustomCategories((prev) => {
        const next = prev.map((c) => (c.key === key ? { ...c, ...patch } : c));
        registerCustomCategories(next);
        saveToStorage(next).catch(console.warn);
        return next;
      });
    },
    []
  );

  const deleteCategory = useCallback(async (key: CustomCategoryKey): Promise<void> => {
    setCustomCategories((prev) => {
      const next = prev.filter((c) => c.key !== key);
      registerCustomCategories(next);
      saveToStorage(next).catch(console.warn);
      return next;
    });
  }, []);

  return {
    customCategories,
    allCategories,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
  };
}
