import { describe, it, expect } from 'vitest';
import {
  cleanMarkdownHeading,
  parseInlineSpans,
  parseLegalMarkdown,
} from '../legalParser';
import { PRIVACY_POLICY_MARKDOWN } from '@/constants/legal/privacyPolicyText';
import { TERMS_OF_SERVICE_MARKDOWN } from '@/constants/legal/termsOfServiceText';

describe('legalParser', () => {
  it('cleans markdown headings properly', () => {
    expect(cleanMarkdownHeading('## **1\\. About Repeto**')).toBe('1. About Repeto');
    expect(cleanMarkdownHeading('# **3\\. Information We Collect**')).toBe('3. Information We Collect');
    expect(cleanMarkdownHeading('### **Notifications**')).toBe('Notifications');
  });

  it('parses inline spans with bold, code, and emails', () => {
    const text = 'Contact support at **support.repeto@gmail.com** or check `termsAcceptedAt` timestamp.';
    const spans = parseInlineSpans(text);
    expect(spans).toEqual([
      { text: 'Contact support at ' },
      { text: 'support.repeto@gmail.com', isBold: true, isEmail: true },
      { text: ' or check ' },
      { text: 'termsAcceptedAt', isCode: true },
      { text: ' timestamp.' },
    ]);
  });

  it('parses Privacy Policy into all 26 numbered sections plus overview', () => {
    const sections = parseLegalMarkdown(PRIVACY_POLICY_MARKDOWN);
    expect(sections.length).toBe(27);
    expect(sections[0].id).toBe('intro');
    expect(sections[1].title).toBe('1. About Repeto');
    expect(sections[26].title).toBe('26. Applicable Rights');

    // Section 3 has multiple subsections
    const section3 = sections.find((s) => s.id === 'section-3');
    expect(section3).toBeDefined();
    const subheadings = section3!.blocks.filter((b) => b.type === 'subheading');
    expect(subheadings.length).toBeGreaterThanOrEqual(10);

    // Section 17 has account deletion pathways
    const section17 = sections.find((s) => s.id === 'section-17');
    expect(section17).toBeDefined();
    expect(section17!.title).toContain('Account Deletion');
  });

  it('parses Terms of Service into all 30 numbered sections plus overview', () => {
    const sections = parseLegalMarkdown(TERMS_OF_SERVICE_MARKDOWN);
    expect(sections.length).toBe(31);
    expect(sections[0].id).toBe('intro');
    expect(sections[1].title).toBe('1. About Repeto');
    expect(sections[30].title).toBe('30. Contact Us');

    // Section 13 has deletion
    const section13 = sections.find((s) => s.id === 'section-13');
    expect(section13).toBeDefined();
    expect(section13!.title).toContain('Account Deletion');
  });
});
