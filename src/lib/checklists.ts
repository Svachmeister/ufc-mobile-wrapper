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

export type NativeChecklistWritableStatus = 'owned' | 'wanted';

const CARD_PAGE_SIZE = 1000;

function readString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return null;
}

function getSetId(card: Record<string, unknown> | null) {
  return readString(card, ['set_id', 'setId']);
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
    setName: null,
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
  return card.setId || null;
}

export function getCardsForSet(cards: NativeChecklistCard[], set: NativeChecklistSet) {
  return cards
    .filter((card) => {
      const cardKey = getCardSetKey(card);
      return cardKey === set.id;
    })
    .sort((a, b) => a.fighterName.localeCompare(b.fighterName));
}

async function loadChecklistCards() {
  const cards: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cards')
      .select('id,set_id,fighter_name,card_number,variation')
      .order('set_id', { ascending: true })
      .range(from, from + CARD_PAGE_SIZE - 1);

    if (error) {
      console.warn('Native checklists cards query failed', error.message);
      return { cards, error: 'Card catalog failed to load.' };
    }

    const page = (data ?? []) as Record<string, unknown>[];
    cards.push(...page);

    if (page.length < CARD_PAGE_SIZE) {
      return { cards, error: null };
    }

    from += CARD_PAGE_SIZE;
  }
}

export function getNextChecklistStatus(status: string | null): NativeChecklistWritableStatus | null {
  if (status === 'wanted') return null;
  if (status && OWNED_LIKE_STATUSES.has(status)) return 'wanted';
  return 'owned';
}

export async function saveNativeChecklistStatus({
  cardId,
  status,
  userId,
}: {
  cardId: string;
  status: NativeChecklistWritableStatus | null;
  userId: string;
}) {
  if (!userId || !cardId || cardId === 'unknown-card') {
    return { error: 'Could not update card status.' };
  }

  if (status === null) {
    const { error } = await supabase
      .from('user_cards')
      .delete()
      .eq('user_id', userId)
      .eq('card_id', cardId);

    return { error: error ? 'Could not update card status.' : null };
  }

  const { error } = await supabase
    .from('user_cards')
    .upsert(
      {
        card_id: cardId,
        status,
        user_id: userId,
      },
      { onConflict: 'user_id,card_id' },
    );

  return { error: error ? 'Could not update card status.' : null };
}

export async function loadNativeChecklists(userId: string) {
  const [setsResult, userCardsResult] = await Promise.all([
    supabase
      .from('sets')
      .select('*')
      .limit(80),
    supabase
      .from('user_cards')
      .select('status,card_id')
      .eq('user_id', userId)
      .limit(2500),
  ]);

  if (setsResult.error) {
    console.warn('Native checklists sets query failed', setsResult.error.message);

    return {
      data: {
        cards: [],
        sets: [],
        summary: { owned: 0, sets: 0, wanted: 0 },
      } as NativeChecklistsData,
      error: 'Could not load checklist sets.',
    };
  }

  const rawSets = (setsResult.data ?? []) as Record<string, unknown>[];
  const normalizedSets = rawSets.map(normalizeSet);
  const cardsResult = await loadChecklistCards();

  if (userCardsResult.error) {
    console.warn('Native checklists user_cards query failed', userCardsResult.error.message);

    return {
      data: {
        cards: cardsResult.cards.map((row) => normalizeCard(row)),
        sets: normalizedSets,
        summary: { owned: 0, sets: normalizedSets.length, wanted: 0 },
      } as NativeChecklistsData,
      error: 'Could not load your checklist status.',
    };
  }

  const userCardStatusesById = new Map(
    ((userCardsResult.data ?? []) as Record<string, unknown>[])
      .map((row) => [readString(row, ['card_id']), readString(row, ['status'])] as const)
      .filter((entry): entry is [string, string | null] => Boolean(entry[0])),
  );
  const cards = cardsResult.cards.map((row) => {
    const normalized = normalizeCard(row);
    return {
      ...normalized,
      status: userCardStatusesById.get(normalized.cardId) ?? null,
    };
  });
  const sets = normalizedSets
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
        owned: cards.filter((card) => card.status && OWNED_LIKE_STATUSES.has(card.status)).length,
        sets: sets.length,
        wanted: cards.filter((card) => card.status === 'wanted').length,
      },
    },
    error: cardsResult.error,
  };
}
