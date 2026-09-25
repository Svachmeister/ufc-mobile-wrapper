import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { groupFighterCards, type FighterCardRow, type FighterSetSection } from './cardGrouping';

const FIGHTER_LIST_PAGE_SIZE = 100;
const FIGHTER_LIST_COLUMNS = 'id, name, weight_class, nationality';

export type FighterListRow = {
  id: string;
  name: string;
  weight_class: string | null;
  nationality: string | null;
};

// Postgres treats \, % and _ as special inside a LIKE/ILIKE pattern — escape
// them so a fighter searching for e.g. "O'Malley" or a name with an
// underscore gets a literal match instead of a wildcard.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

async function fetchFightersPage(search: string, offset: number): Promise<FighterListRow[]> {
  let query = supabase
    .from('fighters')
    .select(FIGHTER_LIST_COLUMNS)
    .order('name', { ascending: true })
    .range(offset, offset + FIGHTER_LIST_PAGE_SIZE - 1);

  const trimmed = search.trim();
  if (trimmed) {
    query = query.ilike('name', `%${escapeLikePattern(trimmed)}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data ?? [];
}

export function useFightersList(search: string) {
  return useInfiniteQuery({
    queryKey: ['cards', 'fighters', search.trim().toLowerCase()],
    queryFn: ({ pageParam }) => fetchFightersPage(search, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < FIGHTER_LIST_PAGE_SIZE ? undefined : allPages.length * FIGHTER_LIST_PAGE_SIZE,
  });
}

const FIGHTER_DETAIL_COLUMNS =
  'id, name, nickname, nationality, date_of_birth, weight_class, wins, losses, draws, image_url, height, reach, stance, last_five';

// Every field below id can be null — the database's fighter coverage is not
// complete, same caveat as lib/fantasy/picksFlow.ts's FlowFighter.
export type FighterDetailRow = {
  id: string;
  name: string | null;
  nickname: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  weight_class: string | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  image_url: string | null;
  height: string | null;
  reach: string | null;
  stance: string | null;
  last_five: string | null;
};

async function fetchFighterDetail(fighterId: string): Promise<FighterDetailRow | null> {
  const { data, error } = await supabase
    .from('fighters')
    .select(FIGHTER_DETAIL_COLUMNS)
    .eq('id', fighterId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}

export function useFighterDetail(fighterId: string) {
  return useQuery({
    queryKey: ['cards', 'fighter-detail', fighterId],
    queryFn: () => fetchFighterDetail(fighterId),
    enabled: Boolean(fighterId),
  });
}

const FIGHTER_CARDS_PAGE_SIZE = 1000;
const FIGHTER_CARDS_COLUMNS =
  'cards(id, set_id, subset, card_number, variation, print_run, is_rookie, sets(name, year, sort_order))';

type RawFighterCard = {
  id: string;
  set_id: string;
  subset: string;
  card_number: string;
  variation: string;
  print_run: number | null;
  is_rookie: boolean;
  sets: { name: string; year: number; sort_order: number } | { name: string; year: number; sort_order: number }[] | null;
};

type RawFighterCardLink = {
  // card_fighters.card_id -> cards.id is many-to-one, so this embeds as a
  // single object in practice; the array form is handled defensively, same
  // as the sets embed in lib/cards/queries.ts's fetchCardDetail.
  cards: RawFighterCard | RawFighterCard[] | null;
};

async function fetchFighterCardsPage(fighterId: string, offset: number): Promise<RawFighterCardLink[]> {
  const { data, error } = await supabase
    .from('card_fighters')
    .select(FIGHTER_CARDS_COLUMNS)
    .eq('fighter_id', fighterId)
    .range(offset, offset + FIGHTER_CARDS_PAGE_SIZE - 1);
  if (error) {
    throw error;
  }
  return (data ?? []) as unknown as RawFighterCardLink[];
}

export function useFighterCards(fighterId: string) {
  return useInfiniteQuery({
    queryKey: ['cards', 'fighter-cards', fighterId],
    queryFn: ({ pageParam }) => fetchFighterCardsPage(fighterId, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < FIGHTER_CARDS_PAGE_SIZE ? undefined : allPages.length * FIGHTER_CARDS_PAGE_SIZE,
    enabled: Boolean(fighterId),
  });
}

function normalizeFighterCardRow(row: RawFighterCardLink): FighterCardRow | null {
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
    subset: card.subset,
    card_number: card.card_number,
    variation: card.variation,
    print_run: card.print_run,
    is_rookie: card.is_rookie,
    set_name: set.name,
    set_year: set.year,
    set_sort_order: set.sort_order,
  };
}

export function buildFighterCardSections(pages: RawFighterCardLink[][] | undefined): {
  sections: FighterSetSection[];
  total: number;
} {
  const rows = (pages ?? [])
    .flatMap((page) => page)
    .map(normalizeFighterCardRow)
    .filter((row): row is FighterCardRow => row != null);
  const sections = groupFighterCards(rows);
  const total = sections.reduce((sum, section) => sum + section.cards.length, 0);
  return { sections, total };
}
