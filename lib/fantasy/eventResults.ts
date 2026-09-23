import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth/SessionContext';
import { surname } from './eventState';

const EVENT_COLUMNS = 'id, name';
const FIGHT_COLUMNS =
  'id, event_id, fighter1, fighter2, fighter1_id, fighter2_id, fight_order, winner, winner_fighter_id, method, round, is_main_event';
const FIGHTER_COLUMNS = 'id, name';
const EVENT_SCORE_COLUMNS = 'base_points, bonus_points, total_points, perfect_card, calculated_at';
const PICK_ENTRY_COLUMNS = 'status, completed_snapshot';

export type EventResultsEventRow = {
  id: string;
  name: string;
};

export type EventResultsFightRow = {
  id: string;
  event_id: string;
  fighter1: string;
  fighter2: string;
  fighter1_id: string | null;
  fighter2_id: string | null;
  fight_order: number;
  winner: string | null;
  winner_fighter_id: string | null;
  method: string | null;
  round: number | null;
  is_main_event: boolean;
};

export type EventResultsFighter = {
  id: string;
  name: string | null;
};

export type EventScoreRow = {
  base_points: number;
  bonus_points: number;
  total_points: number;
  perfect_card: boolean;
  calculated_at: string | null;
};

// One entry per fight the server actually scored — this is the record of
// what was submitted, independent of any later edit to the live picks.
export type SnapshotEntry = {
  picked_fighter_id: string | null;
  picked_method: string | null;
  picked_round: number | null;
  is_captain: boolean;
};

export type EventLeaderboardRow = {
  rank: number;
  username: string;
  total_points: number;
  perfect_card: boolean;
};

export type EventResultsData = {
  event: EventResultsEventRow | null;
  fights: EventResultsFightRow[];
  fightersById: Record<string, EventResultsFighter>;
  eventScore: EventScoreRow | null;
  snapshot: Record<string, SnapshotEntry>;
  leaderboard: EventLeaderboardRow[];
  ownUsername: string | null;
};

// completed_snapshot is jsonb of unknown shape until validated — a missing or
// malformed column (nothing has completed yet) must render an empty
// breakdown, not throw.
function parseSnapshot(raw: unknown): Record<string, SnapshotEntry> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const fights = (raw as { fights?: unknown }).fights;
  if (!fights || typeof fights !== 'object') {
    return {};
  }
  return fights as Record<string, SnapshotEntry>;
}

async function fetchEventResultsData(eventId: string, userId: string): Promise<EventResultsData> {
  const [eventRes, fightsRes] = await Promise.all([
    supabase.from('events').select(EVENT_COLUMNS).eq('id', eventId).maybeSingle(),
    supabase.from('fights').select(FIGHT_COLUMNS).eq('event_id', eventId).order('fight_order', { ascending: true }),
  ]);
  if (eventRes.error) {
    throw eventRes.error;
  }
  if (fightsRes.error) {
    throw fightsRes.error;
  }

  const fights = (fightsRes.data ?? []) as EventResultsFightRow[];
  const fighterIds = Array.from(
    new Set(fights.flatMap((fight) => [fight.fighter1_id, fight.fighter2_id]).filter((id): id is string => !!id)),
  );

  const [fightersRes, scoreRes, entryRes, profileRes, leaderboardRes] = await Promise.all([
    fighterIds.length > 0
      ? supabase.from('fighters').select(FIGHTER_COLUMNS).in('id', fighterIds)
      : Promise.resolve({ data: [] as EventResultsFighter[], error: null }),
    supabase.from('event_scores').select(EVENT_SCORE_COLUMNS).eq('user_id', userId).eq('event_id', eventId).maybeSingle(),
    supabase.from('pick_entries').select(PICK_ENTRY_COLUMNS).eq('user_id', userId).eq('event_id', eventId).maybeSingle(),
    supabase.from('profiles').select('username').eq('id', userId).maybeSingle(),
    supabase.rpc('get_event_leaderboard', { p_event_id: eventId, p_limit: 100 }),
  ]);

  if (fightersRes.error) {
    throw fightersRes.error;
  }
  if (scoreRes.error) {
    throw scoreRes.error;
  }
  if (entryRes.error) {
    throw entryRes.error;
  }
  if (profileRes.error) {
    throw profileRes.error;
  }
  if (leaderboardRes.error) {
    throw leaderboardRes.error;
  }

  const fightersById: Record<string, EventResultsFighter> = {};
  for (const fighter of (fightersRes.data ?? []) as EventResultsFighter[]) {
    fightersById[fighter.id] = fighter;
  }

  return {
    event: (eventRes.data ?? null) as EventResultsEventRow | null,
    fights,
    fightersById,
    eventScore: (scoreRes.data ?? null) as EventScoreRow | null,
    snapshot: parseSnapshot(entryRes.data?.completed_snapshot),
    leaderboard: (leaderboardRes.data ?? []) as EventLeaderboardRow[],
    ownUsername: profileRes.data?.username ?? null,
  };
}

