import { OWNED_LIKE_STATUSES } from '@/src/lib/collection';
import { supabase } from '@/src/lib/supabase';

export type NativeChecklistCard = {
  cardId: string;
  cardIdLabel: string | null;
  detail: string;
  fighterName: string;
  isRookie: boolean;
  printRun: string | null;
  setId: string | null;
  setName: string | null;
  status: string | null;
  subset: string | null;
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

export type NativeChecklistSubset = {
  cardIdentityCount: number;
  name: string;
  variantCount: number;
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
const CHECKLIST_CARD_SELECT = 'id,set_id,fighter_name,card_id,card_number,subset,variation,print_run,is_rookie';
const CHECKLIST_SUBSET_PAGE_SIZE = 1000;
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

function readBoolean(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return false;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  }

  return false;
}

function normalizeCard(row: Record<string, unknown>, status: string | null = null): NativeChecklistCard {
  return {
    cardId: readString(row, ['id']) || readString(row, ['card_id']) || 'unknown-card',
    cardIdLabel: readString(row, ['card_id', 'card_number', 'number', 'card_no']),
    detail: getCardDetail(row),
    fighterName: readString(row, ['fighter_name', 'name', 'title']) || 'Unknown fighter',
    isRookie: readBoolean(row, ['is_rookie', 'isRookie']),
    printRun: readString(row, ['print_run', 'printRun']),
    setId: getSetId(row),
    setName: null,
    status,
    subset: readString(row, ['subset']),
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

function normalizeIdentityPart(value: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getSubsetCardIdentity(row: Record<string, unknown>) {
  return [
    readString(row, ['card_id', 'card_number', 'id']),
    readString(row, ['fighter_name']),
  ].map(normalizeIdentityPart).join('::');
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
  searchQuery = '',
  setId,
  userCardStatuses,
}: {
  from?: number;
  pageSize?: number;
  searchQuery?: string;
  setId: string;
  userCardStatuses: Record<string, string | null>;
}) {
  const searchTerm = sanitizeCardSearchTerm(searchQuery);
  let query = supabase
    .from('cards')
    .select('id,set_id,fighter_name,card_id,card_number,subset,variation,print_run,is_rookie', { count: 'exact' })
    .eq('set_id', setId);

  if (searchTerm) {
    const pattern = `%${searchTerm}%`;
    query = query.or([
      `fighter_name.ilike.${pattern}`,
      `card_number.ilike.${pattern}`,
      `variation.ilike.${pattern}`,
    ].join(','));
  }

  const { count, data, error } = await query
    .order('card_number', { ascending: true })
    .order('fighter_name', { ascending: true })
    .order('variation', { ascending: true })
    .order('print_run', { ascending: false })
    .order('id', { ascending: true })
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

export async function loadNativeSetSubsets({ setId }: { setId: string }) {
  const subsetMap = new Map<string, { identities: Set<string>; variantCount: number }>();

  for (let from = 0; ; from += CHECKLIST_SUBSET_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('cards')
      .select('id,subset,card_id,card_number,fighter_name')
      .eq('set_id', setId)
      .order('subset', { ascending: true })
      .order('card_number', { ascending: true })
      .order('fighter_name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + CHECKLIST_SUBSET_PAGE_SIZE - 1);

    if (error) {
      console.warn('Native checklist subsets query failed', error.message);

      return {
        error: 'Could not load checklist sections.',
        subsets: [] as NativeChecklistSubset[],
      };
    }

    ((data ?? []) as Record<string, unknown>[]).forEach((row) => {
      const subset = readString(row, ['subset']) || 'Other';
      const summary = subsetMap.get(subset) ?? {
        identities: new Set<string>(),
        variantCount: 0,
      };

      summary.variantCount += 1;
      summary.identities.add(getSubsetCardIdentity(row));
      subsetMap.set(subset, summary);
    });

    if (!data || data.length < CHECKLIST_SUBSET_PAGE_SIZE) break;
  }

  const subsets = [...subsetMap.entries()]
    .map(([name, summary]) => ({
      cardIdentityCount: summary.identities.size,
      name,
      variantCount: summary.variantCount,
    }))
    .sort((a, b) => b.variantCount - a.variantCount || a.name.localeCompare(b.name));

  return { error: null, subsets };
}

export async function loadNativeSetCardsByFighter({
  fighterSearch,
  from = 0,
  pageSize = CHECKLIST_CARD_PAGE_SIZE,
  setId,
  userCardStatuses,
}: {
  fighterSearch: string;
  from?: number;
  pageSize?: number;
  setId: string;
  userCardStatuses: Record<string, string | null>;
}) {
  const searchTerm = sanitizeCardSearchTerm(fighterSearch);

  if (!searchTerm) {
    return emptySetCardsResult(from);
  }

  const pattern = `%${searchTerm}%`;
  const query = createScopedSetCardsQuery(setId)
    .ilike('fighter_name', pattern);

  return loadSetCardsFromQuery({
    from,
    pageSize,
    query,
    userCardStatuses,
    warning: 'Native checklist fighter cards query failed',
  });
}

export async function loadNativeSetCardsBySubset({
  from = 0,
  pageSize = CHECKLIST_CARD_PAGE_SIZE,
  setId,
  subset,
  userCardStatuses,
}: {
  from?: number;
  pageSize?: number;
  setId: string;
  subset: string;
  userCardStatuses: Record<string, string | null>;
}) {
  const subsetTerm = subset.trim();

  if (!subsetTerm) {
    return emptySetCardsResult(from);
  }

  const query = createScopedSetCardsQuery(setId)
    .eq('subset', subsetTerm);

  return loadSetCardsFromQuery({
    from,
    pageSize,
    query,
    userCardStatuses,
    warning: 'Native checklist subset cards query failed',
  });
}

function emptySetCardsResult(from: number) {
  return {
    cards: [] as NativeChecklistCard[],
    error: null,
    hasMore: false,
    nextFrom: from,
    totalCount: 0,
  };
}

function createScopedSetCardsQuery(setId: string) {
  return supabase
    .from('cards')
    .select(CHECKLIST_CARD_SELECT, { count: 'exact' })
    .eq('set_id', setId);
}

async function loadSetCardsFromQuery({
  from,
  pageSize,
  query,
  userCardStatuses,
  warning,
}: {
  from: number;
  pageSize: number;
  query: ReturnType<typeof createScopedSetCardsQuery>;
  userCardStatuses: Record<string, string | null>;
  warning: string;
}) {
  const { count, data, error } = await query
    .order('card_number', { ascending: true })
    .order('fighter_name', { ascending: true })
    .order('variation', { ascending: true })
    .order('print_run', { ascending: false })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) {
    console.warn(warning, error.message);

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

function sanitizeCardSearchTerm(value: string) {
  // These characters either affect SQL LIKE matching or PostgREST .or(...) parsing.
  return value
    .trim()
    .replace(/[%*_(),'"\\]/g, ' ')
    .replace(/\s+/g, ' ');
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
