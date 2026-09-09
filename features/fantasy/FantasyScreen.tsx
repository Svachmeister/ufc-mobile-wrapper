import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import { Button, Screen, SegmentedControl, Text } from '@/components/ui';
import { borderWidths, colors, radius, spacing } from '@/theme/tokens';
import {
  deriveEventState,
  formatCountdown,
  formatLocalStartTime,
  formatShortEventDate,
  selectDisplayMainEventFight,
  shortEventName,
  surname,
  type EventRow,
  type EventState,
  type FightRow,
} from '@/lib/fantasy/eventState';
import { MoreEventRow, useFeaturedEvent, useFeaturedEventUserData, useMoreEvents } from '@/lib/fantasy/queries';

type Tab = 'events' | 'leaderboard';

type FantasyScreenProps = {
  eventId?: string;
};

export function FantasyScreen({ eventId }: FantasyScreenProps) {
  const [tab, setTab] = useState<Tab>('events');

  return (
    <Screen>
      <View style={styles.segmentWrap}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'events', label: 'Events' },
            { value: 'leaderboard', label: 'Leaderboard' },
          ]}
        />
      </View>

      {tab === 'leaderboard' ? (
        <View style={styles.centered}>
          <Text variant="body">Leaderboard arrives with the picks flow.</Text>
        </View>
      ) : (
        <EventsPane eventId={eventId} />
      )}
    </Screen>
  );
}

function EventsPane({ eventId }: { eventId?: string }) {
  const router = useRouter();
  const featured = useFeaturedEvent(eventId);
  const list = useMoreEvents(featured.data?.event.id);

  if (featured.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brandRed} />
      </View>
    );
  }

  if (featured.isError) {
    return (
      <View style={styles.centered}>
        <Text variant="body" style={styles.errorText}>
          Could not load events.
        </Text>
        <Button variant="outline" label="Try again" onPress={() => featured.refetch()} style={styles.retryButton} />
      </View>
    );
  }

  if (!featured.data) {
    return (
      <View style={styles.centered}>
        <Text variant="body">No events yet.</Text>
      </View>
    );
  }

  const { event, fights } = featured.data;
  const nowMs = Date.now();
  const state = deriveEventState(event, fights, nowMs);
  const rows = list.data?.pages.flatMap((page) => page.rows) ?? [];

  function handleRefresh() {
    featured.refetch();
    list.refetch();
  }

  function handleRowPress(row: MoreEventRow) {
    router.push(`/(tabs)/fantasy/${row.id}`);
  }

  return (
    <FlashList
      data={rows}
      keyExtractor={(row) => row.id}
      renderItem={({ item }) => <MoreEventRowItem row={item} onPress={() => handleRowPress(item)} />}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) {
          list.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      refreshing={featured.isRefetching || list.isRefetching}
      onRefresh={handleRefresh}
      ListHeaderComponent={
        <>
          <FeaturedEventBlock event={event} fights={fights} state={state} />
          {rows.length > 0 ? (
            <Text variant="heading" style={styles.moreEventsHeading}>
              More events
            </Text>
          ) : null}
        </>
      }
      ListEmptyComponent={
        !list.isLoading ? (
          <View style={styles.centered}>
            <Text variant="body">No other events.</Text>
          </View>
        ) : null
      }
      contentContainerStyle={styles.listContent}
    />
  );
}

function FeaturedEventBlock({ event, fights, state }: { event: EventRow; fights: FightRow[]; state: EventState }) {
  const mainEventFight = selectDisplayMainEventFight(fights);
  const mainEventLine = mainEventFight
    ? `${surname(mainEventFight.fighter1)} vs ${surname(mainEventFight.fighter2)}`
    : event.name;

  const venueParts = [event.venue, event.city, event.country].filter(Boolean);
  const venueLine = venueParts.join(', ');
  const startTime = formatLocalStartTime(event.starts_at);

  return (
    <View style={styles.featured}>
      <View style={styles.labelRow}>
        <Text variant="label" color="textSecondary">
          {shortEventName(event.name)} · {formatShortEventDate(event.starts_at)}
        </Text>
        {state === 'LIVE' ? (
          <Text variant="label" color="brandRed">
            Live
          </Text>
        ) : null}
      </View>

      <Text variant="display" style={styles.mainEvent}>
        {mainEventLine}
      </Text>

      <Text variant="body" color="textSecondary" style={styles.venueLine}>
        {venueLine ? `${venueLine} · ${startTime}` : startTime}
      </Text>

      <FeaturedEventStatus
        eventId={event.id}
        totalFights={fights.length}
        state={state}
        picksCloseAt={event.picks_close_at}
      />
    </View>
  );
}

