import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth/SessionContext';
import { deriveEventState, EventRow, EventState, FightRow, isEventFinal } from './eventState';

const EVENT_COLUMNS =
  'id, name, event_date, start_time, venue, city, country, picks_locked, starts_at, picks_close_at';
const FIGHT_COLUMNS = 'event_id, fighter1, fighter2, winner, is_main_event, fight_order';
const PAGE_SIZE = 10;

function groupFightsByEvent(fights: FightRow[]): Record<string, FightRow[]> {
  const grouped: Record<string, FightRow[]> = {};
  for (const fight of fights) {
    (grouped[fight.event_id] ??= []).push(fight);
  }
  return grouped;
}

async function fetchFightsForEvents(eventIds: string[]): Promise<FightRow[]> {
  if (eventIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase.from('fights').select(FIGHT_COLUMNS).in('event_id', eventIds);
  if (error) {
    throw error;
  }
  return data ?? [];
}

export type FeaturedEvent = {
  event: EventRow;
  fights: FightRow[];
};

/**
 * "Nearest" = earliest-starting non-final event. Finality depends on fights
 * data, not a trustworthy events column, so we fetch a small ascending
 * window of candidates (starting a day back, to still catch an event that's
 * already LIVE) and walk it in order until we find one that isn't final. If
 * every candidate is final (or there are none), we fall back to the single
 * most recent event overall, per the ticket's explicit fallback rule.
 */
async function resolveNearestEvent(): Promise<FeaturedEvent | null> {
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error: candidatesError } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .gte('starts_at', windowStart)
    .order('starts_at', { ascending: true })
    .limit(5);

  if (candidatesError) {
    throw candidatesError;
  }

  if (candidates && candidates.length > 0) {
    const fights = await fetchFightsForEvents(candidates.map((event) => event.id));
    const fightsByEvent = groupFightsByEvent(fights);

    for (const event of candidates) {
      const eventFights = fightsByEvent[event.id] ?? [];
      if (!isEventFinal(eventFights)) {
        return { event, fights: eventFights };
      }
    }
  }

  const { data: mostRecent, error: mostRecentError } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .order('starts_at', { ascending: false })
    .limit(1);

  if (mostRecentError) {
    throw mostRecentError;
  }

  if (!mostRecent || mostRecent.length === 0) {
    return null;
  }

  const event = mostRecent[0];
  const fights = await fetchFightsForEvents([event.id]);
  return { event, fights };
}

async function resolveEventById(eventId: string): Promise<FeaturedEvent | null> {
  const { data: event, error } = await supabase.from('events').select(EVENT_COLUMNS).eq('id', eventId).maybeSingle();
  if (error) {
    throw error;
  }
  if (!event) {
    return null;
  }
  const fights = await fetchFightsForEvents([event.id]);
  return { event, fights };
}

export function useFeaturedEvent(eventId?: string) {
  return useQuery({
    queryKey: ['fantasy', 'featured-event', eventId ?? 'nearest'],
    queryFn: () => (eventId ? resolveEventById(eventId) : resolveNearestEvent()),
  });
}

export type FeaturedEventUserData = {
  pickedCount: number;
  hasCaptain: boolean;
  pickEntryStatus: 'completed' | 'not_completed' | 'missing';
  totalPoints: number | null;
};

async function fetchFeaturedEventUserData(
  userId: string,
  eventId: string,
  state: EventState,
): Promise<FeaturedEventUserData> {
  if (state === 'OPEN') {
    // Filtered by the fight's own event_id via an embedded join, so we never
    // have to select fights.id (not part of the ticket's fight column list)
    // just to relate picks back to this event.
    const { data, error } = await supabase
      .from('picks')
      .select('is_captain, fights!inner(event_id)')
      .eq('user_id', userId)
      .eq('fights.event_id', eventId);
    if (error) {
      throw error;
    }
    const picks = data ?? [];
    return {
      pickedCount: picks.length,
      hasCaptain: picks.some((pick) => pick.is_captain),
      pickEntryStatus: 'missing',
      totalPoints: null,
    };
  }

  if (state === 'LOCKED' || state === 'LIVE') {
    const { data, error } = await supabase
      .from('pick_entries')
      .select('status')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return {
      pickedCount: 0,
      hasCaptain: false,
      pickEntryStatus: data ? (data.status === 'completed' ? 'completed' : 'not_completed') : 'missing',
      totalPoints: null,
    };
  }

  const { data, error } = await supabase
    .from('event_scores')
    .select('total_points')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return {
    pickedCount: 0,
    hasCaptain: false,
    pickEntryStatus: 'missing',
    totalPoints: data?.total_points ?? null,
  };
}

