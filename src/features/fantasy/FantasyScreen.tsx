import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ScreenHeader,
  StatTile,
  WebFallbackButton,
  sharedScreenStyles,
} from '@/src/components/ui/NativePrimitives';
import { LoadingScreen, ScreenState } from '@/src/components/ui/ScreenState';
import { useAuth } from '@/src/features/auth/AuthProvider';
import {
  type FantasyLeaderboardStanding,
  getFantasyLeaderboard,
} from '@/src/lib/api/fantasy';
import {
  formatFantasyEventDate,
  getFantasyPickStatus,
  getUpcomingFantasyEvents,
} from '@/src/lib/fantasyEvents';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/lib/theme/tokens';

type FantasyEvent = {
  event_date: string | null;
  fights?: { id: string }[] | null;
  id: string;
  name: string | null;
  picks_close_at: string | null;
  picks_locked: boolean | null;
  starts_at: string | null;
  status: string | null;
};

type FantasyLoadState = {
  apiNotice: string | null;
  events: FantasyEvent[];
  leaderboard: FantasyLeaderboardStanding[];
};

export function FantasyScreen() {
  const { session, user } = useAuth();
  const [data, setData] = useState<FantasyLoadState>({
    apiNotice: null,
    events: [],
    leaderboard: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadFantasy = useCallback(async () => {
    setError(null);

    const [eventsResult, leaderboardResult] = await Promise.all([
      supabase
        .from('events')
        .select('id,name,status,event_date,starts_at,picks_close_at,picks_locked')
        .or('status.eq.upcoming,starts_at.not.is.null,event_date.not.is.null')
        .order('starts_at', { ascending: true, nullsFirst: false })
        .order('event_date', { ascending: true })
        .limit(20),
      getFantasyLeaderboard(session?.access_token),
    ]);

    if (eventsResult.error) {
      setError('Could not load fantasy events.');
    }

    const events = (eventsResult.data ?? []) as FantasyEvent[];
    const eventIds = events.map((event) => event.id);
    const fightsByEventId = new Map<string, { id: string }[]>();

    if (eventIds.length > 0) {
      const { data: fightsData, error: fightsError } = await supabase
        .from('fights')
        .select('id,event_id')
        .in('event_id', eventIds)
        .limit(500);

      if (fightsError) {
        setError('Could not load fantasy fight counts.');
      } else {
        ((fightsData ?? []) as { event_id?: string | null; id: string }[]).forEach((fight) => {
          if (!fight.event_id) return;
          const existing = fightsByEventId.get(fight.event_id) ?? [];
          existing.push({ id: fight.id });
          fightsByEventId.set(fight.event_id, existing);
        });
      }
    }

    setData({
      apiNotice: leaderboardResult.error,
      events: getUpcomingFantasyEvents(events.map((event) => ({
        ...event,
        fights: fightsByEventId.get(event.id) ?? [],
      }))),
      leaderboard: leaderboardResult.standings,
    });
  }, [session?.access_token]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      await loadFantasy();
      if (mounted) setIsLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [loadFantasy]);

  const refresh = async () => {
    setIsRefreshing(true);
    await loadFantasy();
    setIsRefreshing(false);
  };

  const openWebFallback = () => {
    router.push('/web-fallback' as never);
  };

  const nextEvent = data.events[0] ?? null;
  const topLeaderboard = data.leaderboard.slice(0, 5);
  const currentStanding = useMemo(() => {
    if (!user?.id) return null;
    return data.leaderboard.find((standing) => standing.userId === user.id) ?? null;
  }, [data.leaderboard, user?.id]);

  if (isLoading) return <LoadingScreen label="Loading fantasy" />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.text}
            onRefresh={refresh}
          />
        }
      >
        <ScreenHeader
          action={<WebFallbackButton onPress={openWebFallback} />}
          title="Fantasy"
        />

        {error ? (
          <ScreenState
            actionLabel="Try again"
            message="The events feed did not load. Pull to refresh or retry."
            onAction={loadFantasy}
            title="Fantasy unavailable"
          />
        ) : null}

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.kicker}>Next card</Text>
            <Text style={styles.statusPill}>
              {getFantasyPickStatus(nextEvent)}
            </Text>
          </View>
          <Text style={styles.heroTitle}>{nextEvent?.name || 'No upcoming event'}</Text>
          <Text style={styles.heroMeta}>
            {nextEvent
              ? `${formatFantasyEventDate(nextEvent.starts_at || nextEvent.event_date)} - ${nextEvent.fights?.length ?? 0} fights`
              : 'Fantasy cards will appear here when they are scheduled.'}
          </Text>
          <View style={styles.disabledCta}>
            <Text style={styles.disabledCtaText}>Native picks coming later</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <StatTile
            label="Your rank"
            value={currentStanding ? `#${currentStanding.rank}` : '--'}
          />
          <StatTile
            label="Your points"
            value={currentStanding ? String(currentStanding.points) : '0'}
          />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.kicker}>Leaderboard</Text>
            <Pressable onPress={openWebFallback} hitSlop={8}>
              <Text style={styles.inlineLink}>Full table</Text>
            </Pressable>
          </View>

          {data.apiNotice ? (
            <Text style={styles.noticeText}>{data.apiNotice}</Text>
          ) : topLeaderboard.length > 0 ? (
            <View style={styles.leaderboardList}>
              {topLeaderboard.map((standing) => (
                <LeaderboardRow key={`${standing.rank}-${standing.displayName}`} standing={standing} />
              ))}
            </View>
          ) : (
            <Text style={styles.panelText}>No leaderboard rows available yet.</Text>
          )}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.kicker}>Upcoming events</Text>
            <Text style={styles.countBadge}>{data.events.length} cards</Text>
          </View>

          {data.events.length > 0 ? (
            <View style={styles.eventList}>
              {data.events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </View>
          ) : (
            <Text style={styles.panelText}>No upcoming fantasy events are available right now.</Text>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.kicker}>Scoring</Text>
          <View style={styles.rulesGrid}>
            <RuleTile label="Winner" value="+1" />
            <RuleTile label="Method" value="+3" />
            <RuleTile label="Champion" value="2x" />
            <RuleTile label="Perfect card" value="+50" />
          </View>
          <Text style={styles.panelText}>
            This native screen is read-only for Milestone 2. Use the WebView fallback for the full fantasy flow until native picks ship.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EventRow({ event }: { event: FantasyEvent }) {
  return (
    <View style={styles.eventRow}>
      <View style={styles.eventInfo}>
        <Text style={styles.eventName}>{event.name || 'Unnamed event'}</Text>
        <Text style={styles.eventMeta}>
          {formatFantasyEventDate(event.starts_at || event.event_date)} - {event.fights?.length ?? 0} fights
        </Text>
      </View>
      <Text style={styles.eventStatus}>{getFantasyPickStatus(event)}</Text>
    </View>
  );
}

function LeaderboardRow({ standing }: { standing: FantasyLeaderboardStanding }) {
  return (
    <View style={styles.leaderboardRow}>
      <View style={styles.leaderNameWrap}>
        <Text style={styles.leaderRank}>#{standing.rank}</Text>
        <Text numberOfLines={1} style={styles.leaderName}>
          {standing.displayName}
        </Text>
      </View>
      <Text style={styles.leaderPoints}>{standing.points} pts</Text>
    </View>
  );
}

function RuleTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.ruleTile}>
      <Text style={styles.ruleValue}>{value}</Text>
      <Text style={styles.ruleLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  countBadge: {
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  disabledCta: {
    alignItems: 'center',
    borderColor: 'rgba(220,38,38,0.55)',
    borderWidth: 1,
    marginTop: 18,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  disabledCtaText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  eventInfo: {
    flex: 1,
    minWidth: 0,
  },
  eventList: {
    gap: 9,
    marginTop: 14,
  },
  eventMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  eventName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  eventRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 13,
  },
  eventStatus: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'right',
    textTransform: 'uppercase',
    width: 88,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  hero: {
    backgroundColor: colors.panel,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: colors.accent,
    borderTopWidth: 3,
    borderWidth: 1,
    padding: 18,
  },
  heroMeta: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 10,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 32,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inlineLink: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  kicker: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  leaderName: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  leaderNameWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  leaderPoints: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '900',
  },
  leaderRank: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    width: 30,
  },
  leaderboardList: {
    gap: 8,
    marginTop: 14,
  },
  leaderboardRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  noticeText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 12,
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 16,
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  panelText: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },
  ruleLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  ruleTile: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderWidth: 1,
    flex: 1,
    minWidth: '47%',
    padding: 12,
  },
  ruleValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  rulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 14,
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
  },
  statusPill: {
    borderColor: 'rgba(220,38,38,0.45)',
    borderWidth: 1,
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
});
