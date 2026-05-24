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
  TextInput,
  View,
} from 'react-native';

import { LoadingScreen, ScreenState } from '@/src/components/ui/ScreenState';
import { useAuth } from '@/src/features/auth/AuthProvider';
import {
  type NativeFighter,
  type NativeFighterCard,
  getCardsForFighter,
  loadNativeFighters,
} from '@/src/lib/fighters';
import { OWNED_LIKE_STATUSES } from '@/src/lib/collection';
import { colors, spacing } from '@/src/lib/theme/tokens';

type FightersState = {
  cards: NativeFighterCard[];
  fighters: NativeFighter[];
  summary: {
    fighters: number;
    owned: number;
    wanted: number;
  };
};

const emptyState: FightersState = {
  cards: [],
  fighters: [],
  summary: {
    fighters: 0,
    owned: 0,
    wanted: 0,
  },
};

function formatCardStatus(status: string | null) {
  if (!status) return 'Missing';
  if (status === 'wanted') return 'Wanted';
  if (OWNED_LIKE_STATUSES.has(status)) return 'Owned';
  return status.replace(/_/g, ' ');
}

function getFighterMeta(fighter: NativeFighter) {
  return [fighter.weightClass, fighter.country, fighter.record].filter(Boolean).join(' - ') || 'Profile details pending';
}

