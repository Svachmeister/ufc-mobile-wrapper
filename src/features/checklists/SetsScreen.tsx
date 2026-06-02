import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { sharedScreenStyles } from '@/src/components/ui/NativePrimitives';
import { LoadingScreen, ScreenState } from '@/src/components/ui/ScreenState';
import { useAuth } from '@/src/features/auth/AuthProvider';
import {
  type NativeChecklistCard,
  type NativeChecklistSet,
  type NativeChecklistWritableStatus,
  CHECKLIST_CARD_PAGE_SIZE,
  getNextChecklistStatus,
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

type ChecklistGroup = {
  cardIdLabel: string;
  cards: NativeChecklistCard[];
  fighterName: string;
  key: string;
  ownedCount: number;
  subset: string | null;
  wantedCount: number;
};

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

function formatSetCounts(set: NativeChecklistSet) {
  const total = set.cardCount === null || set.cardCount === undefined
    ? 'Cards TBA'
    : `${set.cardCount} cards`;

  return `${total} / ${set.ownedCount} owned / ${set.wantedCount} wanted`;
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

function getCardNumber(detail: string) {
  const match = detail.match(/^#([^\s-]+)/);
  return match?.[1] ?? '-';
}

function getCardVariation(detail: string) {
  return detail.replace(/^#[^\s-]+\s*-\s*/, '') || 'Base card';
}

function formatPrintRun(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes('/')) return trimmed;
  return `/${trimmed}`;
}

function getChipLabel(card: NativeChecklistCard) {
  const variation = getCardVariation(card.detail);
  const printRun = formatPrintRun(card.printRun);
  const label = variation === 'Base card' ? 'Base' : variation;

  if (printRun && !label.includes(printRun)) return `${label} ${printRun}`;
  return label;
}

function getGroupIdentity(card: NativeChecklistCard) {
  return {
    cardIdLabel: card.cardIdLabel ?? getCardNumber(card.detail),
    fighterName: card.fighterName || 'Unknown fighter',
    subset: card.subset,
  };
}

function getGroupKey(card: NativeChecklistCard) {
  const identity = getGroupIdentity(card);
  return [
    card.setId || 'unknown-set',
    identity.fighterName.toLowerCase(),
    identity.cardIdLabel.toLowerCase(),
    (identity.subset || 'base').toLowerCase(),
  ].join(':');
}

function buildChecklistGroups(cards: NativeChecklistCard[]) {
  const map = new Map<string, ChecklistGroup>();

  cards.forEach((card) => {
    const identity = getGroupIdentity(card);
    const key = getGroupKey(card);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        cardIdLabel: identity.cardIdLabel,
        cards: [card],
        fighterName: identity.fighterName,
        key,
        ownedCount: card.status && OWNED_LIKE_STATUSES.has(card.status) ? 1 : 0,
        subset: identity.subset,
        wantedCount: card.status === 'wanted' ? 1 : 0,
      });
      return;
    }

    existing.cards.push(card);
    if (card.status && OWNED_LIKE_STATUSES.has(card.status)) existing.ownedCount += 1;
    if (card.status === 'wanted') existing.wantedCount += 1;
  });

  return [...map.values()].map((group) => ({
    ...group,
    cards: [...group.cards].sort((a, b) => (
      getChipLabel(a).localeCompare(getChipLabel(b), undefined, { numeric: true })
    )),
  }));
}

function groupMatchesFilter(group: ChecklistGroup, filter: CardFilter) {
  if (filter === 'all') return true;
  if (filter === 'missing') return group.cards.some((card) => !card.status);
  if (filter === 'wanted') return group.wantedCount > 0;
  return group.ownedCount > 0;
}

