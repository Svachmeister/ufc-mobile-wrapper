import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  WebFallbackButton,
  sharedScreenStyles,
} from '@/src/components/ui/NativePrimitives';
import { LoadingScreen, ScreenState } from '@/src/components/ui/ScreenState';
import { useAuth } from '@/src/features/auth/AuthProvider';
import {
  type NativeChecklistCard,
  type NativeChecklistSet,
  type NativeChecklistWritableStatus,
  CHECKLIST_CARD_PAGE_SIZE,
  loadNativeChecklists,
  loadNativeSetCards,
  saveNativeChecklistStatus,
} from '@/src/lib/checklists';
import { OWNED_LIKE_STATUSES } from '@/src/lib/collection';
import { colors } from '@/src/lib/theme/tokens';

type SetsState = {
  sets: NativeChecklistSet[];
  summary: {
    owned: number;
    sets: number;
    wanted: number;
  };
  userCardStatuses: Record<string, string | null>;
};

type CardFilter = 'all' | 'missing' | 'owned' | 'wanted';

const emptyState: SetsState = {
  sets: [],
  summary: {
    owned: 0,
    sets: 0,
    wanted: 0,
  },
  userCardStatuses: {},
};

const cardFilters: { label: string; value: CardFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Missing', value: 'missing' },
  { label: 'Owned', value: 'owned' },
  { label: 'Wanted', value: 'wanted' },
];

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

function formatSetMeta(set: NativeChecklistSet) {
  return [set.year, set.brand, formatReleaseDate(set.releaseDate)]
    .filter(Boolean)
    .join(' / ');
}

function getStatusCounts(statuses: Iterable<string | null>) {
  const values = [...statuses];

  return {
    owned: values.filter((status) => status && OWNED_LIKE_STATUSES.has(status)).length,
    wanted: values.filter((status) => status === 'wanted').length,
  };
}

function getDelta(previous: string | null, next: string | null) {
  return {
    owned: (next && OWNED_LIKE_STATUSES.has(next) ? 1 : 0) -
      (previous && OWNED_LIKE_STATUSES.has(previous) ? 1 : 0),
    wanted: (next === 'wanted' ? 1 : 0) - (previous === 'wanted' ? 1 : 0),
  };
}