function FeaturedEventStatus({
  eventId,
  totalFights,
  state,
  picksCloseAt,
}: {
  eventId: string;
  totalFights: number;
  state: EventState;
  picksCloseAt: string | null;
}) {
  const userData = useFeaturedEventUserData(eventId, state);

  if (userData.isLoading || !userData.data) {
    return (
      <View style={styles.statusLoading}>
        <ActivityIndicator color={colors.brandRed} />
      </View>
    );
  }

  const { pickedCount, hasCaptain, pickEntryStatus, totalPoints } = userData.data;

  if (state === 'FINAL') {
    return (
      <View style={styles.statusBlock}>
        {totalPoints != null ? (
          <Text variant="numeric">{totalPoints} PTS</Text>
        ) : (
          <Text variant="body" color="textSecondary">
            Did not play
          </Text>
        )}
      </View>
    );
  }

  if (state === 'LOCKED' || state === 'LIVE') {
    const notSubmitted = pickEntryStatus !== 'completed';
    return (
      <View style={styles.statusBlock}>
        <Text variant="body" color={notSubmitted ? 'brandRed' : 'textPrimary'}>
          {notSubmitted ? 'Not submitted · 0 pts' : 'Picks locked'}
        </Text>
        {/* Renders the real primary action; it intentionally does nothing yet — the picks flow lands in the next milestone. */}
        <Button variant="outline" label="View your picks" onPress={() => {}} style={styles.actionButton} />
      </View>
    );
  }

  const countdown = picksCloseAt ? `Picks close in ${formatCountdown(picksCloseAt, Date.now())}` : 'Picks open';
  const label =
    pickedCount === 0
      ? 'Make your picks'
      : pickedCount < totalFights
        ? `Continue picks · ${pickedCount} of ${totalFights}`
        : hasCaptain
          ? 'Review picks'
          : 'Pick your champion';

  return (
    <View style={styles.statusBlock}>
      <View style={styles.statusRow}>
        <Text variant="body">{countdown}</Text>
        <Text variant="body" color="textSecondary">
          {totalFights} fights
        </Text>
      </View>
      <Button label={label} onPress={() => {}} style={styles.actionButton} />
    </View>
  );
}

function MoreEventRowItem({ row, onPress }: { row: MoreEventRow; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.rowLeft}>
        <Text variant="body" color={row.state === 'FINAL' ? 'textSecondary' : 'textPrimary'}>
          {row.name}
        </Text>
        <Text variant="label" color="textSecondary">
          {formatShortEventDate(row.starts_at)}
        </Text>
      </View>
      <RowStateLabel row={row} />
    </Pressable>
  );
}

function RowStateLabel({ row }: { row: MoreEventRow }) {
  if (row.state === 'OPEN') {
    return <Text variant="label">Open</Text>;
  }
  if (row.state === 'LIVE') {
    return (
      <Text variant="label" color="brandRed">
        Live
      </Text>
    );
  }
  if (row.state === 'LOCKED') {
    return (
      <Text variant="label" color="textSecondary">
        Locked
      </Text>
    );
  }
  if (row.totalPoints == null) {
    return (
      <Text variant="label" color="textSecondary">
        Final
      </Text>
    );
  }
  return (
    <Text variant="label" color="textSecondary">
      Final · <Text variant="label">{row.totalPoints} PTS</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  segmentWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    alignSelf: 'center',
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  featured: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mainEvent: {
    marginTop: spacing.xs,
  },
  venueLine: {
    marginTop: spacing.xs,
  },
  statusBlock: {
    marginTop: spacing.md,
  },
  statusLoading: {
    marginTop: spacing.md,
    alignItems: 'flex-start',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  actionButton: {
    alignSelf: 'stretch',
  },
  moreEventsHeading: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: borderWidths.structural,
    borderColor: colors.border,
    borderRadius: radius.none,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  rowLeft: {
    flexShrink: 1,
    gap: spacing.xs,
  },
});