function getChecklistGroupKey(group: ChecklistGroup) {
  return group.key;
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
  const listRef = useRef<FlatList<ChecklistGroup>>(null);
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
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());

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
      setExpandedGroupKeys(new Set());
      return;
    }

    loadSetCardsPage({
      from: 0,
      mode: 'replace',
      searchQuery: normalizedCardSearch,
      setId: selectedSetId,
    });
  }, [loadSetCardsPage, normalizedCardSearch, selectedSetId]);

  useEffect(() => {
    setExpandedGroupKeys(new Set());
  }, [cardFilter, normalizedCardSearch, selectedSetId]);

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
    setExpandedGroupKeys(new Set());
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
    nextStatus: NativeChecklistWritableStatus | null,
  ) => {
    if (!user?.id || updatingCardIds.has(card.cardId)) return;

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

  const groupedCards = useMemo(() => {
    return buildChecklistGroups(selectedCards)
      .filter((group) => groupMatchesFilter(group, cardFilter));
  }, [cardFilter, selectedCards]);

  const detailCountLabel = selectedTotalCount !== null
    ? `${selectedCards.length}/${selectedTotalCount} loaded · ${groupedCards.length} groups`
    : `${selectedCards.length} loaded · ${groupedCards.length} groups`;
  const isFilteringCards = Boolean(normalizedCardSearch) || cardFilter !== 'all';
  const cardListData = selectedSet ? groupedCards : [];

  if (isLoading) return <LoadingScreen label="Loading sets" />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <FlatList
        ref={listRef}
        data={cardListData}
        keyExtractor={(group) => getChecklistGroupKey(group)}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.red}
            onRefresh={refresh}
          />
        }
        renderItem={({ item }) => (
          <ChecklistGroupRow
            group={item}
            isExpanded={expandedGroupKeys.has(item.key)}
            onSetStatus={handleSetCardStatus}
            onToggleExpanded={() => {
              setExpandedGroupKeys((current) => {
                const next = new Set(current);
                if (next.has(item.key)) {
                  next.delete(item.key);
                } else {
                  next.add(item.key);
                }
                return next;
              });
            }}
            updatingCardIds={updatingCardIds}
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
                    ? 'Mark owned cards and chase list targets.'
                    : 'Track UFC sets, cards and chase targets.'}
                </Text>
              </View>
              <UtilityWebButton onPress={openWebFallback} />
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
        <View style={styles.selectedHeaderMain}>
          <SetCover imageUrl={selectedSet.imageUrl} size="large" />
          <View style={styles.selectedInfo}>
            <Text numberOfLines={3} style={styles.selectedTitle}>{selectedSet.name}</Text>
            <Text numberOfLines={2} style={styles.selectedMeta}>{formatSetMeta(selectedSet)}</Text>
          </View>
        </View>
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
        <Text style={styles.kicker}>Checklist groups</Text>
        <Text style={styles.countText}>{detailCountLabel}</Text>
      </View>

      {detailError ? <Text style={styles.errorText}>{detailError}</Text> : null}
      {isDetailLoading ? (
        <Text style={styles.helperText}>Loading the first {CHECKLIST_CARD_PAGE_SIZE} cards...</Text>
      ) : null}
    </View>
  );
}