function eventResultsQueryKey(eventId: string | undefined, userId: string | undefined) {
  return ['fantasy', 'event-results', eventId, userId] as const;
}

export function useEventResultsData(eventId: string | undefined) {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: eventResultsQueryKey(eventId, userId),
    queryFn: () => fetchEventResultsData(eventId as string, userId as string),
    enabled: Boolean(eventId && userId),
  });
}

/**
 * Mirrors the server's per-fight scoring exactly: round match beats method
 * match beats a bare winner, `Decision` is matched by prefix on both the
 * actual result and the pick, and a non-zero result is doubled for the
 * champion fight. Returns null when there is nothing to score yet — no
 * winner_fighter_id on the fight. Never reads picks.points_earned.
 */
export function scoreFightFromSnapshot(entry: SnapshotEntry | undefined, fight: EventResultsFightRow): number | null {
  if (!entry || !fight.winner_fighter_id) {
    return null;
  }

  const winnerMatches = entry.picked_fighter_id === fight.winner_fighter_id;
  const methodsMatch = normalizeMethod(entry.picked_method) === normalizeMethod(fight.method);

  let base: number;
  if (entry.picked_round != null) {
    base = winnerMatches && methodsMatch && entry.picked_round === fight.round ? 100 : 0;
  } else if (entry.picked_method) {
    base = winnerMatches && methodsMatch ? 25 : 0;
  } else {
    base = winnerMatches ? 10 : 0;
  }

  return entry.is_captain && base > 0 ? base * 2 : base;
}

function normalizeMethod(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  return raw.startsWith('Decision') ? 'Decision' : raw;
}

/** `SUB R3`, `DEC`, `KO/TKO` — null when there is no method to show. */
export function formatMethodRound(method: string | null, round: number | null): string | null {
  if (!method) {
    return null;
  }
  const label = method.startsWith('Decision') ? 'DEC' : method === 'Submission' ? 'SUB' : method.toUpperCase();
  return round != null ? `${label} R${round}` : label;
}

/** The full name of a fight's fighter, falling back to the fight row's own text field. */
export function resolveFighterFullName(
  fighterId: string | null,
  fight: EventResultsFightRow,
  fightersById: Record<string, EventResultsFighter>,
): string | null {
  if (!fighterId) {
    return null;
  }
  const fallback = fighterId === fight.fighter1_id ? fight.fighter1 : fighterId === fight.fighter2_id ? fight.fighter2 : null;
  const name = fightersById[fighterId]?.name?.trim();
  return name || fallback || null;
}

export function fighterSurname(
  fighterId: string | null,
  fight: EventResultsFightRow,
  fightersById: Record<string, EventResultsFighter>,
): string | null {
  const fullName = resolveFighterFullName(fighterId, fight, fightersById);
  return fullName ? surname(fullName).toUpperCase() : null;
}
