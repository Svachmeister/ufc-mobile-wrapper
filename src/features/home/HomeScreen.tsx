import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
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

import { sharedScreenStyles } from '@/src/components/ui/NativePrimitives';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { getNextFantasyEvent } from '@/src/lib/fantasyEvents';
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
  const { user } = useAuth();
  const [, setProfile] = useState<DashboardProfile | null>(null);
  const [counts, setCounts] = useState<CollectionCounts>({ owned: 0, wanted: 0 });
  const [, setNextEvent] = useState<DashboardEvent | null>(null);
  const [, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, setError] = useState<string | null>(null);

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
      setError('Could not load your Society home.');
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

  const openCollection = () => {
    router.push('/collection' as never);
  };

  const openSets = () => {
    router.push('/sets' as never);
  };

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
          <View style={styles.headerSpacer} />
          <Image
            source={require('../../../assets/images/logo_fightcardsociety.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Pressable
            accessibilityLabel="Search"
            hitSlop={10}
            style={({ pressed }) => [
              styles.searchButton,
              pressed ? styles.searchButtonPressed : null,
            ]}
          >
            <MaterialCommunityIcons color={colors.ink} name="magnify" size={22} />
          </Pressable>
        </View>

        <View style={styles.collectionSnapshot}>
          <View style={styles.snapshotAccent} />
          <Text style={styles.kicker}>Collection</Text>
          <Text style={styles.snapshotTitle}>My Collection</Text>
          <Text style={styles.snapshotCounts}>
            {counts.owned} owned {'\u00b7'} {counts.wanted} wanted
          </Text>
          <Text style={styles.snapshotCopy}>
            Track owned cards, wanted cards, and set progress.
          </Text>
          <View style={styles.snapshotActions}>
            <Pressable
              onPress={openCollection}
              style={({ pressed }) => [
                styles.primaryTextAction,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.primaryTextActionLabel}>Open Collection</Text>
            </Pressable>
            <Pressable
              onPress={openSets}
              style={({ pressed }) => [
                styles.secondaryTextAction,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.secondaryTextActionLabel}>Browse Card Sets</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brandLogo: {
    height: 50,
    width: 164,
  },
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  collectionSnapshot: {
    marginTop: 28,
    paddingTop: 4,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingTop: 4,
  },
  headerSpacer: {
    width: 44,
  },
  kicker: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.62,
  },
  primaryTextAction: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  primaryTextActionLabel: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  searchButtonPressed: {
    opacity: 0.62,
  },
  secondaryTextAction: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  secondaryTextActionLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
    backgroundColor: '#ffffff',
    gap: 0,
  },
  snapshotAccent: {
    backgroundColor: colors.red,
    height: 2,
    marginBottom: 17,
    width: 30,
  },
  snapshotActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 12,
  },
  snapshotCopy: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 12,
  },
  snapshotCounts: {
    color: colors.gray500,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 6,
  },
  snapshotTitle: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 31,
    marginTop: 5,
  },
});
