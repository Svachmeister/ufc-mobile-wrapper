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
  const nextEventStatus = getFantasyPickStatus(nextEvent);
  const nextEventClosed = nextEventStatus.toLowerCase().includes('closed')
    || nextEventStatus.toLowerCase().includes('locked');
  const currentStanding = useMemo(() => {
    if (!user?.id) return null;
    return data.leaderboard.find((standing) => standing.userId === user.id) ?? null;
  }, [data.leaderboard, user?.id]);

  if (isLoading) return <LoadingScreen label="Loading fantasy" />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
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
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerKicker}>Fight-night game</Text>
            <Text style={styles.headerTitle}>Fantasy</Text>
            <Text style={styles.headerCopy}>
              Make picks, climb the table, and track event competition.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Open fantasy web tools"
            hitSlop={8}
            onPress={openWebFallback}
            style={({ pressed }) => [
              styles.webAction,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.webActionText}>Web</Text>
          </Pressable>
        </View>

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
            <Text style={styles.kicker}>Next event</Text>
            <Text
              style={[
                styles.statusPill,
                nextEventClosed ? styles.statusPillClosed : null,
              ]}
            >
              {nextEventStatus}
            </Text>
          </View>
          <Text style={styles.heroTitle}>{nextEvent?.name || 'No upcoming event'}</Text>
          <Text style={styles.heroMeta}>
            {nextEvent
              ? `${formatFantasyEventDate(nextEvent.starts_at || nextEvent.event_date)} - ${nextEvent.fights?.length ?? 0} fights`
              : 'Fantasy cards will appear here when they are scheduled.'}
          </Text>
          <Pressable
            accessibilityLabel="Open fantasy picks"
            onPress={openWebFallback}
            style={({ pressed }) => [
              styles.heroCta,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.heroCtaText}>Open fantasy picks</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          <FantasyStat
            label="Your rank"
            value={currentStanding ? `#${currentStanding.rank}` : '--'}
          />
          <FantasyStat
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
            <Text style={styles.panelText}>Leaderboard opens once entries are available.</Text>
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
            <Text style={styles.panelText}>No fantasy events are scheduled right now.</Text>
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

function FantasyStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EventRow({ event }: { event: FantasyEvent }) {
  const status = getFantasyPickStatus(event);
  const isClosed = status.toLowerCase().includes('closed')
    || status.toLowerCase().includes('locked');

  return (
    <View style={styles.eventRow}>
      <View style={styles.eventInfo}>
        <Text style={styles.eventName}>{event.name || 'Unnamed event'}</Text>
        <Text style={styles.eventMeta}>
          {formatFantasyEventDate(event.starts_at || event.event_date)} - {event.fights?.length ?? 0} fights
        </Text>
      </View>
      <Text style={[styles.eventStatus, isClosed ? styles.eventStatusClosed : null]}>
        {status}
      </Text>
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
    backgroundColor: '#fbfaf7',
    flex: 1,
  },
  countBadge: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
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
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  eventName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  eventRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 13,
  },
  eventStatus: {
    borderColor: colors.red,
    borderWidth: 1,
    color: colors.red,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    minWidth: 90,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  eventStatusClosed: {
    backgroundColor: colors.red,
    color: colors.textInverse,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  headerCopy: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
  },
  headerKicker: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 36,
    marginTop: 3,
    textTransform: 'uppercase',
  },
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderTopColor: colors.red,
    borderTopWidth: 3,
    borderWidth: 1,
    padding: 17,
  },
  heroCta: {
    alignItems: 'center',
    backgroundColor: colors.red,
    borderColor: colors.red,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  heroCtaText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroMeta: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 10,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.2,
    lineHeight: 31,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inlineLink: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  kicker: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  leaderName: {
    color: colors.ink,
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
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  leaderRank: {
    color: colors.red,
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
    backgroundColor: '#fbfaf7',
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  noticeText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 12,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderTopColor: colors.ink,
    borderTopWidth: 2,
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
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 14,
  },
  pressed: {
    opacity: 0.82,
  },
  ruleLabel: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  ruleTile: {
    backgroundColor: '#fbfaf7',
    borderColor: colors.border,
    borderWidth: 1,
    flex: 1,
    minWidth: '47%',
    padding: 12,
  },
  ruleValue: {
    color: colors.red,
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
    gap: 14,
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  statBlock: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  statLabel: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 3,
    textTransform: 'uppercase',
  },
  statValue: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 31,
  },
  statusPill: {
    borderColor: colors.red,
    borderWidth: 1,
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  statusPillClosed: {
    backgroundColor: colors.red,
    color: colors.textInverse,
  },
  webAction: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: 4,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  webActionText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
});