function applyCardStatus(data: SetsState, card: NativeChecklistCard, status: string | null): SetsState {
  const previousStatus = data.userCardStatuses[card.cardId] ?? null;
  const userCardStatuses = { ...data.userCardStatuses };

  if (status === null) {
    delete userCardStatuses[card.cardId];
  } else {
    userCardStatuses[card.cardId] = status;
  }

  const delta = getDelta(previousStatus, status);
  const sets = data.sets.map((set) => {
    if (set.id !== card.setId) return set;

    return {
      ...set,
      ownedCount: Math.max(0, set.ownedCount + delta.owned),
      wantedCount: Math.max(0, set.wantedCount + delta.wanted),
    };
  });
  const summary = getStatusCounts(Object.values(userCardStatuses));

  return {
    sets,
    summary: {
      owned: summary.owned,
      sets: sets.length,
      wanted: summary.wanted,
    },
    userCardStatuses,
  };
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function matchesCardFilter(card: NativeChecklistCard, filter: CardFilter) {
  if (filter === 'all') return true;
  if (filter === 'missing') return !card.status;
  if (filter === 'wanted') return card.status === 'wanted';
  return Boolean(card.status && OWNED_LIKE_STATUSES.has(card.status));
}

function getCardNumber(detail: string) {
  const match = detail.match(/^#([^\s-]+)/);
  return match?.[1] ?? '-';
}

function getCardVariation(detail: string) {
  return detail.replace(/^#[^\s-]+\s*-\s*/, '') || 'Base card';
}

function getChecklistCardKey(card: NativeChecklistCard) {
  if (card.cardId && card.cardId !== 'unknown-card') return card.cardId;
  return [card.setId, card.fighterName, card.detail].filter(Boolean).join(':');
}

function mergeUniqueCards(
  current: NativeChecklistCard[],
  incoming: NativeChecklistCard[],
  mode: 'append' | 'replace',
) {
  const map = new Map<string, NativeChecklistCard>();
  const source = mode === 'append' ? [...current, ...incoming] : incoming;

  source.forEach((card) => {
    map.set(getChecklistCardKey(card), card);
  });

  return [...map.values()];
}

export function SetsScreen() {
  const { user } = useAuth();
  const listRef = useRef<FlatList<NativeChecklistCard>>(null);
  const detailRequestRef = useRef(0);
  const userCardStatusesRef = useRef<Record<string, string | null>>({});
  const [data, setData] = useState<SetsState>(emptyState);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<NativeChecklistCard[]>([]);
  const [selectedTotalCount, setSelectedTotalCount] = useState<number | null>(null);
  const [nextCardFrom, setNextCardFrom] = useState(0);
  const [hasMoreCards, setHasMoreCards] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [updatingCardIds, setUpdatingCardIds] = useState<Set<string>>(new Set());
  const [setSearch, setSetSearch] = useState('');
  const [cardSearch, setCardSearch] = useState('');
  const [cardFilter, setCardFilter] = useState<CardFilter>('all');

  useEffect(() => {
    userCardStatusesRef.current = data.userCardStatuses;
  }, [data.userCardStatuses]);

  const loadSets = useCallback(async () => {
    if (!user?.id) return;

    const result = await loadNativeChecklists(user.id);
    setError(result.error);
    userCardStatusesRef.current = result.data.userCardStatuses;
    setData(result.data);
    setSelectedSetId((current) => {
      if (current && result.data.sets.some((set) => set.id === current)) return current;
      return null;
    });
  }, [user?.id]);

  const loadSetCardsPage = useCallback(async ({
    from,
    mode,
    searchQuery,
    setId,
  }: {
    from: number;
    mode: 'append' | 'replace';
    searchQuery: string;
    setId: string;
  }) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;

    if (mode === 'append') {
      setIsLoadingMore(true);
    } else {
      setIsDetailLoading(true);
      setDetailError(null);
      setSelectedCards([]);
      setSelectedTotalCount(null);
      setNextCardFrom(0);
      setHasMoreCards(false);
    }

    const result = await loadNativeSetCards({
      from,
      searchQuery,
      setId,
      userCardStatuses: userCardStatusesRef.current,
    });

    if (detailRequestRef.current !== requestId) {
      if (mode === 'append') {
        setIsLoadingMore(false);
      } else {
        setIsDetailLoading(false);
      }
      return;
    }

    if (result.error) {
      setDetailError(result.error);
    } else {
      setDetailError(null);
    }

    setSelectedCards((current) => mergeUniqueCards(current, result.cards, mode));
    setSelectedTotalCount(result.totalCount);
    setNextCardFrom(result.nextFrom);
    setHasMoreCards(result.hasMore);
    setData((current) => ({
      ...current,
      sets: current.sets.map((set) => (
        set.id === setId && result.totalCount !== null
          ? { ...set, cardCount: result.totalCount }
          : set
      )),
    }));

    if (mode === 'append') {
      setIsLoadingMore(false);
    } else {
      setIsDetailLoading(false);
    }
  }, []);

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

  const normalizedCardSearch = normalizeSearch(cardSearch);

  useEffect(() => {
    if (!selectedSetId) {
      setSelectedCards([]);
      setSelectedTotalCount(null);
      setNextCardFrom(0);
      setHasMoreCards(false);
      setCardSearch('');
      setCardFilter('all');
      return;
    }

    loadSetCardsPage({
      from: 0,
      mode: 'replace',
      searchQuery: normalizedCardSearch,
      setId: selectedSetId,
    });
  }, [loadSetCardsPage, normalizedCardSearch, selectedSetId]);

  const refresh = async () => {
    setIsRefreshing(true);
    setMutationError(null);
    await loadSets();
    if (selectedSetId) {
      await loadSetCardsPage({
        from: 0,
        mode: 'replace',
        searchQuery: normalizedCardSearch,
        setId: selectedSetId,
      });
    }
    setIsRefreshing(false);
  };

  const openWebFallback = () => {
    router.push('/web-fallback' as never);
  };

  const selectSet = useCallback((setId: string) => {
    setMutationError(null);
    setSelectedSetId(setId);
    listRef.current?.scrollToOffset({ animated: false, offset: 0 });
  }, []);

  const goBackToSets = useCallback(() => {
    setSelectedSetId(null);
    setSelectedCards([]);
    setSelectedTotalCount(null);
    setNextCardFrom(0);
    setHasMoreCards(false);
    setDetailError(null);
    setMutationError(null);
  }, []);

  const loadMoreCards = useCallback(() => {
    if (!selectedSetId || isLoadingMore || isDetailLoading || !hasMoreCards) return;
    loadSetCardsPage({
      from: nextCardFrom,
      mode: 'append',
      searchQuery: normalizedCardSearch,
      setId: selectedSetId,
    });
  }, [
    hasMoreCards,
    isDetailLoading,
    isLoadingMore,
    loadSetCardsPage,
    nextCardFrom,
    normalizedCardSearch,
    selectedSetId,
  ]);

  const handleSetCardStatus = useCallback(async (
    card: NativeChecklistCard,
    requestedStatus: NativeChecklistWritableStatus,
  ) => {
    if (!user?.id || updatingCardIds.has(card.cardId)) return;

    const isActive = requestedStatus === 'owned'
      ? Boolean(card.status && OWNED_LIKE_STATUSES.has(card.status))
      : card.status === 'wanted';
    const nextStatus = isActive ? null : requestedStatus;

    setMutationError(null);
    setUpdatingCardIds((current) => new Set(current).add(card.cardId));
    setSelectedCards((current) => current.map((item) => (
      item.cardId === card.cardId ? { ...item, status: nextStatus } : item
    )));
    setData((current) => {
      const updated = applyCardStatus(current, card, nextStatus);
      userCardStatusesRef.current = updated.userCardStatuses;
      return updated;
    });

    const result = await saveNativeChecklistStatus({
      cardId: card.cardId,
      status: nextStatus,
      userId: user.id,
    });

    if (result.error) {
      setSelectedCards((current) => current.map((item) => (
        item.cardId === card.cardId ? { ...item, status: card.status } : item
      )));
      setData((current) => {
        const updated = applyCardStatus(current, card, card.status);
        userCardStatusesRef.current = updated.userCardStatuses;
        return updated;
      });
      setMutationError(result.error);
    }

    setUpdatingCardIds((current) => {
      const next = new Set(current);
      next.delete(card.cardId);
      return next;
    });
  }, [updatingCardIds, user?.id]);

  const selectedSet = useMemo(
    () => data.sets.find((set) => set.id === selectedSetId) ?? null,
    [data.sets, selectedSetId],
  );

  const filteredSets = useMemo(() => {
    const query = normalizeSearch(setSearch);
    if (!query) return data.sets;

    return data.sets.filter((set) => (
      [set.name, set.brand, set.year, formatReleaseDate(set.releaseDate)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    ));
  }, [data.sets, setSearch]);

  const filteredCards = useMemo(() => {
    return selectedCards.filter((card) => {
      if (!matchesCardFilter(card, cardFilter)) return false;
      return true;
    });
  }, [cardFilter, selectedCards]);

  const detailCountLabel = selectedTotalCount !== null
    ? `${selectedCards.length}/${selectedTotalCount} loaded`
    : `${selectedCards.length} loaded`;
  const isFilteringCards = Boolean(normalizedCardSearch) || cardFilter !== 'all';
  const cardListData = selectedSet ? filteredCards : [];

  if (isLoading) return <LoadingScreen label="Loading sets" />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <FlatList
        ref={listRef}
        data={cardListData}
        keyExtractor={(card) => getChecklistCardKey(card)}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.red}
            onRefresh={refresh}
          />
        }
        renderItem={({ item }) => (
          <ChecklistCardRow
            card={item}
            isUpdating={updatingCardIds.has(item.cardId)}
            onSetStatus={handleSetCardStatus}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
        ListHeaderComponent={(
          <>
            <View style={styles.topBar}>
              <View>
                <Text style={styles.screenTitle}>{selectedSet ? 'Checklist' : 'Card Sets'}</Text>
                <Text style={styles.screenSubtitle}>
                  {selectedSet
                    ? 'Track owned cards and wanted targets.'
                    : 'Browse sets and open a fast mobile checklist.'}
                </Text>
              </View>
              <WebFallbackButton onPress={openWebFallback} />
            </View>

            {error ? (
              <ScreenState
                actionLabel="Try again"
                message={error}
                onAction={loadSets}
                title={data.sets.length > 0 ? 'Checklist warning' : 'Sets unavailable'}
              />
            ) : null}

            {mutationError ? <Text style={styles.errorText}>{mutationError}</Text> : null}

            {selectedSet ? (
              <SetDetailHeader
                cardFilter={cardFilter}
                cardSearch={cardSearch}
                detailCountLabel={detailCountLabel}
                detailError={detailError}
                isDetailLoading={isDetailLoading}
                onBack={goBackToSets}
                onChangeCardFilter={setCardFilter}
                onChangeCardSearch={setCardSearch}
                selectedSet={selectedSet}
                selectedTotalCount={selectedTotalCount}
              />
            ) : (
              <SetBrowser
                filteredSets={filteredSets}
                onChangeSearch={setSetSearch}
                onSelectSet={selectSet}
                search={setSearch}
                sets={data.sets}
                summary={data.summary}
              />
            )}
          </>
        )}
        ListEmptyComponent={(
          selectedSet && !isDetailLoading && !detailError ? (
            <EmptyText
              message={isFilteringCards
                ? 'No cards match this search or filter.'
                : 'No cards found for this set.'}
            />
          ) : null
        )}
        ListFooterComponent={(
          selectedSet ? (
            <View style={styles.footer}>
              {hasMoreCards ? (
                <Pressable
                  disabled={isLoadingMore}
                  onPress={loadMoreCards}
                  style={[styles.loadMoreButton, isLoadingMore ? styles.loadMoreButtonDisabled : null]}
                >
                  <Text style={styles.loadMoreText}>
                    {isLoadingMore ? 'Loading...' : `Load ${CHECKLIST_CARD_PAGE_SIZE} more`}
                  </Text>
                </Pressable>
              ) : selectedCards.length > 0 ? (
                <Text style={styles.endText}>End of checklist</Text>
              ) : null}
            </View>
          ) : null
        )}
      />
    </SafeAreaView>
  );
}

function SetBrowser({
  filteredSets,
  onChangeSearch,
  onSelectSet,
  search,
  sets,
  summary,
}: {
  filteredSets: NativeChecklistSet[];
  onChangeSearch: (value: string) => void;
  onSelectSet: (setId: string) => void;
  search: string;
  sets: NativeChecklistSet[];
  summary: SetsState['summary'];
}) {
  return (
    <View style={styles.section}>
      <View style={styles.summaryStrip}>
        <MiniStat label="Sets" value={String(summary.sets)} />
        <MiniStat label="Owned" value={String(summary.owned)} />
        <MiniStat label="Wanted" value={String(summary.wanted)} />
      </View>

      <SearchInput
        onChangeText={onChangeSearch}
        placeholder="Search card sets"
        value={search}
      />

      <View style={styles.listHeader}>
        <Text style={styles.kicker}>Set browser</Text>
        <Text style={styles.countText}>
          {filteredSets.length} of {sets.length}
        </Text>
      </View>

      {sets.length === 0 ? (
        <EmptyText message="No sets are available in the native catalog yet." />
      ) : filteredSets.length === 0 ? (
        <EmptyText message="No card sets match this search." />
      ) : (
        <View style={styles.setList}>
          {filteredSets.map((set) => (
            <SetRow
              key={set.id}
              onPress={() => onSelectSet(set.id)}
              set={set}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function SetDetailHeader({
  cardFilter,
  cardSearch,
  detailCountLabel,
  detailError,
  isDetailLoading,
  onBack,
  onChangeCardFilter,
  onChangeCardSearch,
  selectedSet,
  selectedTotalCount,
}: {
  cardFilter: CardFilter;
  cardSearch: string;
  detailCountLabel: string;
  detailError: string | null;
  isDetailLoading: boolean;
  onBack: () => void;
  onChangeCardFilter: (value: CardFilter) => void;
  onChangeCardSearch: (value: string) => void;
  selectedSet: NativeChecklistSet;
  selectedTotalCount: number | null;
}) {
  return (
    <View style={styles.section}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>All sets</Text>
      </Pressable>

      <View style={styles.selectedHeader}>
        <Text numberOfLines={2} style={styles.selectedTitle}>{selectedSet.name}</Text>
        <Text numberOfLines={1} style={styles.selectedMeta}>{formatSetMeta(selectedSet)}</Text>
      </View>

      <View style={styles.summaryStrip}>
        <MiniStat
          label="Total"
          value={selectedTotalCount === null ? '-' : String(selectedTotalCount)}
        />
        <MiniStat label="Owned" value={String(selectedSet.ownedCount)} />
        <MiniStat label="Wanted" value={String(selectedSet.wantedCount)} />
      </View>

      <SearchInput
        onChangeText={onChangeCardSearch}
        placeholder="Search cards in this set"
        value={cardSearch}
      />

      <View style={styles.filterRow}>
        {cardFilters.map((filter) => (
          <Pressable
            key={filter.value}
            onPress={() => onChangeCardFilter(filter.value)}
            style={[styles.filterChip, cardFilter === filter.value ? styles.filterChipActive : null]}
          >
            <Text style={[styles.filterChipText, cardFilter === filter.value ? styles.filterChipTextActive : null]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.kicker}>Cards</Text>
        <Text style={styles.countText}>{detailCountLabel}</Text>
      </View>

      {detailError ? <Text style={styles.errorText}>{detailError}</Text> : null}
      {isDetailLoading ? (
        <Text style={styles.helperText}>Loading the first {CHECKLIST_CARD_PAGE_SIZE} cards...</Text>
      ) : null}
    </View>
  );
}

function ChecklistCardRow({
  card,
  isUpdating,
  onSetStatus,
}: {
  card: NativeChecklistCard;
  isUpdating: boolean;
  onSetStatus: (card: NativeChecklistCard, status: NativeChecklistWritableStatus) => void;
}) {
  const isOwned = Boolean(card.status && OWNED_LIKE_STATUSES.has(card.status));
  const isWanted = card.status === 'wanted';

  return (
    <View style={[styles.cardRow, isUpdating ? styles.rowUpdating : null]}>
      <View style={styles.cardNumberWrap}>
        <Text numberOfLines={1} style={styles.cardNumber}>
          {getCardNumber(card.detail)}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {card.fighterName}
        </Text>
        <Text numberOfLines={1} style={styles.cardDetail}>
          {getCardVariation(card.detail)}
        </Text>
      </View>
      <View style={styles.statusControls}>
        <StatusButton
          active={isOwned}
          disabled={isUpdating}
          label="Owned"
          onPress={() => onSetStatus(card, 'owned')}
          tone="owned"
        />
        <StatusButton
          active={isWanted}
          disabled={isUpdating}
          label="Wanted"
          onPress={() => onSetStatus(card, 'wanted')}
          tone="wanted"
        />
      </View>
    </View>
  );
}

function StatusButton({
  active,
  disabled,
  label,
  onPress,
  tone,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
  tone: 'owned' | 'wanted';
}) {
  const activeStyle = tone === 'wanted' ? styles.statusButtonWantedActive : styles.statusButtonOwnedActive;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.statusButton, active ? activeStyle : null]}
    >
      <Text style={[styles.statusButtonText, active ? styles.statusButtonTextActive : null]}>
        {label}
      </Text>
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

function SearchInput({
  onChangeText,
  placeholder,
  value,
}: {
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.searchWrap}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray500}
        returnKeyType="search"
        style={styles.searchInput}
        value={value}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} style={styles.clearSearchButton}>
          <Text style={styles.clearSearchText}>Clear</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyText({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

function SetRow({
  onPress,
  set,
}: {
  onPress: () => void;
  set: NativeChecklistSet;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.setRow}
    >
      <View style={styles.setInfo}>
        <Text numberOfLines={1} style={styles.setTitle}>
          {set.name}
        </Text>
        <Text numberOfLines={1} style={styles.setMeta}>
          {formatSetMeta(set)}
        </Text>
        <Text style={styles.setCounts}>
          {set.cardCount === null ? '-' : set.cardCount} cards / {set.ownedCount} owned / {set.wantedCount} wanted
        </Text>
      </View>
      <Text style={styles.setAction}>Open</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    borderColor: colors.ink,
    borderRadius: 5,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  backButtonText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardDetail: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardNumber: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  cardNumberWrap: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    width: 44,
  },
  cardRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 62,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  cardSeparator: {
    height: 8,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
    textTransform: 'uppercase',
  },
  clearSearchButton: {
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  clearSearchText: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  container: {
    backgroundColor: '#fbfaf7',
    flex: 1,
  },
  countText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  emptyState: {
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    padding: 14,
  },
  emptyText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  endText: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginBottom: 10,
  },
  filterChip: {
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  filterChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  filterChipText: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 10,
  },
  footer: {
    paddingBottom: 18,
    paddingTop: 14,
  },
  helperText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 10,
  },
  kicker: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 14,
  },
  loadMoreButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 6,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  loadMoreButtonDisabled: {
    opacity: 0.62,
  },
  loadMoreText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  miniStat: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  miniStatLabel: {
    color: colors.textSoft,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  miniStatValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  rowUpdating: {
    opacity: 0.58,
  },
  screenSubtitle: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 250,
  },
  screenTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
    gap: 0,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    minHeight: 44,
    paddingVertical: 0,
  },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 12,
  },
  section: {
    marginTop: 16,
  },
  selectedHeader: {
    borderLeftColor: colors.red,
    borderLeftWidth: 4,
    paddingLeft: 11,
  },
  selectedMeta: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  selectedTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.1,
    lineHeight: 25,
    textTransform: 'uppercase',
  },
  setAction: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  setCounts: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
  },
  setInfo: {
    flex: 1,
    minWidth: 0,
  },
  setList: {
    gap: 8,
  },
  setMeta: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  setRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  setTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  statusButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 7,
    width: 58,
  },
  statusButtonOwnedActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  statusButtonText: {
    color: colors.textSoft,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusButtonTextActive: {
    color: colors.textInverse,
  },
  statusButtonWantedActive: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  statusControls: {
    gap: 5,
  },
  summaryStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  topBar: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
