import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth/SessionContext';
import { fetchPicksFlowData, recomputePickEntry, type PicksFlowData } from './picksFlow';

export type PickEntryStatus = 'completed' | 'not_completed' | 'missing';

export async function fetchPickEntryStatus(userId: string, eventId: string): Promise<PickEntryStatus> {
  const { data, error } = await supabase
    .from('pick_entries')
    .select('status')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return 'missing';
  }
  return data.status === 'completed' ? 'completed' : 'not_completed';
}

export type PicksSummaryData = PicksFlowData & { entryStatus: PickEntryStatus };

async function fetchPicksSummaryData(eventId: string, userId: string): Promise<PicksSummaryData> {
  const [flow, entryStatus] = await Promise.all([
    fetchPicksFlowData(eventId, userId),
    fetchPickEntryStatus(userId, eventId),
  ]);
  return { ...flow, entryStatus };
}

function summaryQueryKey(eventId: string | undefined, userId: string | undefined) {
  return ['fantasy', 'picks-summary', eventId, userId] as const;
}

/**
 * Unlike usePicksFlowData, this refetches every time the summary regains
 * focus — a champion change or a row edit happens on a screen pushed on top
 * of this one and writes straight to Supabase, bypassing this query's cache.
 */
export function usePicksSummaryData(eventId: string | undefined) {
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const hasFocusedOnce = useRef(false);

  const query = useQuery({
    queryKey: summaryQueryKey(eventId, userId),
    queryFn: () => fetchPicksSummaryData(eventId as string, userId as string),
    enabled: Boolean(eventId && userId),
  });

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        // The query's own mount already fetched fresh data once.
        hasFocusedOnce.current = true;
        return;
      }
      if (eventId && userId) {
        queryClient.invalidateQueries({ queryKey: summaryQueryKey(eventId, userId) });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId, userId, queryClient]),
  );

  return query;
}

export type SetChampionParams = {
  userId: string;
  eventId: string;
  newCaptainFightId: string;
  previousCaptainFightId: string | null;
};

/**
 * Mirrors the ticket's fixed order: clear the old captain before setting the
 * new one, then recompute once. Two captains at recompute time is an
 * incomplete computation, so the order matters.
 */
export async function setChampion({
  userId,
  eventId,
  newCaptainFightId,
  previousCaptainFightId,
}: SetChampionParams): Promise<void> {
  if (previousCaptainFightId && previousCaptainFightId !== newCaptainFightId) {
    const { error: clearError } = await supabase
      .from('picks')
      .update({ is_captain: false })
      .eq('user_id', userId)
      .eq('fight_id', previousCaptainFightId);
    if (clearError) {
      throw clearError;
    }
  }

  const { error: setError } = await supabase
    .from('picks')
    .update({ is_captain: true })
    .eq('user_id', userId)
    .eq('fight_id', newCaptainFightId);
  if (setError) {
    throw setError;
  }

  await recomputePickEntry(eventId);
}
