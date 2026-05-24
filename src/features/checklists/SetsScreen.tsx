import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type NativeChecklistCard,
  type NativeChecklistSet,
  getCardsForSet,
  getNextChecklistStatus,
  loadNativeChecklists,
  saveNativeChecklistStatus,
} from '@/src/lib/checklists';
import { OWNED_LIKE_STATUSES } from '@/src/lib/collection';
import { colors } from '@/src/lib/theme/tokens';

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

function applyCardStatus(data: SetsState, cardId: string, status: string | null): SetsState {
  const cards = data.cards.map((card) => (
    card.cardId === cardId ? { ...card, status } : card
  ));
  const sets = data.sets.map((set) => {
    const setCards = getCardsForSet(cards, set);

    return {
      ...set,
      ownedCount: setCards.filter((card) => card.status && OWNED_LIKE_STATUSES.has(card.status)).length,
      wantedCount: setCards.filter((card) => card.status === 'wanted').length,
    };
  });

  return {
    cards,
    sets,
    summary: {
      owned: cards.filter((card) => card.status && OWNED_LIKE_STATUSES.has(card.status)).length,
      sets: sets.length,
      wanted: cards.filter((card) => card.status === 'wanted').length,
    },
  };
}

export function SetsScreen() {
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const [data, setData] = useState<SetsState>(emptyState);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [updatingCardIds, setUpdatingCardIds] = useState<Set<string>>(new Set());

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
    setMutationError(null);
    await loadSets();
    setIsRefreshing(false);
  };

  const openWebFallback = () => {
    router.push('/web-fallback' as never);
  };

  const selectSet = useCallback((setId: string) => {
    setSelectedSetId(setId);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const handleToggleCard = useCallback(async (card: NativeChecklistCard) => {
    if (!user?.id || updatingCardIds.has(card.cardId)) return;

    const nextStatus = getNextChecklistStatus(card.status);

    setMutationError(null);
    setUpdatingCardIds((current) => new Set(current).add(card.cardId));
    setData((current) => applyCardStatus(current, card.cardId, nextStatus));

    const result = await saveNativeChecklistStatus({
      cardId: card.cardId,
      status: nextStatus,
      userId: user.id,
    });

    if (result.error) {
      await loadSets();
      setMutationError(result.error);
    }

    setUpdatingCardIds((current) => {
      const next = new Set(current);
      next.delete(card.cardId);
      return next;
    });
  }, [loadSets, updatingCardIds, user?.id]);

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
        ref={scrollViewRef}
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
          title="Sets"
        />

        {error ? (
          <ScreenState
            actionLabel="Try again"
            message={error}
            onAction={loadSets}
            title={data.sets.length > 0 ? 'Checklist warning' : 'Sets unavailable'}
          />
        ) : null}

        {mutationError ? <Text style={styles.errorText}>{mutationError}</Text> : null}

        <View style={styles.hero}>
          <Text style={styles.kicker}>Checklists</Text>
          <Text style={styles.heroTitle}>
            {data.sets.length > 0 ? 'Browse the catalog' : 'Catalog coming soon'}
          </Text>
          <Text style={styles.heroText}>
            Tap a checklist card to cycle missing, owned, and wanted.
          </Text>
        </View>

        <View style={styles.grid}>
          <StatTile label="Sets" value={String(data.summary.sets)} />
          <StatTile label="Owned" value={String(data.summary.owned)} />
          <StatTile label="Wanted" value={String(data.summary.wanted)} />
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
                  onPress={() => selectSet(set.id)}
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
                    <ChecklistCardRow
                      card={card}
                      isUpdating={updatingCardIds.has(card.cardId)}
                      key={card.cardId}
                      onPress={() => handleToggleCard(card)}
                    />
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

function ChecklistCardRow({
  card,
  isUpdating,
  onPress,
}: {
  card: NativeChecklistCard;
  isUpdating: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={isUpdating}
      onPress={onPress}
      style={[styles.cardRow, card.status ? styles.cardRowActive : null, isUpdating ? styles.cardRowUpdating : null]}
    >
      <View style={styles.cardInfo}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {card.fighterName}
        </Text>
        <Text numberOfLines={1} style={styles.cardDetail}>
          {card.detail}
        </Text>
      </View>
      <View style={styles.statusWrap}>
        <Text style={[styles.statusBadge, getStatusBadgeStyle(card.status)]}>
          {isUpdating ? 'Saving' : formatCardStatus(card.status)}
        </Text>
        <Text style={styles.nextStatusHint}>{getStatusHint(card.status)}</Text>
      </View>
    </Pressable>
  );
}

function getStatusBadgeStyle(status: string | null) {
  if (status === 'wanted') return styles.statusWanted;
  if (status && OWNED_LIKE_STATUSES.has(status)) return styles.statusOwned;
  return styles.statusMissing;
}

function getStatusHint(status: string | null) {
  const next = getNextChecklistStatus(status);
  if (next === 'owned') return 'Tap to own';
  if (next === 'wanted') return 'Tap to want';
  return 'Tap to clear';
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
  cardRowActive: {
    borderColor: 'rgba(220,38,38,0.32)',
  },
  cardRowUpdating: {
    opacity: 0.62,
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
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
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
    ...sharedScreenStyles.scrollContent,
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
  nextStatusHint: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 5,
    textAlign: 'right',
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
  statusMissing: {
    borderColor: colors.border,
    color: colors.muted,
  },
  statusOwned: {
    borderColor: 'rgba(34,197,94,0.5)',
    color: '#86efac',
  },
  statusWanted: {
    borderColor: 'rgba(251,191,36,0.5)',
    color: '#fde68a',
  },
  statusWrap: {
    alignItems: 'flex-end',
    minWidth: 88,
  },
});
