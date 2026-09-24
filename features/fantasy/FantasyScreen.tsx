import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import { Button, Screen, SegmentedControl, Text } from '@/components/ui';
import { borderWidths, colors, radius, spacing, typography } from '@/theme/tokens';
import { useSession } from '@/lib/auth/SessionContext';
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
import {
  LeaderboardRow,
  MoreEventRow,
  useFeaturedEvent,
  useFeaturedEventUserData,
  useMoreEvents,
  useSeasonLeaderboard,
} from '@/lib/fantasy/queries';

type Tab = 'events' | 'leaderboard';

// The OPEN/LOCKED/LIVE state and the picks-close countdown must both stay
// live while this pane stays open, so the clock is refreshed on an interval
// rather than read once impurely during render. Once a second because the
// countdown displays remaining time down to the second.
const NOW_REFRESH_INTERVAL_MS = 1_000;

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

      {tab === 'leaderboard' ? <LeaderboardPane /> : <EventsPane eventId={eventId} />}
    </Screen>
  );
}

function EventsPane({ eventId }: { eventId?: string }) {
  const router = useRouter();
  const featured = useFeaturedEvent(eventId);
  const list = useMoreEvents(featured.data?.event.id);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), NOW_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

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
          <FeaturedEventBlock event={event} fights={fights} state={state} nowMs={nowMs} />
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

function LeaderboardPane() {
  const { session } = useSession();
  const userId = session?.user.id;
  const query = useSeasonLeaderboard();

  if (query.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brandRed} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.centered}>
        <Text variant="body" style={styles.errorText}>
          Could not load the leaderboard.
        </Text>
        <Button variant="outline" label="Try again" onPress={() => query.refetch()} style={styles.retryButton} />
      </View>
    );
  }

  const rows = query.data ?? [];
  const hasOwnRow = rows.some((row) => row.user_id === userId);

  return (
    <FlashList
      data={rows}
      keyExtractor={(row) => row.user_id}
      renderItem={({ item, index }) => (
        <LeaderboardRowItem row={item} isOwnRow={item.user_id === userId} isFirst={index === 0} />
      )}
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
      ListHeaderComponent={
        <Text variant="label" style={styles.leaderboardHeading}>
          Season standings
        </Text>
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text variant="body">No scores yet.</Text>
        </View>
      }
      ListFooterComponent={
        userId && !hasOwnRow && rows.length > 0 ? (
          <Text variant="body" color="textSecondary" style={styles.noPointsLine}>
            You have no points yet.
          </Text>
        ) : null
      }
      contentContainerStyle={styles.listContent}
    />
  );
}

function LeaderboardRowItem({ row, isOwnRow, isFirst }: { row: LeaderboardRow; isOwnRow: boolean; isFirst: boolean }) {
  const eventsLabel = `${row.events_played} ${row.events_played === 1 ? 'event' : 'events'}`;
  const perfectLabel =
    row.perfect_cards > 0 ? ` · ${row.perfect_cards} ${row.perfect_cards === 1 ? 'perfect' : 'perfects'}` : '';

  return (
    <View
      style={[styles.leaderboardRow, !isFirst && styles.leaderboardRowDivided, isOwnRow && styles.leaderboardRowOwn]}
    >
      <Text variant="body" style={styles.rank} numberOfLines={1}>
        {row.rank}
      </Text>
      <View style={styles.leaderboardMiddle}>
        <Text variant="body" style={[styles.username, isOwnRow && styles.usernameOwn]} numberOfLines={1}>
          {row.username}
        </Text>
        <Text variant="body" color="textSecondary" style={styles.secondaryLine} numberOfLines={1}>
          {eventsLabel}
          {perfectLabel}
        </Text>
      </View>
      <Text variant="body" style={[styles.points, isOwnRow && styles.pointsOwn]} numberOfLines={1}>
        {row.total_points} PTS
      </Text>
    </View>
  );
}

function FeaturedEventBlock({
  event,
  fights,
  state,
  nowMs,
}: {
  event: EventRow;
  fights: FightRow[];
  state: EventState;
  nowMs: number;
}) {
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
        nowMs={nowMs}
      />
    </View>
  );
}

function FeaturedEventStatus({
  eventId,
  totalFights,
  state,
  picksCloseAt,
  nowMs,
}: {
  eventId: string;
  totalFights: number;
  state: EventState;
  picksCloseAt: string | null;
  nowMs: number;
}) {
  const router = useRouter();
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
        <Button
          label="See results"
          onPress={() => router.push(`/(tabs)/fantasy/${eventId}/results`)}
          style={styles.actionButton}
        />
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
        <Button
          variant="outline"
          label="View your picks"
          onPress={() => router.push(`/picks/${eventId}/summary`)}
          style={styles.actionButton}
        />
      </View>
    );
  }

  const countdown = picksCloseAt ? `Picks close in ${formatCountdown(picksCloseAt, nowMs)}` : 'Picks open';
  const allPicked = totalFights > 0 && pickedCount >= totalFights;
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
      {/* Every fight picked routes to the summary; otherwise back into the flow. */}
      <Button
        label={label}
        onPress={() => router.push(allPicked ? `/picks/${eventId}/summary` : `/picks/${eventId}`)}
        style={styles.actionButton}
      />
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
  leaderboardHeading: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    // Reserved on every row so the own-row bar never shifts the columns.
    borderLeftWidth: borderWidths.emphasis,
    borderLeftColor: 'transparent',
  },
  leaderboardRowDivided: {
    borderTopWidth: borderWidths.structural,
    borderTopColor: colors.border,
  },
  leaderboardRowOwn: {
    borderLeftColor: colors.textPrimary,
  },
  rank: {
    width: 32,
    fontFamily: typography.fontFamily.headingMedium,
    fontSize: 16,
    lineHeight: 20,
  },
  leaderboardMiddle: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  username: {
    fontFamily: typography.fontFamily.headingMedium,
    fontSize: 16,
    lineHeight: 20,
    textTransform: 'uppercase',
  },
  usernameOwn: {
    fontFamily: typography.fontFamily.heading,
  },
  secondaryLine: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  points: {
    fontFamily: typography.fontFamily.headingMedium,
    fontSize: typography.numeric.fontSize,
    lineHeight: typography.numeric.lineHeight,
    textTransform: 'uppercase',
  },
  pointsOwn: {
    fontFamily: typography.fontFamily.heading,
  },
  noPointsLine: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