function ChecklistGroupRow({
  group,
  isExpanded,
  onSetStatus,
  onToggleExpanded,
  updatingCardIds,
}: {
  group: ChecklistGroup;
  isExpanded: boolean;
  onSetStatus: (card: NativeChecklistCard, status: NativeChecklistWritableStatus | null) => void;
  onToggleExpanded: () => void;
  updatingCardIds: Set<string>;
}) {
  const collapsedLimit = group.cards.length > 10 ? 8 : 6;
  const visibleCards = isExpanded ? group.cards : group.cards.slice(0, collapsedLimit);
  const hiddenCount = Math.max(0, group.cards.length - visibleCards.length);

  return (
    <View style={styles.groupRow}>
      <View style={styles.groupTop}>
        <View style={styles.cardNumberWrap}>
          <Text numberOfLines={1} style={styles.cardNumber}>
            {group.cardIdLabel}
          </Text>
        </View>
        <View style={styles.groupInfo}>
          <View style={styles.cardTitleRow}>
            <Text numberOfLines={2} style={styles.cardTitle}>
              {group.fighterName}
            </Text>
            {group.cards.some((card) => card.isRookie) ? <Text style={styles.rookieBadge}>RC</Text> : null}
          </View>
          <Text numberOfLines={1} style={styles.cardDetail}>
            {[`#${group.cardIdLabel}`, group.subset || 'Base Set', `${group.cards.length} cards`].join(' · ')}
          </Text>
          <Text style={styles.groupStats}>
            {group.ownedCount || group.wantedCount
              ? `${group.ownedCount} owned · ${group.wantedCount} wanted`
              : 'No cards marked'}
          </Text>
        </View>
      </View>

      <View style={styles.chipGrid}>
        {visibleCards.map((card) => (
          <VariationChip
            key={getChecklistCardKey(card)}
            card={card}
            isUpdating={updatingCardIds.has(card.cardId)}
            onSetStatus={onSetStatus}
          />
        ))}
        {hiddenCount > 0 ? (
          <Pressable onPress={onToggleExpanded} style={styles.moreChip}>
            <Text style={styles.moreChipText}>+{hiddenCount}</Text>
          </Pressable>
        ) : isExpanded && group.cards.length > collapsedLimit ? (
          <Pressable onPress={onToggleExpanded} style={styles.moreChip}>
            <Text style={styles.moreChipText}>Show less</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function VariationChip({
  card,
  isUpdating,
  onSetStatus,
}: {
  card: NativeChecklistCard;
  isUpdating: boolean;
  onSetStatus: (card: NativeChecklistCard, status: NativeChecklistWritableStatus | null) => void;
}) {
  const isOwned = Boolean(card.status && OWNED_LIKE_STATUSES.has(card.status));
  const isWanted = card.status === 'wanted';
  const activeStyle = isOwned
    ? styles.variationChipOwned
    : isWanted
      ? styles.variationChipWanted
      : null;
  const activeTextStyle = isOwned
    ? styles.variationChipTextOwned
    : isWanted
      ? styles.variationChipTextWanted
      : null;

  return (
    <Pressable
      disabled={isUpdating}
      onPress={() => {
        const nextStatus = getNextChecklistStatus(card.status);
        onSetStatus(card, nextStatus);
      }}
      style={({ pressed }) => [
        styles.variationChip,
        activeStyle,
        isUpdating ? styles.rowUpdating : null,
        pressed && !isUpdating ? styles.statusButtonPressed : null,
      ]}
    >
      <Text numberOfLines={1} style={[styles.variationChipText, activeTextStyle]}>
        {isOwned ? `✓ ${getChipLabel(card)}` : isWanted ? `Want ${getChipLabel(card)}` : getChipLabel(card)}
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
      <SetCover imageUrl={set.imageUrl} size="small" />
      <View style={styles.setInfo}>
        <Text numberOfLines={1} style={styles.setTitle}>
          {set.name}
        </Text>
        <Text numberOfLines={1} style={styles.setMeta}>
          {formatSetMeta(set)}
        </Text>
        <Text style={styles.setCounts}>
          {formatSetCounts(set)}
        </Text>
      </View>
      <Text style={styles.setAction}>Open</Text>
    </Pressable>
  );
}

function UtilityWebButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.utilityWebButton}>
      <Text style={styles.utilityWebButtonText}>Web</Text>
    </Pressable>
  );
}

function SetCover({
  imageUrl,
  size,
}: {
  imageUrl: string | null;
  size: 'large' | 'small';
}) {
  const [failed, setFailed] = useState(false);
  const style = size === 'large' ? styles.setCoverLarge : styles.setCoverSmall;

  if (!imageUrl || failed) {
    return (
      <View style={[styles.setCover, style, styles.setCoverPlaceholder]}>
        <Text style={styles.setCoverPlaceholderText}>FCS</Text>
      </View>
    );
  }

  return (
    <View style={[styles.setCover, style]}>
      <Image
        onError={() => setFailed(true)}
        resizeMode="contain"
        source={{ uri: imageUrl }}
        style={styles.setCoverImage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  backButtonText: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardDetail: {
    color: colors.gray500,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 4,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardNumber: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  cardNumberWrap: {
    alignItems: 'center',
    backgroundColor: '#fbfaf7',
    borderColor: colors.borderStrong,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 4,
    width: 44,
  },
  cardRow: {
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 70,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  cardSeparator: {
    height: 8,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 15,
    flex: 1,
    fontWeight: '900',
    lineHeight: 19,
    minWidth: 0,
    textTransform: 'uppercase',
  },
  cardBadgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  cardTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 7,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
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
  groupInfo: {
    flex: 1,
    minWidth: 0,
  },
  groupRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderLeftColor: colors.red,
    borderLeftWidth: 2,
    borderWidth: 1,
    padding: 12,
  },
  groupStats: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
    marginTop: 5,
    textTransform: 'uppercase',
  },
  groupTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 11,
  },
  printRunBadge: {
    borderColor: colors.red,
    borderRadius: 3,
    borderWidth: 1,
    color: colors.red,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.35,
    lineHeight: 11,
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingVertical: 2,
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
    paddingVertical: 10,
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
  moreChip: {
    alignItems: 'center',
    backgroundColor: '#fbfaf7',
    borderColor: colors.border,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 10,
  },
  moreChipText: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  rowUpdating: {
    opacity: 0.58,
  },
  rookieBadge: {
    backgroundColor: '#fff7f7',
    borderColor: colors.red,
    borderWidth: 1,
    borderRadius: 3,
    color: colors.red,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
    lineHeight: 11,
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingVertical: 2,
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
    marginTop: 13,
    paddingHorizontal: 12,
  },
  section: {
    marginTop: 16,
  },
  selectedHeader: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderTopColor: colors.red,
    borderTopWidth: 3,
    borderWidth: 1,
    padding: 12,
  },
  selectedHeaderMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  selectedInfo: {
    flex: 1,
    minWidth: 0,
  },
  selectedMeta: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: 5,
  },
  selectedTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.1,
    lineHeight: 22,
    textTransform: 'uppercase',
  },
  setAction: {
    borderColor: colors.border,
    borderRadius: 4,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textTransform: 'uppercase',
  },
  setCover: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  setCoverImage: {
    height: '100%',
    width: '100%',
  },
  setCoverLarge: {
    height: 66,
    width: 66,
  },
  setCoverPlaceholder: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  setCoverPlaceholderText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  setCoverSmall: {
    height: 54,
    width: 54,
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
    gap: 11,
    minHeight: 74,
    paddingHorizontal: 10,
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
    backgroundColor: colors.surface,
    borderColor: colors.gray200,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 29,
    paddingHorizontal: 6,
    width: 58,
  },
  statusButtonOwnedActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  statusButtonPressed: {
    opacity: 0.72,
  },
  statusButtonText: {
    color: colors.gray500,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.55,
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
    justifyContent: 'center',
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
  utilityWebButton: {
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  utilityWebButtonText: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  variationChip: {
    alignItems: 'center',
    backgroundColor: '#fbfaf7',
    borderColor: colors.border,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: '100%',
    minHeight: 31,
    paddingHorizontal: 9,
  },
  variationChipOwned: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  variationChipText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  variationChipTextOwned: {
    color: colors.textInverse,
  },
  variationChipTextWanted: {
    color: colors.red,
  },
  variationChipWanted: {
    backgroundColor: colors.surface,
    borderColor: colors.red,
    borderWidth: 1,
  },
});
