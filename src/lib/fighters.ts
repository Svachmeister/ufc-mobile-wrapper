import { OWNED_LIKE_STATUSES } from '@/src/lib/collection';
import { supabase } from '@/src/lib/supabase';

export type NativeFighterCard = {
  cardId: string;
  detail: string;
  fighterId: string | null;
  fighterName: string | null;
  status: string | null;
};

export type NativeFighter = {
  cardCount: number;
  country: string | null;
  id: string;
  name: string;
  nickname: string | null;
  ownedCount: number;
  record: string | null;
  raw: Record<string, unknown>;
  wantedCount: number;
  weightClass: string | null;
};

export type NativeFightersData = {
  cards: NativeFighterCard[];
  fighters: NativeFighter[];
  summary: {
    fighters: number;
    owned: number;
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

function buildRecord(row: Record<string, unknown>) {
  const explicitRecord = readString(row, ['record', 'fight_record', 'mma_record']);
  if (explicitRecord) return explicitRecord;

  const wins = readString(row, ['wins']);
  const losses = readString(row, ['losses']);
  const draws = readString(row, ['draws']);

  if (wins && losses && draws) return `${wins}-${losses}-${draws}`;
  if (wins && losses) return `${wins}-${losses}`;

  return null;
}

function getCardDetail(card: Record<string, unknown> | null) {
  const setName = readString(card, ['set_name', 'set_title', 'set']);
  const cardNumber = readString(card, ['card_number', 'number', 'card_no']);
  const variation = readString(card, ['variation', 'parallel', 'rarity']);
  const parts = [setName, cardNumber ? `#${cardNumber}` : null, variation].filter(Boolean);

  return parts.join(' - ') || 'Card details pending';
}

function normalizeCard(row: Record<string, unknown>, status: string | null = null): NativeFighterCard {
  return {
    cardId: readString(row, ['id']) || readString(row, ['card_id']) || 'unknown-card',
    detail: getCardDetail(row),
    fighterId: readString(row, ['fighter_id', 'fighterId']),
    fighterName: readString(row, ['fighter_name', 'name', 'title']),
    status,
  };
}

function normalizeFighter(row: Record<string, unknown>, index: number): NativeFighter {
  const id = readString(row, ['id']) || `fighter-${index}`;
  const name = readString(row, ['name', 'fighter_name', 'full_name']) || 'Unknown fighter';

  return {
    cardCount: 0,
    country: readString(row, ['country', 'nationality', 'flag_country']),
    id,
    name,
    nickname: readString(row, ['nickname', 'nick_name']),
    ownedCount: 0,
    raw: row,
    record: buildRecord(row),
    wantedCount: 0,
    weightClass: readString(row, ['weight_class', 'division']),
  };
}

function cardMatchesFighter(card: NativeFighterCard, fighter: NativeFighter) {
  return card.fighterId === fighter.id || card.fighterName === fighter.name;
}

export function getCardsForFighter(cards: NativeFighterCard[], fighter: NativeFighter) {
  return cards
    .filter((card) => cardMatchesFighter(card, fighter))
    .sort((a, b) => a.detail.localeCompare(b.detail));
}

export async function loadNativeFighters(userId: string) {
  const [fightersResult, cardsResult, userCardsResult] = await Promise.all([
    supabase
      .from('fighters')
      .select('*')
      .limit(500),
    supabase
      .from('cards')
      .select('*')
      .limit(2500),
    supabase
      .from('user_cards')
      .select('status,card_id,cards(*)')
      .eq('user_id', userId)
      .limit(2500),
  ]);

  if (fightersResult.error || cardsResult.error || userCardsResult.error) {
    return {
      data: {
        cards: [],
        fighters: [],
        summary: { fighters: 0, owned: 0, wanted: 0 },
      } as NativeFightersData,
      error: 'Could not load fighters.',
    };
  }

  const userCards = ((userCardsResult.data ?? []) as Record<string, unknown>[])
    .map((row) => {
      const card = getEmbeddedCard(row);
      const status = readString(row, ['status']);
      return card ? normalizeCard(card, status) : null;
    })
    .filter((card): card is NativeFighterCard => Boolean(card));
  const userCardsById = new Map(userCards.map((card) => [card.cardId, card]));
  const cards = ((cardsResult.data ?? []) as Record<string, unknown>[]).map((row) => {
    const normalized = normalizeCard(row);
    return {
      ...normalized,
      status: userCardsById.get(normalized.cardId)?.status ?? null,
    };
  });
  const fighters = ((fightersResult.data ?? []) as Record<string, unknown>[])
    .map(normalizeFighter)
    .map((fighter) => {
      const fighterCards = getCardsForFighter(cards, fighter);

      return {
        ...fighter,
        cardCount: fighterCards.length,
        ownedCount: fighterCards.filter((card) => card.status && OWNED_LIKE_STATUSES.has(card.status)).length,
        wantedCount: fighterCards.filter((card) => card.status === 'wanted').length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    data: {
      cards,
      fighters,
      summary: {
        fighters: fighters.length,
        owned: userCards.filter((card) => card.status && OWNED_LIKE_STATUSES.has(card.status)).length,
        wanted: userCards.filter((card) => card.status === 'wanted').length,
      },
    },
    error: null,
  };
}
