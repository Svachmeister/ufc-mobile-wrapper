import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth/SessionContext';

// Exactly the columns the picks flow renders — nothing wider is selected.
const FLOW_FIGHT_COLUMNS =
  'id, fighter1, fighter2, fighter1_id, fighter2_id, weight_class, fight_order, is_five_round_fight, is_title_fight';
const FLOW_FIGHTER_COLUMNS =
  'id, name, nationality, date_of_birth, height, reach, wins, losses, draws, image_url, last_five';
const FLOW_PICK_COLUMNS = 'fight_id, picked_fighter_id, picked_method, picked_round, is_captain';

export type FightSlot = 'fighter1' | 'fighter2';

export const PICK_METHODS = ['KO/TKO', 'Submission', 'Decision'] as const;
export type PickMethod = (typeof PICK_METHODS)[number];

export type FlowFight = {
  id: string;
  fighter1: string;
  fighter2: string;
  fighter1_id: string | null;
  fighter2_id: string | null;
  weight_class: string | null;
  fight_order: number;
  is_five_round_fight: boolean;
  is_title_fight: boolean;
};

// Fighter coverage is not 100% in the database: every field below the id can
// be null, so the screen renders a placeholder rather than a blank or "null".
export type FlowFighter = {
  id: string;
  name: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  height: string | null;
  reach: string | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  image_url: string | null;
  // Oldest first, newest last, up to five characters from W/L/D/N. Empty for
  // every fighter until a separate job backfills it.
  last_five: string | null;
};

export type FlowPick = {
  fight_id: string;
  picked_fighter_id: string | null;
  picked_method: string | null;
  picked_round: number | null;
  is_captain: boolean;
};

export type PicksFlowData = {
  fights: FlowFight[];
  fightersById: Record<string, FlowFighter>;
  picksByFightId: Record<string, FlowPick>;
};

// Mirrors lib/auth/errors.ts: the raw error always reaches Metro before the
// user ever sees a friendly one-liner.
export function logPickError(context: string, error: unknown): void {
  if (error && typeof error === 'object') {
    const { name, code, message, details } = error as {
      name?: unknown;
      code?: unknown;
      message?: unknown;
      details?: unknown;
    };
    console.error(`[picks:${context}]`, name, code, message, details, error);
  } else {
    console.error(`[picks:${context}]`, error);
  }
}

/**
 * Picks close through an RLS policy (app_private.picks_are_open_for_fight), so
 * a write into a locked card comes back as a row-level-security violation —
 * Postgres 42501 — for both the INSERT and the ON CONFLICT DO UPDATE branch of
 * the upsert. Anything else is an ordinary, retryable failure.
 */
export function isPicksClosedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === '42501') {
    return true;
  }
  return typeof message === 'string' && message.toLowerCase().includes('row-level security');
}

export async function fetchPicksFlowData(eventId: string, userId: string): Promise<PicksFlowData> {
  const { data: fights, error: fightsError } = await supabase
    .from('fights')
    .select(FLOW_FIGHT_COLUMNS)
    .eq('event_id', eventId)
    .order('fight_order', { ascending: true });
  if (fightsError) {
    throw fightsError;
  }

  const fightRows = (fights ?? []) as FlowFight[];
  const fighterIds = Array.from(
    new Set(fightRows.flatMap((fight) => [fight.fighter1_id, fight.fighter2_id]).filter((id): id is string => !!id)),
  );

  const fightersById: Record<string, FlowFighter> = {};
  if (fighterIds.length > 0) {
    const { data: fighters, error: fightersError } = await supabase
      .from('fighters')
      .select(FLOW_FIGHTER_COLUMNS)
      .in('id', fighterIds);
    if (fightersError) {
      throw fightersError;
    }
    for (const fighter of (fighters ?? []) as FlowFighter[]) {
      fightersById[fighter.id] = fighter;
    }
  }

  const picksByFightId: Record<string, FlowPick> = {};
  if (fightRows.length > 0) {
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select(FLOW_PICK_COLUMNS)
      .eq('user_id', userId)
      .in(
        'fight_id',
        fightRows.map((fight) => fight.id),
      );
    if (picksError) {
      throw picksError;
    }
    for (const pick of (picks ?? []) as FlowPick[]) {
      picksByFightId[pick.fight_id] = pick;
    }
  }

  return { fights: fightRows, fightersById, picksByFightId };
}

/**
 * One load when the flow opens and no further reads: the query never goes
 * stale on its own, and neither a refocus nor a remount refetches it.
 */
export function usePicksFlowData(eventId: string | undefined) {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['fantasy', 'picks-flow', eventId, userId],
    queryFn: () => fetchPicksFlowData(eventId as string, userId as string),
    enabled: Boolean(eventId && userId),
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export type SavePickParams = {
  userId: string;
  fight: FlowFight;
  slot: FightSlot;
  method: PickMethod | null;
  round: number | null;
  isCaptain: boolean;
};

/**
 * `picks` is unique on (user_id, fight_id), so every write is an upsert on that
 * pair. `is_captain` is carried over from the existing row untouched — the
 * champion is chosen elsewhere and must survive an edit here.
 */
export async function savePick({ userId, fight, slot, method, round, isCaptain }: SavePickParams): Promise<void> {
  const { error } = await supabase.from('picks').upsert(
    {
      user_id: userId,
      fight_id: fight.id,
      picked_fighter_id: slot === 'fighter1' ? fight.fighter1_id : fight.fighter2_id,
      picked_winner: slot === 'fighter1' ? fight.fighter1 : fight.fighter2,
      picked_method: method,
      picked_round: round,
      is_captain: isCaptain,
    },
    { onConflict: 'user_id,fight_id' },
  );
  if (error) {
    throw error;
  }
}

// pick_entries is SELECT-only for the client; this function is what maintains
// the row, and it reads the user from auth.uid().
export async function recomputePickEntry(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('recompute_pick_entry', { p_event_id: eventId });
  if (error) {
    throw error;
  }
}
