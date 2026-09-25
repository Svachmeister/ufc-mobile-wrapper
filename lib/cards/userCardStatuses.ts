import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth/SessionContext';
import { myMarkedCardsKey } from './collectionQueries';

export type CardStatus = 'owned' | 'wanted';
export type MyCardStatusMap = Record<string, CardStatus>;

const PAGE_SIZE = 1000;

function myCardStatusesKey(userId: string | undefined) {
  return ['cards', 'my-statuses', userId] as const;
}

async function fetchMyCardStatuses(userId: string): Promise<MyCardStatusMap> {
  const map: MyCardStatusMap = {};
  let offset = 0;

  while (true) {
    // RLS (user_id = auth.uid()) already scopes this to the signed-in user's
    // own rows — this .eq is not standing in for that, it's here so the
    // query can use an index on user_id rather than a full-table RLS scan
    // once a collector has thousands of marks.
    const { data, error } = await supabase
      .from('user_cards')
      .select('card_id, status')
      .eq('user_id', userId)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    const rows = data ?? [];
    for (const row of rows) {
      // This ticket only handles 'owned' and 'wanted' — any other status
      // value is left out of the map rather than mis-rendered as one of these.
      if (row.status === 'owned' || row.status === 'wanted') {
        map[row.card_id] = row.status;
      }
    }
    if (rows.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return map;
}

/**
 * One shared cache of the signed-in user's marks, keyed by userId so every
 * screen that renders a ParallelChip or the card detail toggles reads (and,
 * via useSetCardStatus, writes) the same query.
 */
export function useMyCardStatuses() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: myCardStatusesKey(userId),
    queryFn: () => fetchMyCardStatuses(userId as string),
    enabled: Boolean(userId),
  });
}

/** null means the card has no mark (no user_cards row). */
export type NextCardStatus = CardStatus | null;

/**
 * The toggle rules, in one place: pressing the button that matches the
 * current mark clears it; pressing the other one, or either from a blank
 * card, switches to it. Callers run this on the status they're displaying
 * at the moment of the press, before anything touches the cache.
 */
export function nextStatusFor(current: CardStatus | undefined, pressed: CardStatus): NextCardStatus {
  return current === pressed ? null : pressed;
}

export type SetCardStatusParams = {
  cardId: string;
  nextStatus: NextCardStatus;
};

function withCardStatus(
  map: MyCardStatusMap | undefined,
  cardId: string,
  status: NextCardStatus,
): MyCardStatusMap {
  const next: MyCardStatusMap = { ...(map ?? {}) };
  if (status === null) {
    delete next[cardId];
  } else {
    next[cardId] = status;
  }
  return next;
}

/**
 * Variables carry the final state for the card, decided by the caller.
 * mutationFn must not derive it from the cache: TanStack Query awaits
 * onMutate (which has already written the optimistic value) before it
 * starts mutationFn, so reading the cache there sees the new state, not
 * the old one — that is what inverted every write in M4-A.
 */
export function useSetCardStatus() {
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const key = myCardStatusesKey(userId);

  return useMutation({
    mutationFn: async ({ cardId, nextStatus }: SetCardStatusParams) => {
      if (!userId) {
        throw new Error('Not signed in');
      }

      if (nextStatus === null) {
        const { error } = await supabase.from('user_cards').delete().eq('user_id', userId).eq('card_id', cardId);
        if (error) {
          throw error;
        }
        return;
      }

      // Upsert only user_id, card_id, status — owned is trigger-maintained,
      // image_url and parallel_id must never be sent by the client.
      const { error } = await supabase
        .from('user_cards')
        .upsert({ user_id: userId, card_id: cardId, status: nextStatus }, { onConflict: 'user_id,card_id' });
      if (error) {
        throw error;
      }
    },
    onMutate: async ({ cardId, nextStatus }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previousStatus: NextCardStatus = queryClient.getQueryData<MyCardStatusMap>(key)?.[cardId] ?? null;
      queryClient.setQueryData<MyCardStatusMap>(key, (map) => withCardStatus(map, cardId, nextStatus));
      return { previousStatus };
    },
    onError: (error, { cardId }, context) => {
      console.error('[cards:set-status]', error);
      // Restores only this card's mark, so a failed write can't roll back
      // other cards' optimistic marks made in the meantime.
      if (context) {
        queryClient.setQueryData<MyCardStatusMap>(key, (map) => withCardStatus(map, cardId, context.previousStatus));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      // M4-B's Collection tab reads the same marks through a separate,
      // richer query — every write here must refresh it too so marking a
      // card on the Cards tab shows up there without a manual refresh.
      queryClient.invalidateQueries({ queryKey: myMarkedCardsKey(userId) });
    },
  });
}