export function useFeaturedEventUserData(eventId: string | undefined, state: EventState | undefined) {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['fantasy', 'featured-event-user-data', eventId, state, userId],
    queryFn: () => fetchFeaturedEventUserData(userId as string, eventId as string, state as EventState),
    enabled: Boolean(userId && eventId && state),
  });
}

type ListPageParam = { phase: 'upcoming' | 'past'; offset: number };

export type MoreEventRow = EventRow & { state: EventState; totalPoints: number | null };

type ListPage = {
  rows: MoreEventRow[];
  nextParam: ListPageParam | null;
};

async function fetchEventsPage(pageParam: ListPageParam, userId: string, excludeEventId?: string): Promise<ListPage> {
  const nowIso = new Date().toISOString();

  const baseQuery = supabase.from('events').select(EVENT_COLUMNS);
  const orderedQuery =
    pageParam.phase === 'upcoming'
      ? baseQuery.gte('starts_at', nowIso).order('starts_at', { ascending: true })
      : baseQuery.lt('starts_at', nowIso).order('starts_at', { ascending: false });

  const { data, error } = await orderedQuery.range(pageParam.offset, pageParam.offset + PAGE_SIZE - 1);
  if (error) {
    throw error;
  }

  const pageEvents = (data ?? []).filter((event) => event.id !== excludeEventId);
  const fights = await fetchFightsForEvents(pageEvents.map((event) => event.id));
  const fightsByEvent = groupFightsByEvent(fights);
  const nowMs = Date.now();

  const rowsWithState = pageEvents.map((event) => ({
    ...event,
    state: deriveEventState(event, fightsByEvent[event.id] ?? [], nowMs),
  }));

  const finalEventIds = rowsWithState.filter((row) => row.state === 'FINAL').map((row) => row.id);
  let pointsByEvent: Record<string, number> = {};

  if (finalEventIds.length > 0) {
    const { data: scores, error: scoresError } = await supabase
      .from('event_scores')
      .select('event_id, total_points')
      .eq('user_id', userId)
      .in('event_id', finalEventIds);
    if (scoresError) {
      throw scoresError;
    }
    pointsByEvent = Object.fromEntries((scores ?? []).map((score) => [score.event_id, score.total_points]));
  }

  const rows: MoreEventRow[] = rowsWithState.map((row) => ({
    ...row,
    totalPoints: row.state === 'FINAL' ? (pointsByEvent[row.id] ?? null) : null,
  }));

  const isLastOfPhase = (data?.length ?? 0) < PAGE_SIZE;
  let nextParam: ListPageParam | null;
  if (!isLastOfPhase) {
    nextParam = { phase: pageParam.phase, offset: pageParam.offset + PAGE_SIZE };
  } else if (pageParam.phase === 'upcoming') {
    nextParam = { phase: 'past', offset: 0 };
  } else {
    nextParam = null;
  }

  return { rows, nextParam };
}

export function useMoreEvents(excludeEventId?: string) {
  const { session } = useSession();
  const userId = session?.user.id;

  return useInfiniteQuery({
    queryKey: ['fantasy', 'more-events', excludeEventId, userId],
    queryFn: ({ pageParam }) => fetchEventsPage(pageParam as ListPageParam, userId as string, excludeEventId),
    initialPageParam: { phase: 'upcoming', offset: 0 } as ListPageParam,
    getNextPageParam: (lastPage) => lastPage.nextParam,
    enabled: Boolean(userId),
  });
}
