import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ListRow,
  SectionPanel,
  StatTile,
  StatusBadge,
  WebFallbackButton,
  sharedScreenStyles,
} from '@/src/components/ui/NativePrimitives';
import { useAuth } from '@/src/features/auth/AuthProvider';
import {
  formatFantasyEventDate,
  getFantasyPickStatus,
  getNextFantasyEvent,
} from '@/src/lib/fantasyEvents';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/lib/theme/tokens';

const OWNED_STATUSES = new Set(['owned', 'for_sale', 'not_for_sale', 'for_trade']);

type DashboardProfile = {
  country: string | null;
  username: string | null;
};

type DashboardEvent = {
  event_date: string | null;
  id: string;
  name: string | null;
  picks_close_at: string | null;
  picks_locked: boolean | null;
  starts_at: string | null;
  status: string | null;
};

type CollectionCounts = {
  owned: number;
  wanted: number;
};

export function HomeScreen() {
  const { signOut, user } = useAuth();
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [counts, setCounts] = useState<CollectionCounts>({ owned: 0, wanted: 0 });
  const [nextEvent, setNextEvent] = useState<DashboardEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = useMemo(() => {
    return (
      profile?.username ||
      user?.user_metadata?.username ||
      user?.email?.split('@')[0] ||
      'Member'
    );
  }, [profile?.username, user?.email, user?.user_metadata?.username]);

  const loadDashboard = useCallback(async () => {
    if (!user?.id) return;

    setError(null);

    const [profileResult, userCardsResult, eventsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('username,country')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('user_cards')
        .select('status')
        .eq('user_id', user.id),
      supabase
        .from('events')
        .select('id,name,status,event_date,starts_at,picks_close_at,picks_locked')
        .or('status.eq.upcoming,starts_at.not.is.null,event_date.not.is.null')
        .order('starts_at', { ascending: true, nullsFirst: false })
        .order('event_date', { ascending: true })
        .limit(20),
    ]);

    if (profileResult.error || userCardsResult.error || eventsResult.error) {
      setError('Could not load the native dashboard.');
    }

    setProfile((profileResult.data as DashboardProfile | null) ?? null);

    const cards = (userCardsResult.data ?? []) as { status: string | null }[];
    setCounts({
      owned: cards.filter((card) => card.status && OWNED_STATUSES.has(card.status)).length,
      wanted: cards.filter((card) => card.status === 'wanted').length,
    });

    setNextEvent(getNextFantasyEvent((eventsResult.data ?? []) as DashboardEvent[]));
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      await loadDashboard();
      if (mounted) setIsLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [loadDashboard]);

  const refresh = async () => {
    setIsRefreshing(true);
    await loadDashboard();
    setIsRefreshing(false);
  };

  const openWebFallback = () => {
    router.push('/web-fallback' as never);
  };

  const openRoute = (path: '/collection' | '/fantasy' | '/fighters' | '/sets') => {
    router.push(path as never);
  };

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
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image
              source={require('../../../assets/images/logo_fightcardsociety.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandKicker}>Fight Card Society</Text>
              <Text style={styles.brandTitle}>Member Home</Text>
            </View>
          </View>

          <Pressable hitSlop={10} onPress={signOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        <SectionPanel variant="inverse" style={styles.hero}>
          <Text style={styles.kicker}>Member dashboard</Text>
          <Text style={styles.title}>Back in your corner, {displayName}</Text>
          <Text style={styles.subtitle}>
            Track your collection. Follow fight cards. Build your picks.
          </Text>
          {profile?.country ? (
            <Text style={styles.country}>{profile.country}</Text>
          ) : null}
        </SectionPanel>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.grid}>
          <StatTile label="Owned" value={isLoading ? '--' : String(counts.owned)} />
          <StatTile label="Wanted" value={isLoading ? '--' : String(counts.wanted)} />
        </View>

        <SectionPanel style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.kicker}>Next event</Text>
            <StatusBadge label={getFantasyPickStatus(nextEvent)} tone={nextEvent ? 'red' : 'neutral'} />
          </View>
          <Text style={styles.eventTitle}>
            {isLoading ? 'Loading event' : nextEvent?.name || 'No upcoming event'}
          </Text>
          <Text style={styles.eventDate}>
            {isLoading ? 'Checking schedule' : formatFantasyEventDate(nextEvent?.starts_at || nextEvent?.event_date)}
          </Text>
        </SectionPanel>

        <SectionPanel style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.kicker}>Fight Card Society</Text>
            <Text style={styles.countBadge}>4 areas</Text>
          </View>
          <View style={styles.quickList}>
            <ListRow
              action={<StatusBadge label="Open" tone="dark" />}
              meta={`${counts.owned} owned - ${counts.wanted} wanted`}
              onPress={() => openRoute('/collection')}
              title="Cards / My Collection"
            />
            <ListRow
              action={<StatusBadge label="Open" tone="dark" />}
              meta="Browse set checklists"
              onPress={() => openRoute('/sets')}
              title="Sets / Checklists"
            />
            <ListRow
              action={<StatusBadge label="Open" tone="red" />}
              meta={nextEvent?.name || 'Events and leaderboard'}
              onPress={() => openRoute('/fantasy')}
              title="Fantasy"
            />
            <ListRow
              action={<StatusBadge label="Open" tone="dark" />}
              meta="Fighter profiles and card counts"
              onPress={() => openRoute('/fighters')}
              title="Fighters"
            />
          </View>
        </SectionPanel>

        <SectionPanel style={styles.utilityPanel} variant="muted">
          <Text style={styles.kicker}>Web tools</Text>
          <Text style={styles.panelText}>
            Need the full web tools?
          </Text>
          <WebFallbackButton
            label="Open web tools"
            onPress={openWebFallback}
            style={styles.fallbackButton}
          />
        </SectionPanel>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brandKicker: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  brandLogo: {
    height: 40,
    width: 40,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  brandTextWrap: {
    minWidth: 0,
  },
  brandTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  country: {
    alignSelf: 'flex-start',
    backgroundColor: colors.textInverse,
    borderColor: colors.textInverse,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: 'uppercase',
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
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  eventDate: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  eventTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
    lineHeight: 26,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hero: {
    padding: 18,
  },
  kicker: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  panel: {
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
    marginTop: 10,
  },
  fallbackButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    minHeight: 42,
  },
  quickList: {
    gap: 8,
    marginTop: 14,
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
  },
  signOutButton: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  signOutText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.gray200,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  title: {
    color: colors.textInverse,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 32,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  utilityPanel: {
    padding: 14,
  },
});
