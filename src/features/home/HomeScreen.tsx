import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
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
  const [, setCounts] = useState<CollectionCounts>({ owned: 0, wanted: 0 });
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
  },
  headerSpacer: {
    width: 44,
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
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
    backgroundColor: '#ffffff',
    gap: 0,
  },
});
