import { supabase } from '@/src/lib/supabase';

export const OWNED_LIKE_STATUSES = new Set(['owned', 'for_sale', 'not_for_sale', 'for_trade']);

export type NativeCollectionCard = {
  cardId: string | null;
  detail: string;
  fighterName: string;
  id: string;
  raw: Record<string, unknown>;
  status: string | null;
};

export type NativeCollectionSummary = {
  owned: number;
  ownedLike: number;
  wanted: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return null;
}

function getEmbeddedCard(row: Record<string, unknown>) {
  const cards = row.cards;
  if (Array.isArray(cards)) return asRecord(cards[0]);
  return asRecord(cards);
}

function getCardDetail(card: Record<string, unknown> | null) {
  const setName = readString(card, ['set_name', 'set', 'set_title', 'collection_name']);
  const cardNumber = readString(card, ['card_number', 'number', 'card_no']);
  const variation = readString(card, ['variation', 'parallel', 'rarity']);
  const parts = [setName, cardNumber ? `#${cardNumber}` : null, variation].filter(Boolean);

  return parts.join(' - ') || 'Card details pending';
}

function normalizeCollectionRow(row: Record<string, unknown>, index: number): NativeCollectionCard {
  const card = getEmbeddedCard(row);
  const status = readString(row, ['status']);
  const rowId = readString(row, ['id']) || `${readString(row, ['card_id']) || 'card'}-${index}`;
  const cardId = readString(row, ['card_id']) || readString(card, ['id']);
  const fighterName =
    readString(card, ['fighter_name', 'name', 'title']) ||
    readString(row, ['fighter_name']) ||
    'Unknown fighter';

  return {
    cardId,
    detail: getCardDetail(card),
    fighterName,
    id: rowId,
    raw: row,
    status,
  };
}

export function summarizeCollection(cards: NativeCollectionCard[]): NativeCollectionSummary {
  return {
    owned: cards.filter((card) => card.status === 'owned').length,
    ownedLike: cards.filter((card) => card.status && OWNED_LIKE_STATUSES.has(card.status)).length,
    wanted: cards.filter((card) => card.status === 'wanted').length,
  };
}

export async function loadNativeCollection(userId: string) {
  const { data, error } = await supabase
    .from('user_cards')
    .select('*, cards(*)')
    .eq('user_id', userId)
    .limit(120);

  if (error) {
    return {
      cards: [] as NativeCollectionCard[],
      error: 'Could not load collection.',
      summary: { owned: 0, ownedLike: 0, wanted: 0 },
    };
  }

  const cards = ((data ?? []) as Record<string, unknown>[]).map(normalizeCollectionRow);

  return {
    cards,
    error: null,
    summary: summarizeCollection(cards),
  };
}