export function FightersScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<FightersState>(emptyState);
  const [selectedFighterId, setSelectedFighterId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadFighters = useCallback(async () => {
    if (!user?.id) return;

    const result = await loadNativeFighters(user.id);
    setError(result.error);
    setData(result.data);
    setSelectedFighterId((current) => {
      if (current && result.data.fighters.some((fighter) => fighter.id === current)) return current;
      return result.data.fighters[0]?.id ?? null;
    });
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      await loadFighters();
      if (mounted) setIsLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [loadFighters]);

  const refresh = async () => {
    setIsRefreshing(true);
    await loadFighters();
    setIsRefreshing(false);
  };

  const openWebFallback = () => {
    router.push('/web-fallback' as never);
  };

  const filteredFighters = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fighters = term
      ? data.fighters.filter((fighter) => {
        return (
          fighter.name.toLowerCase().includes(term) ||
          fighter.nickname?.toLowerCase().includes(term) ||
          fighter.weightClass?.toLowerCase().includes(term) ||
          fighter.country?.toLowerCase().includes(term)
        );
      })
      : data.fighters;

    return fighters.slice(0, 80);
  }, [data.fighters, search]);
  const selectedFighter = useMemo(
    () => data.fighters.find((fighter) => fighter.id === selectedFighterId) ?? null,
    [data.fighters, selectedFighterId],
  );
  const selectedCards = useMemo(
    () => (selectedFighter ? getCardsForFighter(data.cards, selectedFighter).slice(0, 40) : []),
    [data.cards, selectedFighter],
  );

  if (isLoading) return <LoadingScreen label="Loading fighters" />;

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
          <View>
            <Text style={styles.kicker}>Fight Card Society</Text>
            <Text style={styles.title}>Fighters</Text>
          </View>
          <Pressable hitSlop={10} onPress={openWebFallback} style={styles.webButton}>
            <Text style={styles.webButtonText}>WebView</Text>
          </Pressable>
        </View>

        {error ? (
          <ScreenState
            actionLabel="Try again"
            message="The native fighter catalog did not load. Pull to refresh or retry."
            onAction={loadFighters}
            title="Fighters unavailable"
          />
        ) : null}

        <View style={styles.hero}>
          <Text style={styles.kicker}>Fighter hub</Text>
          <Text style={styles.heroTitle}>
            {data.fighters.length > 0 ? 'Browse profiles' : 'Profiles coming soon'}
          </Text>
          <Text style={styles.heroText}>
            Read-only fighter browsing is live. Editing, image upload, and admin tools stay disabled.
          </Text>
        </View>

        <View style={styles.grid}>
          <StatBlock label="Fighters" value={String(data.summary.fighters)} />
          <StatBlock label="Owned" value={String(data.summary.owned)} />
          <StatBlock label="Wanted" value={String(data.summary.wanted)} />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.kicker}>Search</Text>
            <Text style={styles.countBadge}>{filteredFighters.length} shown</Text>
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Search fighter, division, country..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            value={search}
          />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.kicker}>Fighter list</Text>
            <Text style={styles.countBadge}>{data.fighters.length} total</Text>
          </View>

          {filteredFighters.length > 0 ? (
            <View style={styles.fighterList}>
              {filteredFighters.map((fighter) => (
                <FighterRow
                  fighter={fighter}
                  isSelected={fighter.id === selectedFighterId}
                  key={fighter.id}
                  onPress={() => setSelectedFighterId(fighter.id)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.panelText}>No fighters match this search.</Text>
          )}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.kicker}>Profile preview</Text>
            <Text style={styles.countBadge}>{selectedCards.length} cards</Text>
          </View>

          {selectedFighter ? (
            <>
              <Text style={styles.sectionTitle}>{selectedFighter.name}</Text>
              {selectedFighter.nickname ? (
                <Text style={styles.nickname}>{selectedFighter.nickname}</Text>
              ) : null}
              <Text style={styles.panelText}>{getFighterMeta(selectedFighter)}</Text>
              <View style={styles.detailStats}>
                <MiniStat label="Cards" value={String(selectedFighter.cardCount)} />
                <MiniStat label="Owned" value={String(selectedFighter.ownedCount)} />
                <MiniStat label="Wanted" value={String(selectedFighter.wantedCount)} />
              </View>

              {selectedCards.length > 0 ? (
                <View style={styles.cardList}>
                  {selectedCards.map((card) => (
                    <FighterCardRow card={card} key={card.cardId} />
                  ))}
                </View>
              ) : (
                <Text style={styles.panelText}>No card previews found for this fighter.</Text>
              )}
            </>
          ) : (
            <Text style={styles.panelText}>Select a fighter to preview profile details.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FighterCardRow({ card }: { card: NativeFighterCard }) {
  return (
    <View style={styles.cardRow}>
      <View style={styles.cardInfo}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {card.detail}
        </Text>
        <Text numberOfLines={1} style={styles.cardDetail}>
          {card.fighterName || 'Unknown fighter'}
        </Text>
      </View>
      <Text style={styles.statusBadge}>{formatCardStatus(card.status)}</Text>
    </View>
  );
}

function FighterRow({
  fighter,
  isSelected,
  onPress,
}: {
  fighter: NativeFighter;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.fighterRow, isSelected ? styles.fighterRowSelected : null]}
    >
      <View style={styles.fighterInfo}>
        <Text numberOfLines={1} style={styles.fighterName}>
          {fighter.name}
        </Text>
        <Text numberOfLines={1} style={styles.fighterMeta}>
          {getFighterMeta(fighter)}
        </Text>
        <Text style={styles.fighterCounts}>
          {fighter.cardCount} cards - {fighter.ownedCount} owned - {fighter.wantedCount} wanted
        </Text>
      </View>
      <Text style={styles.rowAction}>{isSelected ? 'Open' : 'View'}</Text>
    </Pressable>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardDetail: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardList: {
    gap: 9,
    marginTop: 14,
  },
  cardRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 13,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    textTransform: 'uppercase',
  },
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
  detailStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  fighterCounts: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 7,
  },
  fighterInfo: {
    flex: 1,
    minWidth: 0,
  },
  fighterList: {
    gap: 9,
    marginTop: 14,
  },
  fighterMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  fighterName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  fighterRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 13,
  },
  fighterRowSelected: {
    borderColor: 'rgba(220,38,38,0.55)',
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hero: {
    backgroundColor: colors.panel,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: colors.accent,
    borderTopWidth: 3,
    borderWidth: 1,
    padding: 18,
  },
  heroText: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 32,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  kicker: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  miniStat: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderWidth: 1,
    flex: 1,
    padding: 11,
  },
  miniStatLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  miniStatValue: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  nickname: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
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
    marginTop: 10,
  },
  rowAction: {
    borderColor: 'rgba(220,38,38,0.35)',
    borderWidth: 1,
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 28,
    paddingHorizontal: spacing.screenX,
    paddingTop: 16,
  },
  searchInput: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 13,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.1,
    lineHeight: 24,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  statBlock: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderWidth: 1,
    flex: 1,
    padding: 13,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 5,
    textTransform: 'uppercase',
  },
  statValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  statusBadge: {
    borderColor: 'rgba(220,38,38,0.35)',
    borderWidth: 1,
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 34,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  webButton: {
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  webButtonText: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
});
