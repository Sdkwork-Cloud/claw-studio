import type { OpenClawToolCard } from './openClawMessagePresentation.ts';

const MAX_JSON_AUTOPARSE_CHARS = 20_000;
const TOOL_SUMMARY_PREVIEW_LIMIT = 120;

export type ChatJsonBlockPresentation =
  | {
      kind: 'array';
      pretty: string;
      itemCount: number;
    }
  | {
      kind: 'object';
      pretty: string;
      keyCount: number;
      keys: string[];
    };

export type ChatToolCardsSummary = {
  totalCount: number;
  visibleNames: string[];
  hiddenCount: number;
  previewText: string | null;
};

function normalizeInlineWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateInlinePreview(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

export function detectChatJsonBlock(text: string): ChatJsonBlockPresentation | null {
  const trimmed = text.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_JSON_AUTOPARSE_CHARS ||
    (!trimmed.startsWith('{') && !trimmed.startsWith('['))
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return {
        kind: 'array',
        pretty: JSON.stringify(parsed, null, 2),
        itemCount: parsed.length,
      };
    }

    if (parsed && typeof parsed === 'object') {
      const keys = Object.keys(parsed as Record<string, unknown>);
      return {
        kind: 'object',
        pretty: JSON.stringify(parsed, null, 2),
        keyCount: keys.length,
        keys,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function presentChatToolCardsSummary(params: {
  toolCards: OpenClawToolCard[];
  previewText?: string | null;
}): ChatToolCardsSummary {
  const normalizedNames = [...new Set(
    params.toolCards
      .map((toolCard) => toolCard.name.trim())
      .filter((name) => name.length > 0),
  )];

  return {
    totalCount: params.toolCards.length,
    visibleNames: normalizedNames.slice(0, 2),
    hiddenCount: Math.max(normalizedNames.length - 2, 0),
    previewText: params.previewText?.trim()
      ? truncateInlinePreview(normalizeInlineWhitespace(params.previewText), TOOL_SUMMARY_PREVIEW_LIMIT)
      : null,
  };
}
