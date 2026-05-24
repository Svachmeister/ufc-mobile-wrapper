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

function readString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return null;
}

function getCardDetail(card: Record<string, unknown> | null) {
  const setName = readString(card, ['set_name', 'set', 'set_title', 'collection_name']);
  const cardNumber = readString(card, ['card_number', 'number', 'card_no']);
  const variation = readString(card, ['variation', 'parallel', 'rarity']);
  const parts = [setName, cardNumber ? `#${cardNumber}` : null, variation].filter(Boolean);

  return parts.join(' - ') || 'Card details pending';
}

function normalizeCollectionRow(
  row: Record<string, unknown>,
  index: number,
  card: Record<string, unknown> | null = null,
): NativeCollectionCard {
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
  const { data: userCardsData, error: userCardsError } = await supabase
    .from('user_cards')
    .select('id,card_id,status')
    .eq('user_id', userId)
    .limit(120);

  if (userCardsError) {
    return {
      cards: [] as NativeCollectionCard[],
      error: 'Could not load collection.',
      summary: { owned: 0, ownedLike: 0, wanted: 0 },
    };
  }

  const userCards = (userCardsData ?? []) as Record<string, unknown>[];
  const cardIds = userCards
    .map((row) => readString(row, ['card_id']))
    .filter((cardId): cardId is string => Boolean(cardId));
  const cardRowsById = new Map<string, Record<string, unknown>>();

  if (cardIds.length > 0) {
    const { data: cardsData, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .in('id', cardIds);

    if (cardsError) {
      return {
        cards: [] as NativeCollectionCard[],
        error: 'Could not load collection card details.',
        summary: { owned: 0, ownedLike: 0, wanted: 0 },
      };
    }

    ((cardsData ?? []) as Record<string, unknown>[]).forEach((card) => {
      const id = readString(card, ['id']);
      if (id) cardRowsById.set(id, card);
    });
  }

  const cards = userCards.map((row, index) => {
    const cardId = readString(row, ['card_id']);
    return normalizeCollectionRow(row, index, cardId ? cardRowsById.get(cardId) ?? null : null);
  });

  return {
    cards,
    error: null,
    summary: summarizeCollection(cards),
  };
}
