import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, Screen, Text } from '@/components/ui';
import { borderWidths, colors, spacing, typography } from '@/theme/tokens';
import { isEventFinal } from '@/lib/fantasy/eventState';
import { MISSING } from '@/lib/fantasy/pickDisplay';
import {
  fighterSurname,
  formatMethodRound,
  scoreFightFromSnapshot,
  useEventResultsData,
  type EventLeaderboardRow,
  type EventResultsData,
  type EventResultsEventRow,
  type EventResultsFightRow,
  type EventResultsFighter,
  type EventScoreRow,
  type SnapshotEntry,
} from '@/lib/fantasy/eventResults';

const BACK_TARGET = 44;
const BACK_ICON_SIZE = 24;
const CHAMPION_ICON_SIZE = 18;

export function EventResultsScreen({ eventId }: { eventId: string }) {
  const router = useRouter();
  const query = useEventResultsData(eventId);

  function back() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/(tabs)/fantasy/${eventId}`);
    }
  }

  if (query.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandRed} />
        </View>
      </Screen>
    );
  }

  if (query.isError || !query.data || !query.data.event) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text variant="body" style={styles.centeredText}>
            Could not load results.
          </Text>
          <Button variant="outline" label="Try again" onPress={() => query.refetch()} style={styles.retryButton} />
        </View>
      </Screen>
    );
  }

  return (
    <EventResultsBody
      event={query.data.event}
      data={query.data}
      onBack={back}
      onRefresh={() => query.refetch()}
      refreshing={query.isRefetching}
    />
  );
}

function EventResultsBody({
  event,
  data,
  onBack,
  onRefresh,
  refreshing,
}: {
  event: EventResultsEventRow;
  data: EventResultsData;
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { fights, fightersById, eventScore, snapshot, leaderboard, ownUsername } = data;
  const final = isEventFinal(fights);
  const ownLeaderboardRow = ownUsername ? (leaderboard.find((row) => row.username === ownUsername) ?? null) : null;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={BACK_ICON_SIZE} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text variant="heading" numberOfLines={1}>
            {event.name}
          </Text>
          <Text variant="label" color="textSecondary">
            FINAL
          </Text>
        </View>
      </View>

      {!final ? (
        <View style={styles.centered}>
          <Text variant="body" style={styles.centeredText}>
            Results are not available yet.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandRed} />}
        >
          <ScoreHero
            eventScore={eventScore}
            ownRank={ownLeaderboardRow?.rank ?? null}
            totalRows={leaderboard.length}
          />

          {eventScore
            ? fights.map((fight) => (
                <ResultFightRow key={fight.id} fight={fight} entry={snapshot[fight.id]} fightersById={fightersById} />
              ))
            : null}

          <Text variant="label" style={styles.leaderboardHeading}>
            Event leaderboard
          </Text>
          {leaderboard.length === 0 ? (
            <Text variant="body" color="textSecondary" style={styles.emptyLeaderboard}>
              No scores yet.
            </Text>
          ) : (
            leaderboard.map((row, index) => (
              <EventLeaderboardRowItem
                key={`${row.username}-${index}`}
                row={row}
                isOwnRow={ownUsername != null && row.username === ownUsername}
                isFirst={index === 0}
              />
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function ScoreHero({
  eventScore,
  ownRank,
  totalRows,
}: {
  eventScore: EventScoreRow | null;
  ownRank: number | null;
  totalRows: number;
}) {
  if (!eventScore) {
    return (
      <View style={styles.hero}>
        <Text style={styles.heroNotSubmitted}>NOT SUBMITTED · 0 PTS</Text>
        <Text variant="body" color="textSecondary" style={styles.heroNote}>
          Your picks were not completed before the deadline.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.hero}>
      {eventScore.perfect_card ? (
        <View style={styles.perfectBar}>
          <Text variant="label" color="surface">
            PERFECT CARD · +100
          </Text>
        </View>
      ) : null}
      <Text style={styles.heroPoints}>{eventScore.total_points} PTS</Text>
      {ownRank != null ? (
        <Text variant="body" color="textSecondary">
          #{ownRank} of {totalRows}
        </Text>
      ) : null}
    </View>
  );
}

// Scoring and the "not in your card" / "no result" / "draw" branches all live
// here, driven only by the snapshot and the fight row — never picks.points_earned.
function ResultFightRow({
  fight,
  entry,
  fightersById,
}: {
  fight: EventResultsFightRow;
  entry: SnapshotEntry | undefined;
  fightersById: Record<string, EventResultsFighter>;
}) {
  if (!entry) {
    return (
      <View style={styles.row}>
        <View style={styles.rowPositionWrap}>
          <Text variant="body" color="textSecondary">
            {fight.fight_order}
          </Text>
        </View>
        <View style={styles.rowMiddle}>
          <Text variant="label" color="textSecondary">
            Not in your card
          </Text>
        </View>
      </View>
    );
  }

  const pickedSurname = fighterSurname(entry.picked_fighter_id, fight, fightersById) ?? MISSING;
  const pickDetail = formatMethodRound(entry.picked_method, entry.picked_round);
  const topLine = pickDetail ? `${pickedSurname} · ${pickDetail}` : pickedSurname;

  let secondLine: string;
  let score: number | null;
  if (fight.winner_fighter_id) {
    const winnerSurname = fighterSurname(fight.winner_fighter_id, fight, fightersById) ?? MISSING;
    const resultDetail = formatMethodRound(fight.method, fight.round);
    secondLine = resultDetail ? `${winnerSurname} won · ${resultDetail}` : `${winnerSurname} won`;
    score = scoreFightFromSnapshot(entry, fight);
  } else if (fight.winner) {
    secondLine = 'Draw — no points';
    score = null;
  } else {
    secondLine = 'No result';
    score = null;
  }

  const isChampion = entry.is_captain === true;
  const dimmed = score === 0;

  return (
    <View style={[styles.row, isChampion && styles.rowChampion, dimmed && styles.rowDimmed]}>
      <View style={styles.rowPositionWrap}>
        {isChampion ? (
          <MaterialCommunityIcons name="crown" size={CHAMPION_ICON_SIZE} color={colors.championGold} />
        ) : (
          <Text variant="body" color="textSecondary">
            {fight.fight_order}
          </Text>
        )}
      </View>

      <View style={styles.rowMiddle}>
        <Text style={styles.rowPick} numberOfLines={1}>
          {topLine}
        </Text>
        <Text variant="label" color="textSecondary" numberOfLines={1}>
          {secondLine}
        </Text>
      </View>

      <View style={styles.rowRight}>
        {score != null ? (
          <Text variant="label" color={isChampion ? 'championGold' : 'textPrimary'}>
            {score} PTS
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function EventLeaderboardRowItem({
  row,
  isOwnRow,
  isFirst,
}: {
  row: EventLeaderboardRow;
  isOwnRow: boolean;
  isFirst: boolean;
}) {
  return (
    <View
      style={[styles.leaderboardRow, !isFirst && styles.leaderboardRowDivided, isOwnRow && styles.leaderboardRowOwn]}
    >
      <Text style={styles.leaderboardRank} numberOfLines={1}>
        {row.rank}
      </Text>
      <Text
        style={[styles.leaderboardUsername, isOwnRow && styles.leaderboardBold]}
        numberOfLines={1}
      >
        {row.username}
      </Text>
      <Text style={[styles.leaderboardPoints, isOwnRow && styles.leaderboardBold]} numberOfLines={1}>
        {row.total_points} PTS
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  centeredText: {
    textAlign: 'center',
  },
  retryButton: {
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg - (BACK_TARGET - BACK_ICON_SIZE) / 2,
    paddingRight: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  back: {
    width: BACK_TARGET,
    height: BACK_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  perfectBar: {
    alignSelf: 'flex-start',
    backgroundColor: colors.championGold,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroPoints: {
    fontFamily: typography.fontFamily.heading,
    fontSize: 48,
    lineHeight: 52,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  heroNotSubmitted: {
    fontFamily: typography.fontFamily.heading,
    fontSize: 28,
    lineHeight: 32,
    textTransform: 'uppercase',
    color: colors.brandRed,
  },
  heroNote: {
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: borderWidths.structural,
    borderBottomColor: colors.border,
  },
  rowChampion: {
    borderLeftWidth: borderWidths.emphasis,
    borderLeftColor: colors.championGold,
    paddingLeft: spacing.sm,
  },
  rowDimmed: {
    opacity: 0.5,
  },
  rowPositionWrap: {
    width: 20,
    alignItems: 'center',
  },
  rowMiddle: {
    flex: 1,
    gap: spacing.xs,
  },
  rowPick: {
    fontFamily: typography.fontFamily.heading,
    fontSize: 18,
    lineHeight: 22,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  rowRight: {
    minWidth: 56,
    alignItems: 'flex-end',
  },
  leaderboardHeading: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  emptyLeaderboard: {
    paddingVertical: spacing.md,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
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
  leaderboardRank: {
    width: 32,
    fontFamily: typography.fontFamily.headingMedium,
    fontSize: 16,
    lineHeight: 20,
  },
  leaderboardUsername: {
    flex: 1,
    marginRight: spacing.sm,
    fontFamily: typography.fontFamily.headingMedium,
    fontSize: 16,
    lineHeight: 20,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  leaderboardPoints: {
    fontFamily: typography.fontFamily.headingMedium,
    fontSize: typography.numeric.fontSize,
    lineHeight: typography.numeric.lineHeight,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  leaderboardBold: {
    fontFamily: typography.fontFamily.heading,
  },
});
