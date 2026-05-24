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
  cardCount: number | null;
  id: string;
  imageUrl: string | null;
  name: string;
  ownedCount: number;
  releaseDate: string | null;
  wantedCount: number;
  year: string | null;
};

export type NativeChecklistsData = {
  sets: NativeChecklistSet[];
  summary: {
    owned: number;
    sets: number;
    wanted: number;
  };
  userCardStatuses: Record<string, string | null>;
};

export type NativeChecklistWritableStatus = 'owned' | 'wanted';

export const CHECKLIST_CARD_PAGE_SIZE = 75;
const USER_CARD_SET_CHUNK_SIZE = 500;

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
    cardCount: null,
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

function getUserCardStatusMap(rows: Record<string, unknown>[]) {
  return Object.fromEntries(
    rows
      .map((row) => [readString(row, ['card_id']), readString(row, ['status'])] as const)
      .filter((entry): entry is [string, string | null] => Boolean(entry[0])),
  );
}

function getStatusCounts(statuses: Iterable<string | null>) {
  const values = [...statuses];

  return {
    owned: values.filter((status) => status && OWNED_LIKE_STATUSES.has(status)).length,
    wanted: values.filter((status) => status === 'wanted').length,
  };
}

async function loadUserCardSetIds(cardIds: string[]) {
  const setIdsByCardId = new Map<string, string>();

  for (let index = 0; index < cardIds.length; index += USER_CARD_SET_CHUNK_SIZE) {
    const chunk = cardIds.slice(index, index + USER_CARD_SET_CHUNK_SIZE);
    const { data, error } = await supabase
      .from('cards')
      .select('id,set_id')
      .in('id', chunk);

    if (error) {
      console.warn('Native checklists user card set lookup failed', error.message);
      return { error: 'Checklist counts failed to load.', setIdsByCardId };
    }

    ((data ?? []) as Record<string, unknown>[]).forEach((card) => {
      const cardId = readString(card, ['id']);
      const setId = readString(card, ['set_id']);

      if (cardId && setId) setIdsByCardId.set(cardId, setId);
    });
  }

  return { error: null, setIdsByCardId };
}

function applySetOwnershipCounts(
  sets: NativeChecklistSet[],
  userCardStatuses: Record<string, string | null>,
  setIdsByCardId: Map<string, string>,
) {
  const countsBySetId = new Map<string, { owned: number; wanted: number }>();

  Object.entries(userCardStatuses).forEach(([cardId, status]) => {
    const setId = setIdsByCardId.get(cardId);
    if (!setId) return;

    const counts = countsBySetId.get(setId) ?? { owned: 0, wanted: 0 };
    if (status && OWNED_LIKE_STATUSES.has(status)) counts.owned += 1;
    if (status === 'wanted') counts.wanted += 1;
    countsBySetId.set(setId, counts);
  });

  return sets.map((set) => {
    const counts = countsBySetId.get(set.id);

    return {
      ...set,
      ownedCount: counts?.owned ?? 0,
      wantedCount: counts?.wanted ?? 0,
    };
  });
}

export async function loadNativeSetCards({
  from = 0,
  pageSize = CHECKLIST_CARD_PAGE_SIZE,
  setId,
  userCardStatuses,
}: {
  from?: number;
  pageSize?: number;
  setId: string;
  userCardStatuses: Record<string, string | null>;
}) {
  const { count, data, error } = await supabase
    .from('cards')
    .select('id,set_id,fighter_name,card_number,variation', { count: 'exact' })
    .eq('set_id', setId)
    .order('card_number', { ascending: true })
    .order('fighter_name', { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) {
    console.warn('Native checklist set cards query failed', error.message);

    return {
      cards: [] as NativeChecklistCard[],
      error: 'Could not load cards for this set.',
      hasMore: false,
      nextFrom: from,
      totalCount: null as number | null,
    };
  }

  const cards = ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const normalized = normalizeCard(row);
    return {
      ...normalized,
      status: userCardStatuses[normalized.cardId] ?? null,
    };
  });
  const nextFrom = from + cards.length;
  const hasMore = typeof count === 'number'
    ? nextFrom < count
    : cards.length === pageSize;

  return {
    cards,
    error: null,
    hasMore,
    nextFrom,
    totalCount: count ?? null,
  };
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
        sets: [],
        summary: { owned: 0, sets: 0, wanted: 0 },
        userCardStatuses: {},
      } as NativeChecklistsData,
      error: 'Could not load checklist sets.',
    };
  }

  const rawSets = (setsResult.data ?? []) as Record<string, unknown>[];
  const normalizedSets = rawSets.map(normalizeSet);

  if (userCardsResult.error) {
    console.warn('Native checklists user_cards query failed', userCardsResult.error.message);

    return {
      data: {
        sets: normalizedSets,
        summary: { owned: 0, sets: normalizedSets.length, wanted: 0 },
        userCardStatuses: {},
      } as NativeChecklistsData,
      error: 'Could not load your checklist status.',
    };
  }

  const userCardStatuses = getUserCardStatusMap((userCardsResult.data ?? []) as Record<string, unknown>[]);
  const userCardSetResult = await loadUserCardSetIds(Object.keys(userCardStatuses));
  const sets = applySetOwnershipCounts(normalizedSets, userCardStatuses, userCardSetResult.setIdsByCardId)
    .sort((a, b) => {
      const yearCompare = String(b.year || '').localeCompare(String(a.year || ''));
      if (yearCompare !== 0) return yearCompare;
      return a.name.localeCompare(b.name);
    });
  const summary = getStatusCounts(Object.values(userCardStatuses));

  return {
    data: {
      sets,
      summary: {
        owned: summary.owned,
        sets: sets.length,
        wanted: summary.wanted,
      },
      userCardStatuses,
    },
    error: userCardSetResult.error,
  };
}
