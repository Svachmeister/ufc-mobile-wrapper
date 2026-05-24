import { OWNED_LIKE_STATUSES } from '@/src/lib/collection';
import { supabase } from '@/src/lib/supabase';

export type NativeChecklistCard = {
  cardId: string;
  detail: string;
  fighterName: string;
  setId: string | null;
  setName: string | null;
  status: string | null;
};

export type NativeChecklistSet = {
  brand: string | null;
  cardCount: number;
  id: string;
  imageUrl: string | null;
  name: string;
  ownedCount: number;
  releaseDate: string | null;
  wantedCount: number;
  year: string | null;
};

export type NativeChecklistsData = {
  cards: NativeChecklistCard[];
  sets: NativeChecklistSet[];
  summary: {
    owned: number;
    sets: number;
    wanted: number;
  };
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

function getSetId(card: Record<string, unknown> | null) {
  return readString(card, ['set_id', 'setId', 'set']);
}

function getSetName(card: Record<string, unknown> | null) {
  return readString(card, ['set_name', 'set_title', 'setName', 'collection_name']);
}

function getCardDetail(card: Record<string, unknown> | null) {
  const cardNumber = readString(card, ['card_number', 'number', 'card_no']);
  const variation = readString(card, ['variation', 'parallel', 'rarity']);
  const parts = [cardNumber ? `#${cardNumber}` : null, variation].filter(Boolean);

  return parts.join(' - ') || 'Base card';
}

function normalizeCard(row: Record<string, unknown>, status: string | null = null): NativeChecklistCard {
  return {
    cardId: readString(row, ['id']) || readString(row, ['card_id']) || 'unknown-card',
    detail: getCardDetail(row),
    fighterName: readString(row, ['fighter_name', 'name', 'title']) || 'Unknown fighter',
    setId: getSetId(row),
    setName: getSetName(row),
    status,
  };
}

function normalizeSet(row: Record<string, unknown>): NativeChecklistSet {
  const id = readString(row, ['id']) || readString(row, ['set_id']) || 'unknown-set';

  return {
    brand: readString(row, ['brand', 'manufacturer']),
    cardCount: 0,
    id,
    imageUrl: readString(row, ['image_url', 'imageUrl', 'cover_url']),
    name: readString(row, ['name', 'title', 'set_name']) || 'Untitled set',
    ownedCount: 0,
    releaseDate: readString(row, ['release_date', 'releaseDate']),
    wantedCount: 0,
    year: readString(row, ['year']),
  };
}

function getCardSetKey(card: NativeChecklistCard) {
  return card.setId || card.setName || null;
}

export function getCardsForSet(cards: NativeChecklistCard[], set: NativeChecklistSet) {
  return cards
    .filter((card) => {
      const cardKey = getCardSetKey(card);
      return cardKey === set.id || card.setName === set.name;
    })
    .sort((a, b) => a.fighterName.localeCompare(b.fighterName));
}

export async function loadNativeChecklists(userId: string) {
  const [setsResult, cardsResult, userCardsResult] = await Promise.all([
    supabase
      .from('sets')
      .select('*')
      .limit(80),
    supabase
      .from('cards')
      .select('id,set_id,set_name,fighter_name,card_number,variation')
      .limit(2500),
    supabase
      .from('user_cards')
      .select('status,card_id,cards(id,set_id,set_name,fighter_name,card_number,variation)')
      .eq('user_id', userId)
      .limit(2500),
  ]);

  if (setsResult.error || cardsResult.error || userCardsResult.error) {
    return {
      data: {
        cards: [],
        sets: [],
        summary: { owned: 0, sets: 0, wanted: 0 },
      } as NativeChecklistsData,
      error: 'Could not load checklists.',
    };
  }

  const userCards = ((userCardsResult.data ?? []) as Record<string, unknown>[])
    .map((row) => {
      const card = getEmbeddedCard(row);
      const status = readString(row, ['status']);
      return card ? normalizeCard(card, status) : null;
    })
    .filter((card): card is NativeChecklistCard => Boolean(card));
  const userCardsById = new Map(userCards.map((card) => [card.cardId, card]));
  const cards = ((cardsResult.data ?? []) as Record<string, unknown>[]).map((row) => {
    const normalized = normalizeCard(row);
    return {
      ...normalized,
      status: userCardsById.get(normalized.cardId)?.status ?? null,
    };
  });
  const sets = ((setsResult.data ?? []) as Record<string, unknown>[])
    .map(normalizeSet)
    .map((set) => {
      const setCards = getCardsForSet(cards, set);

      return {
        ...set,
        cardCount: setCards.length,
        ownedCount: setCards.filter((card) => card.status && OWNED_LIKE_STATUSES.has(card.status)).length,
        wantedCount: setCards.filter((card) => card.status === 'wanted').length,
      };
    })
    .sort((a, b) => {
      const yearCompare = String(b.year || '').localeCompare(String(a.year || ''));
      if (yearCompare !== 0) return yearCompare;
      return a.name.localeCompare(b.name);
    });

  return {
    data: {
      cards,
      sets,
      summary: {
        owned: userCards.filter((card) => card.status && OWNED_LIKE_STATUSES.has(card.status)).length,
        sets: sets.length,
        wanted: userCards.filter((card) => card.status === 'wanted').length,
      },
    },
    error: null,
  };
}
