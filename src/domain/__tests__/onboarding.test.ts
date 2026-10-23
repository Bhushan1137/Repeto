import { describe, expect, it } from 'vitest';
import { buildOnboardingSuggestions } from '@/domain/onboarding';

describe('onboarding domain module', () => {
  it('builds onboarding suggestions for given categories', () => {
    const suggestions = buildOnboardingSuggestions(['bills', 'home']);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toHaveProperty('accepted', false);
    expect(suggestions[0]).toHaveProperty('category');
  });

  it('handles empty category array', () => {
    const suggestions = buildOnboardingSuggestions([]);
    expect(suggestions).toEqual([]);
  });
});
