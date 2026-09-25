import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth/SessionContext';
import { groupCollectionCards, type CollectionCardRow, type CollectionSetSection } from './cardGrouping';
import type { CardStatus } from './userCardStatuses';

const PAGE_SIZE = 1000;
const COLUMNS =
  'card_id, status, cards(id, set_id, subset, card_number, variation, print_run, fighter_name, is_rookie, sets(name, year, sort_order))';

export function myMarkedCardsKey(userId: string | undefined) {
  return ['cards', 'my-marked-cards', userId] as const;
}

export type MarkedCardRow = CollectionCardRow & { status: CardStatus };

type RawCard = {
  id: string;
  set_id: string;
  subset: string;
  card_number: string;
  variation: string;
  print_run: number | null;
  fighter_name: string;
  is_rookie: boolean;
  sets: { name: string; year: number; sort_order: number } | { name: string; year: number; sort_order: number }[] | null;
};

type RawMarkedRow = {
  card_id: string;
  status: string;
  // user_cards.card_id -> cards.id is many-to-one, so this embeds as a single
  // object in practice; the array form is handled defensively, same as the
  // cards(...) embed in lib/cards/fighterQueries.ts.
  cards: RawCard | RawCard[] | null;
};

function normalizeMarkedRow(row: RawMarkedRow): MarkedCardRow | null {
  if (row.status !== 'owned' && row.status !== 'wanted') {
    // This app only uses these two statuses — anything else is left out
    // rather than mis-rendered as one of them.
    return null;
  }
  const cardValue = row.cards;
  const card = Array.isArray(cardValue) ? cardValue[0] : cardValue;
  if (!card) {
    return null;
  }
  const setRelation = card.sets;
  const set = Array.isArray(setRelation) ? setRelation[0] : setRelation;
  if (!set) {
    return null;
  }

  return {
    id: card.id,
    set_id: card.set_id,
    set_name: set.name,
    set_year: set.year,
    set_sort_order: set.sort_order,
    subset: card.subset,
    card_number: card.card_number,
    variation: card.variation,
    print_run: card.print_run,
    fighter_name: card.fighter_name,
    is_rookie: card.is_rookie,
    status: row.status,
  };
}

async function fetchMyMarkedCards(userId: string): Promise<MarkedCardRow[]> {
  const rows: MarkedCardRow[] = [];
  let offset = 0;

  while (true) {
    // RLS already scopes user_cards to the signed-in user's own rows; this
    // .eq is redundant with that but lets the query use an index on user_id,
    // same reasoning as lib/cards/userCardStatuses.ts.
    const { data, error } = await supabase
      .from('user_cards')
      .select(COLUMNS)
      .eq('user_id', userId)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    const page = (data ?? []) as unknown as RawMarkedRow[];
    for (const raw of page) {
      const normalized = normalizeMarkedRow(raw);
      if (normalized) {
        rows.push(normalized);
      }
    }
    if (page.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return rows;
}

/**
 * The full set of the signed-in user's marked cards with card + set details —
 * needed up front (not paged progressively) because the stats row's counts
 * would otherwise flicker as pages arrive.
 */
export function useMyMarkedCards() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: myMarkedCardsKey(userId),
    queryFn: () => fetchMyMarkedCards(userId as string),
    enabled: Boolean(userId),
  });
}

export type CollectionStats = {
  cards: number;
  sets: number;
  oneOfOnes: number;
};

// Wanted rows never count toward any of the three stats.
export function computeCollectionStats(rows: MarkedCardRow[]): CollectionStats {
  const owned = rows.filter((row) => row.status === 'owned');
  return {
    cards: owned.length,
    sets: new Set(owned.map((row) => row.set_id)).size,
    oneOfOnes: owned.filter((row) => row.print_run === 1).length,
  };
}

export function buildCollectionSections(rows: MarkedCardRow[], segment: CardStatus): CollectionSetSection[] {
  return groupCollectionCards(rows.filter((row) => row.status === segment));
}
