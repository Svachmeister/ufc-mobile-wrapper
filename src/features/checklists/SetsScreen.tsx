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
  type NativeChecklistCard,
  type NativeChecklistSet,
  getCardsForSet,
  loadNativeChecklists,
} from '@/src/lib/checklists';
import { OWNED_LIKE_STATUSES } from '@/src/lib/collection';
import { colors, spacing } from '@/src/lib/theme/tokens';

type SetsState = {
  cards: NativeChecklistCard[];
  sets: NativeChecklistSet[];
  summary: {
    owned: number;
    sets: number;
    wanted: number;
  };
};

const emptyState: SetsState = {
  cards: [],
  sets: [],
  summary: {
    owned: 0,
    sets: 0,
    wanted: 0,
  },
};

function formatReleaseDate(value: string | null) {
  if (!value) return 'Release TBA';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatCardStatus(status: string | null) {
  if (!status) return 'Missing';
  if (status === 'wanted') return 'Wanted';
  if (OWNED_LIKE_STATUSES.has(status)) return 'Owned';
  return status.replace(/_/g, ' ');
}

export function SetsScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<SetsState>(emptyState);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadSets = useCallback(async () => {
    if (!user?.id) return;

    const result = await loadNativeChecklists(user.id);
    setError(result.error);
    setData(result.data);
    setSelectedSetId((current) => {
      if (current && result.data.sets.some((set) => set.id === current)) return current;
      return result.data.sets[0]?.id ?? null;
    });
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      await loadSets();
      if (mounted) setIsLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [loadSets]);

  const refresh = async () => {
    setIsRefreshing(true);
    await loadSets();
    setIsRefreshing(false);
  };

  const openWebFallback = () => {
    router.push('/web-fallback' as never);
  };

  const selectedSet = useMemo(
    () => data.sets.find((set) => set.id === selectedSetId) ?? null,
    [data.sets, selectedSetId],
  );
  const selectedCards = useMemo(
    () => (selectedSet ? getCardsForSet(data.cards, selectedSet).slice(0, 80) : []),
    [data.cards, selectedSet],
  );

  if (isLoading) return <LoadingScreen label="Loading sets" />;

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
            <Text style={styles.title}>Sets</Text>
          </View>
          <Pressable hitSlop={10} onPress={openWebFallback} style={styles.webButton}>
            <Text style={styles.webButtonText}>WebView</Text>
          </Pressable>
        </View>

        {error ? (
          <ScreenState
            actionLabel="Try again"
            message="The native checklist catalog did not load. Pull to refresh or retry."
            onAction={loadSets}
            title="Sets unavailable"
          />
        ) : null}

        <View style={styles.hero}>
          <Text style={styles.kicker}>Checklists</Text>
          <Text style={styles.heroTitle}>
            {data.sets.length > 0 ? 'Browse the catalog' : 'Catalog coming soon'}
          </Text>
          <Text style={styles.heroText}>
            Read-only set browsing is live. Ownership and wanted toggles stay disabled until the next collection milestone.
          </Text>
        </View>

        <View style={styles.grid}>
          <StatBlock label="Sets" value={String(data.summary.sets)} />
          <StatBlock label="Owned" value={String(data.summary.owned)} />
          <StatBlock label="Wanted" value={String(data.summary.wanted)} />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.kicker}>Set list</Text>
            <Text style={styles.countBadge}>{data.sets.length} sets</Text>
          </View>

          {data.sets.length > 0 ? (
            <View style={styles.setList}>
              {data.sets.map((set) => (
                <SetRow
                  key={set.id}
                  isSelected={set.id === selectedSetId}
                  onPress={() => setSelectedSetId(set.id)}
                  set={set}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.panelText}>No sets are available in the native catalog yet.</Text>
          )}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.kicker}>Set detail</Text>
            <Text style={styles.countBadge}>{selectedCards.length} cards</Text>
          </View>

          {selectedSet ? (
            <>
              <Text style={styles.sectionTitle}>{selectedSet.name}</Text>
              <Text style={styles.panelText}>
                {[selectedSet.year, selectedSet.brand, formatReleaseDate(selectedSet.releaseDate)]
                  .filter(Boolean)
                  .join(' - ')}
              </Text>
              <View style={styles.detailStats}>
                <MiniStat label="Total" value={String(selectedSet.cardCount)} />
                <MiniStat label="Owned" value={String(selectedSet.ownedCount)} />
                <MiniStat label="Wanted" value={String(selectedSet.wantedCount)} />
              </View>

              {selectedCards.length > 0 ? (
                <View style={styles.cardList}>
                  {selectedCards.map((card) => (
                    <ChecklistCardRow key={card.cardId} card={card} />
                  ))}
                </View>
              ) : (
                <Text style={styles.panelText}>No cards found for this set in the native preview.</Text>
              )}
            </>
          ) : (
            <Text style={styles.panelText}>Select a set to preview cards.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChecklistCardRow({ card }: { card: NativeChecklistCard }) {
  return (
    <View style={styles.cardRow}>
      <View style={styles.cardInfo}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {card.fighterName}
        </Text>
        <Text numberOfLines={1} style={styles.cardDetail}>
          {card.detail}
        </Text>
      </View>
      <Text style={styles.statusBadge}>{formatCardStatus(card.status)}</Text>
    </View>
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

function SetRow({
  isSelected,
  onPress,
  set,
}: {
  isSelected: boolean;
  onPress: () => void;
  set: NativeChecklistSet;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.setRow, isSelected ? styles.setRowSelected : null]}
    >
      <View style={styles.setInfo}>
        <Text numberOfLines={1} style={styles.setTitle}>
          {set.name}
        </Text>
        <Text numberOfLines={1} style={styles.setMeta}>
          {[set.year, set.brand, formatReleaseDate(set.releaseDate)].filter(Boolean).join(' - ')}
        </Text>
        <Text style={styles.setCounts}>
          {set.cardCount} cards - {set.ownedCount} owned - {set.wantedCount} wanted
        </Text>
      </View>
      <Text style={styles.setAction}>{isSelected ? 'Open' : 'View'}</Text>
    </Pressable>
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
  scrollContent: {
    gap: 14,
    paddingBottom: 28,
    paddingHorizontal: spacing.screenX,
    paddingTop: 16,
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
  setAction: {
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
  setCounts: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 7,
  },
  setInfo: {
    flex: 1,
    minWidth: 0,
  },
  setList: {
    gap: 9,
    marginTop: 14,
  },
  setMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  setRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 13,
  },
  setRowSelected: {
    borderColor: 'rgba(220,38,38,0.55)',
  },
  setTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
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
