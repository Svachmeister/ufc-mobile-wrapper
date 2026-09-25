import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { orderSubsets, sortParallels, type ChecklistRow, type ParallelInfo, type SetRow } from './cardGrouping';

export type { SetRow } from './cardGrouping';

const SET_COLUMNS = 'id, name, year, manufacturer, sort_order';

async function fetchSets(): Promise<SetRow[]> {
  // 51 rows total — small enough for one request, no .range() needed.
  const { data, error } = await supabase.from('sets').select(SET_COLUMNS);
  if (error) {
    throw error;
  }
  return data ?? [];
}

export function useSets() {
  return useQuery({
    queryKey: ['cards', 'sets'],
    queryFn: fetchSets,
  });
}

async function fetchSet(setId: string): Promise<SetRow | null> {
  const { data, error } = await supabase.from('sets').select(SET_COLUMNS).eq('id', setId).maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}

export function useSet(setId: string) {
  return useQuery({
    queryKey: ['cards', 'set', setId],
    queryFn: () => fetchSet(setId),
    enabled: Boolean(setId),
  });
}

const SUBSET_PAGE_SIZE = 1000;

async function fetchSetSubsets(setId: string): Promise<string[]> {
  const found = new Set<string>();
  let offset = 0;

  // Only the subset column, paged until exhausted — never the whole set's cards.
  while (true) {
    const { data, error } = await supabase
      .from('cards')
      .select('subset')
      .eq('set_id', setId)
      .range(offset, offset + SUBSET_PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    const rows = data ?? [];
    for (const row of rows) {
      if (row.subset) {
        found.add(row.subset);
      }
    }
    if (rows.length < SUBSET_PAGE_SIZE) {
      break;
    }
    offset += SUBSET_PAGE_SIZE;
  }

  return orderSubsets(Array.from(found));
}

export function useSetSubsets(setId: string) {
  return useQuery({
    queryKey: ['cards', 'subsets', setId],
    queryFn: () => fetchSetSubsets(setId),
    // Cached per set for the life of the query client — the ticket asks for
    // the discovered subset list to be cached per set, not re-walked on
    // every visit.
    staleTime: Infinity,
    enabled: Boolean(setId),
  });
}

const CHECKLIST_PAGE_SIZE = 1000;
const CHECKLIST_COLUMNS = 'id, card_number, variation, print_run, fighter_name, is_rookie';

async function fetchChecklistPage(setId: string, subset: string, offset: number): Promise<ChecklistRow[]> {
  const { data, error } = await supabase
    .from('cards')
    .select(CHECKLIST_COLUMNS)
    .eq('set_id', setId)
    .eq('subset', subset)
    .range(offset, offset + CHECKLIST_PAGE_SIZE - 1);
  if (error) {
    throw error;
  }
  return data ?? [];
}

export function useSetChecklist(setId: string, subset: string | null) {
  return useInfiniteQuery({
    queryKey: ['cards', 'checklist', setId, subset],
    queryFn: ({ pageParam }) => fetchChecklistPage(setId, subset as string, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < CHECKLIST_PAGE_SIZE ? undefined : allPages.length * CHECKLIST_PAGE_SIZE,
    enabled: Boolean(setId && subset),
  });
}

export type CardDetailCard = {
  id: string;
  set_id: string;
  subset: string;
  card_number: string;
  is_rookie: boolean;
  setName: string;
};

export type CardDetailData = {
  card: CardDetailCard;
  parallels: ParallelInfo[];
  fighterNames: string[];
};

async function fetchCardDetail(cardId: string): Promise<CardDetailData | null> {
  const { data: cardRow, error: cardError } = await supabase
    .from('cards')
    .select('id, set_id, subset, card_number, is_rookie, sets(name)')
    .eq('id', cardId)
    .maybeSingle();
  if (cardError) {
    throw cardError;
  }
  if (!cardRow) {
    return null;
  }

  const { data: siblings, error: siblingsError } = await supabase
    .from('cards')
    .select('id, variation, print_run')
    .eq('set_id', cardRow.set_id)
    .eq('subset', cardRow.subset)
    .eq('card_number', cardRow.card_number);
  if (siblingsError) {
    throw siblingsError;
  }

  const siblingIds = (siblings ?? []).map((row) => row.id as string);

  const { data: cardFighters, error: cardFightersError } =
    siblingIds.length > 0
      ? await supabase.from('card_fighters').select('card_id, fighter_id, position').in('card_id', siblingIds)
      : { data: [] as { card_id: string; fighter_id: string; position: number }[], error: null };
  if (cardFightersError) {
    throw cardFightersError;
  }

  const bestPositionByFighter = new Map<string, number>();
  for (const row of cardFighters ?? []) {
    const existing = bestPositionByFighter.get(row.fighter_id);
    if (existing === undefined || row.position < existing) {
      bestPositionByFighter.set(row.fighter_id, row.position);
    }
  }
  const fighterIds = Array.from(bestPositionByFighter.keys());

  let fighterNames: string[] = [];
  if (fighterIds.length > 0) {
    const { data: fighters, error: fightersError } = await supabase
      .from('fighters')
      .select('id, name')
      .in('id', fighterIds);
    if (fightersError) {
      throw fightersError;
    }
    fighterNames = (fighters ?? [])
      .slice()
      .sort((a, b) => (bestPositionByFighter.get(a.id) ?? 0) - (bestPositionByFighter.get(b.id) ?? 0))
      .map((fighter) => fighter.name);
  }

  const setRelation = (cardRow as { sets?: { name: string } | { name: string }[] | null }).sets;
  const setName = Array.isArray(setRelation) ? (setRelation[0]?.name ?? '') : (setRelation?.name ?? '');

  return {
    card: {
      id: cardRow.id,
      set_id: cardRow.set_id,
      subset: cardRow.subset,
      card_number: cardRow.card_number,
      is_rookie: cardRow.is_rookie,
      setName,
    },
    parallels: sortParallels(siblings ?? []),
    fighterNames,
  };
}

export function useCardDetail(cardId: string) {
  return useQuery({
    queryKey: ['cards', 'detail', cardId],
    queryFn: () => fetchCardDetail(cardId),
    enabled: Boolean(cardId),
  });
}
