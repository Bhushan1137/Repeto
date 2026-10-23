export interface TextSpan {
  text: string;
  isBold?: boolean;
  isCode?: boolean;
  isEmail?: boolean;
}

export type LegalBlockType =
  | 'doc_title'
  | 'subheading'
  | 'bullet'
  | 'numbered'
  | 'paragraph'
  | 'doc_end';

export interface LegalBlock {
  type: LegalBlockType;
  text: string;
  number?: string;
  spans: TextSpan[];
}

export interface LegalSection {
  id: string;
  sectionNumber?: number;
  title: string;
  blocks: LegalBlock[];
}

export function cleanMarkdownHeading(str: string): string {
  return str
    .replace(/^#+\s*/, '')
    .replace(/^\*{1,2}/, '')
    .replace(/\*{1,2}$/, '')
    .replace(/\\([.[\]()])/g, '$1')
    .trim();
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function parseInlineSpans(rawText: string): TextSpan[] {
  let text = rawText.replace(/\s*\\$/, '').replace(/  +$/, '');
  text = text.replace(/\\([.[\]()])/g, '$1');

  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const parts = text.split(tokenRegex);
  const spans: TextSpan[] = [];

  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const inner = part.slice(2, -2);
      const isEmail = EMAIL_REGEX.test(inner);
      spans.push({
        text: inner,
        isBold: true,
        isEmail,
      });
    } else if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      spans.push({
        text: part.slice(1, -1),
        isCode: true,
      });
    } else if (EMAIL_REGEX.test(part)) {
      spans.push({
        text: part,
        isEmail: true,
        isBold: true,
      });
    } else {
      spans.push({
        text: part,
      });
    }
  }

  return spans;
}

export function parseLegalMarkdown(rawText: string): LegalSection[] {
  const lines = rawText.split(/\r?\n/);
  const sections: LegalSection[] = [];
  let currentSection: LegalSection = {
    id: 'intro',
    title: 'Overview & Introduction',
    blocks: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    if (rawLine === '---') {
      continue;
    }

    const normalized = rawLine
      .replace(/\\\./g, '.')
      .replace(/\\\[/g, '[')
      .replace(/\\\]/g, ']');

    // Check main section header: "## **1. About Repeto**" or "# **3. Information We Collect**"
    const mainSectionMatch = normalized.match(/^#{1,3}\s+\*{0,2}(\d+)\.\s+(.*?)\*{0,2}$/);
    if (mainSectionMatch) {
      if (currentSection.blocks.length > 0 || currentSection.id !== 'intro') {
        sections.push(currentSection);
      }
      const sectionNum = mainSectionMatch[1];
      const sectionTitle = cleanMarkdownHeading(mainSectionMatch[2]);
      currentSection = {
        id: `section-${sectionNum}`,
        sectionNumber: parseInt(sectionNum, 10),
        title: `${sectionNum}. ${sectionTitle}`,
        blocks: [],
      };
      continue;
    }

    // Check subsection header: "## **3.1 Account and Authentication Information**"
    const subSectionMatch =
      normalized.match(/^#{2,3}\s+\*{0,2}(\d+\.\d+)\.?\s+(.*?)\*{0,2}$/);
    if (subSectionMatch) {
      const subNum = subSectionMatch[1];
      const subTitle = cleanMarkdownHeading(subSectionMatch[2]);
      const headerText = `${subNum} ${subTitle}`;
      currentSection.blocks.push({
        type: 'subheading',
        text: headerText,
        spans: parseInlineSpans(headerText),
      });
      continue;
    }

    // Check named sub-subheading: "### **Notifications**"
    const namedHeaderMatch = normalized.match(/^#{3,4}\s+\*{0,2}(.*?)\*{0,2}$/);
    if (namedHeaderMatch) {
      const headerText = cleanMarkdownHeading(namedHeaderMatch[1]);
      currentSection.blocks.push({
        type: 'subheading',
        text: headerText,
        spans: parseInlineSpans(headerText),
      });
      continue;
    }

    // Check bullet: "* Personal and shared task management;"
    if (normalized.startsWith('* ')) {
      const bulletText = normalized.substring(2).trim();
      currentSection.blocks.push({
        type: 'bullet',
        text: bulletText,
        spans: parseInlineSpans(bulletText),
      });
      continue;
    }

    // Check numbered list: "1. You are at least 12 years old;"
    const numListMatch = normalized.match(/^(\d+)\.\s+(.*)$/);
    if (numListMatch) {
      const itemText = numListMatch[2].trim();
      currentSection.blocks.push({
        type: 'numbered',
        number: numListMatch[1],
        text: itemText,
        spans: parseInlineSpans(itemText),
      });
      continue;
    }

    // Document Main Title: "# **Repeto Privacy Policy**"
    if (normalized.startsWith('# ')) {
      const docTitle = cleanMarkdownHeading(normalized);
      currentSection.blocks.push({
        type: 'doc_title',
        text: docTitle,
        spans: parseInlineSpans(docTitle),
      });
      continue;
    }

    // End of Document
    if (
      normalized.toLowerCase().includes('end of privacy policy') ||
      normalized.toLowerCase().includes('end of terms of service')
    ) {
      const endText = cleanMarkdownHeading(normalized);
      currentSection.blocks.push({
        type: 'doc_end',
        text: endText,
        spans: parseInlineSpans(endText),
      });
      continue;
    }

    // Regular paragraph
    currentSection.blocks.push({
      type: 'paragraph',
      text: normalized,
      spans: parseInlineSpans(normalized),
    });
  }

  if (currentSection.blocks.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}
