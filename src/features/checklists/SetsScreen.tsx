import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
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
  type NativeChecklistSubset,
  getNextChecklistStatus,
  loadNativeChecklists,
  loadNativeSetCardsBySubsetForMatrix,
  loadNativeSetSubsets,
  saveNativeChecklistStatus,
} from '@/src/lib/checklists';
import { buildChecklistMatrixData } from './checklistMatrixMapper';
import SectionChecklistMatrix from './SectionChecklistMatrix';
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

const emptyState: SetsState = {
  sets: [],
  summary: {
    owned: 0,
    sets: 0,
    wanted: 0,
  },
  userCardStatuses: {},
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

function formatFullReleaseDate(value: string | null) {
  if (!value) return 'Release TBA';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getSetYear(set: NativeChecklistSet) {
  if (set.year) return set.year;

  const nameYear = set.name.match(/\b(20\d{2}|19\d{2})\b/);
  if (nameYear?.[1]) return nameYear[1];

  if (set.releaseDate) {
    const date = new Date(set.releaseDate);
    if (!Number.isNaN(date.getTime())) return String(date.getFullYear());
  }

  return null;
}

function getReleaseTime(set: NativeChecklistSet) {
  if (!set.releaseDate) return null;
  const date = new Date(set.releaseDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function sortSetsForBrowser(sets: NativeChecklistSet[]) {
  return [...sets].sort((a, b) => {
    const releaseA = getReleaseTime(a);
    const releaseB = getReleaseTime(b);
    if (releaseA !== null && releaseB !== null && releaseA !== releaseB) return releaseB - releaseA;
    if (releaseA !== null && releaseB === null) return -1;
    if (releaseA === null && releaseB !== null) return 1;

    const yearCompare = String(getSetYear(b) || '').localeCompare(String(getSetYear(a) || ''));
    if (yearCompare !== 0) return yearCompare;

    return a.name.localeCompare(b.name);
  });
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function SetsScreen() {
  const { user } = useAuth();
  const subsetRequestRef = useRef(0);
  const matrixRequestRef = useRef(0);
  const userCardStatusesRef = useRef<Record<string, string | null>>({});
  const [data, setData] = useState<SetsState>(emptyState);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [selectedSubsets, setSelectedSubsets] = useState<NativeChecklistSubset[]>([]);
  const [isSubsetLoading, setIsSubsetLoading] = useState(false);
  const [subsetError, setSubsetError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [setSearch, setSetSearch] = useState('');
  const [setYearFilter, setSetYearFilter] = useState('all');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [matrixCards, setMatrixCards] = useState<NativeChecklistCard[]>([]);
  const [matrixError, setMatrixError] = useState<string | null>(null);
  const [isMatrixLoading, setIsMatrixLoading] = useState(false);
  const [updatingCardIds, setUpdatingCardIds] = useState<Record<string, boolean>>({});

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

  const loadSetSubsets = useCallback(async ({ setId }: { setId: string }) => {
    const requestId = subsetRequestRef.current + 1;
    subsetRequestRef.current = requestId;

    setIsSubsetLoading(true);
    setSubsetError(null);
    setSelectedSubsets([]);

    const result = await loadNativeSetSubsets({ setId });

    if (subsetRequestRef.current !== requestId) {
      setIsSubsetLoading(false);
      return;
    }

    setSubsetError(result.error);
    setSelectedSubsets(result.subsets);
    setIsSubsetLoading(false);
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

  useEffect(() => {
    if (!selectedSetId) {
      setSelectedSubsets([]);
      setSubsetError(null);
      return;
    }

    loadSetSubsets({ setId: selectedSetId });
  }, [loadSetSubsets, selectedSetId]);

  const refresh = async () => {
    setIsRefreshing(true);
    await loadSets();
    setIsRefreshing(false);
  };

  const selectSet = useCallback((setId: string) => {
    setSelectedSetId(setId);
  }, []);

  const goBackToSets = useCallback(() => {
    setSelectedSetId(null);
    setSelectedSubsets([]);
    setSubsetError(null);
    setSelectedSection(null);
    setMatrixCards([]);
    setMatrixError(null);
  }, []);

  const loadMatrixCards = useCallback(async ({ setId, subset }: { setId: string; subset: string }) => {
    if (!user?.id) return;

    const requestId = matrixRequestRef.current + 1;
    matrixRequestRef.current = requestId;

    setIsMatrixLoading(true);
    setMatrixError(null);
    setMatrixCards([]);

    const result = await loadNativeSetCardsBySubsetForMatrix({
      setId,
      subset,
      userId: user.id,
    });

    if (matrixRequestRef.current !== requestId) return;

    if (result.error) {
      setMatrixError(result.error);
      setMatrixCards([]);
      setIsMatrixLoading(false);
      return;
    }

    setMatrixCards(result.cards);
    setIsMatrixLoading(false);
  }, [user?.id]);

  const handleSectionPress = useCallback((section: string) => {
    setSelectedSection(section);
  }, []);

  const goBackFromMatrix = useCallback(() => {
    setSelectedSection(null);
    setMatrixCards([]);
    setMatrixError(null);
  }, []);

  useEffect(() => {
    if (!selectedSetId || !selectedSection) return;
    loadMatrixCards({ setId: selectedSetId, subset: selectedSection });
  }, [loadMatrixCards, selectedSection, selectedSetId]);

  useEffect(() => {
    if (!selectedSetId) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedSection) {
        goBackFromMatrix();
      } else {
        goBackToSets();
      }
      return true;
    });
    return () => sub.remove();
  }, [goBackFromMatrix, goBackToSets, selectedSection, selectedSetId]);

  const selectedSet = useMemo(
    () => data.sets.find((set) => set.id === selectedSetId) ?? null,
    [data.sets, selectedSetId],
  );

  const matrixData = useMemo(() => {
    if (!selectedSection || !selectedSet) return null;
    const startedAt = Date.now();
    const nextMatrixData = buildChecklistMatrixData({
      cards: matrixCards,
      sectionName: selectedSection,
      setName: selectedSet.name,
    });

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info(
        [
          `[FCS] matrix build "${selectedSection}"`,
          `rows=${nextMatrixData.rows.length}`,
          `columns=${nextMatrixData.columns.length}`,
          `cells=${Object.keys(nextMatrixData.cellCards).length}`,
          `time=${Date.now() - startedAt}ms`,
        ].join(' | '),
      );
    }

    return nextMatrixData;
  }, [matrixCards, selectedSection, selectedSet]);

  const handleMatrixCellPress = useCallback(async (
    rowKey: string,
    columnKey: string,
    currentStatus: string | null,
  ) => {
    if (!user?.id || !matrixData) return;

    const cellCard = matrixData.cellCards[`${rowKey}::${columnKey}`];
    if (!cellCard || updatingCardIds[cellCard.cardId]) return;

    const previousStatus = cellCard.status;
    const nextStatus = getNextChecklistStatus(currentStatus);

    setUpdatingCardIds(current => ({ ...current, [cellCard.cardId]: true }));
    setMatrixCards(current => current.map(card => (
      card.cardId === cellCard.cardId ? { ...card, status: nextStatus } : card
    )));
    setData(current => ({
      ...current,
      userCardStatuses: {
        ...current.userCardStatuses,
        [cellCard.cardId]: nextStatus,
      },
    }));
    userCardStatusesRef.current = {
      ...userCardStatusesRef.current,
      [cellCard.cardId]: nextStatus,
    };

    const result = await saveNativeChecklistStatus({
      cardId: cellCard.cardId,
      status: nextStatus,
      userId: user.id,
    });

    if (result.error) {
      setMatrixCards(current => current.map(card => (
        card.cardId === cellCard.cardId ? { ...card, status: previousStatus } : card
      )));
      setData(current => ({
        ...current,
        userCardStatuses: {
          ...current.userCardStatuses,
          [cellCard.cardId]: previousStatus,
        },
      }));
      userCardStatusesRef.current = {
        ...userCardStatusesRef.current,
        [cellCard.cardId]: previousStatus,
      };
      setMatrixError(result.error);
    }

    setUpdatingCardIds(current => {
      const next = { ...current };
      delete next[cellCard.cardId];
      return next;
    });
  }, [matrixData, updatingCardIds, user?.id]);

  const filteredSets = useMemo(() => {
    const query = normalizeSearch(setSearch);
    const sortedSets = sortSetsForBrowser(data.sets);

    return sortedSets.filter((set) => {
      const matchesYear = setYearFilter === 'all' || getSetYear(set) === setYearFilter;
      if (!matchesYear) return false;
      if (!query) return true;

      return [set.name, set.brand, set.year, formatReleaseDate(set.releaseDate)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [data.sets, setSearch, setYearFilter]);

  const setYearOptions = useMemo(() => {
    const years = data.sets
      .map(getSetYear)
      .filter((year): year is string => Boolean(year));

    return ['all', ...[...new Set(years)].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))];
  }, [data.sets]);

  if (isLoading) return <LoadingScreen label="Loading sets" />;

  if (selectedSet && selectedSection) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        {isMatrixLoading || !matrixData ? (
          <LoadingScreen label="Loading section" />
        ) : matrixError ? (
          <ScreenState
            actionLabel="Try again"
            message={matrixError}
            onAction={() => loadMatrixCards({ setId: selectedSet.id, subset: selectedSection })}
            title="Section unavailable"
          />
        ) : (
          <SectionChecklistMatrix
            columns={matrixData.columns}
            meta={matrixData.meta}
            onBack={goBackFromMatrix}
            onCellPress={handleMatrixCellPress}
            rows={matrixData.rows}
            sectionName={matrixData.sectionName}
            setName={matrixData.setName}
          />
        )}
      </View>
    );
  }

  if (selectedSet) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ChecklistHome
          isSubsetLoading={isSubsetLoading}
          onBack={goBackToSets}
          onSectionPress={handleSectionPress}
          selectedSet={selectedSet}
          subsetError={subsetError}
          subsets={selectedSubsets}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.red}
            onRefresh={refresh}
          />
        }
      >
        <View style={styles.topBar}>
          <View>
            <Pressable onPress={() => router.back()} style={styles.browserBackButton}>
              <Text style={styles.browserBackText}>{'< Back'}</Text>
            </Pressable>
            <Text style={styles.screenTitle}>Card Sets</Text>
            <Text style={styles.screenSubtitle}>
              Browse UFC card releases and open your checklist.
            </Text>
          </View>
        </View>

        {error ? (
          <ScreenState
            actionLabel="Try again"
            message={error}
            onAction={loadSets}
            title={data.sets.length > 0 ? 'Checklist warning' : 'Sets unavailable'}
          />
        ) : null}

        <SetBrowser
          filteredSets={filteredSets}
          onChangeSearch={setSetSearch}
          onChangeYear={setSetYearFilter}
          onSelectSet={selectSet}
          search={setSearch}
          sets={data.sets}
          year={setYearFilter}
          yearOptions={setYearOptions}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ChecklistHome({
  isSubsetLoading,
  onBack,
  onSectionPress,
  selectedSet,
  subsetError,
  subsets,
}: {
  onBack: () => void;
  onSectionPress: (section: string) => void;
  selectedSet: NativeChecklistSet;
  isSubsetLoading: boolean;
  subsetError: string | null;
  subsets: NativeChecklistSubset[];
}) {
  const [sectionSearch, setSectionSearch] = useState('');
  const visibleSubsets = useMemo(() => {
    const query = normalizeSearch(sectionSearch);
    if (!query) return subsets;

    return subsets.filter((subset) => subset.name.toLowerCase().includes(query));
  }, [sectionSearch, subsets]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.topBar}>
        <View>
          <Pressable onPress={onBack} style={styles.homeBackLink}>
            <Text style={styles.homeBackLinkText}>{'< Back'}</Text>
          </Pressable>
          <Text style={styles.screenTitle}>Checklist</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.homeSetCard}>
          <SetCover imageUrl={selectedSet.imageUrl} size="gallery" />
          <View style={styles.homeSetCardBody}>
            <Text style={styles.homeSetEyebrow}>Selected release</Text>
            <Text numberOfLines={3} style={styles.homeSetTitle}>{selectedSet.name}</Text>
            <Text style={styles.selectedMeta}>{formatFullReleaseDate(selectedSet.releaseDate)}</Text>
          </View>
        </View>

        <View style={styles.finderPanel}>
          <Text style={styles.finderTitle}>Find a fighter</Text>
          <Text style={styles.finderCopy}>
            Choose the checklist section your card belongs to, then scan fighter rows in the matrix.
          </Text>
          <SearchInput
            onChangeText={setSectionSearch}
            placeholder="Search checklist sections"
            value={sectionSearch}
          />
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.kicker}>Checklist Sections</Text>
          {subsets.length > 0 ? (
            <Text style={styles.sectionCount}>{subsets.length} sections</Text>
          ) : null}
        </View>

        {isSubsetLoading ? (
          <EmptyText message="Loading checklist sections..." />
        ) : subsetError ? (
          <EmptyText message={subsetError} />
        ) : subsets.length === 0 ? (
          <EmptyText message="No checklist sections found for this set." />
        ) : visibleSubsets.length === 0 ? (
          <EmptyText message="No sections match this search." />
        ) : (
          <View style={styles.sectionList}>
            {visibleSubsets.map((subset, index) => (
              <View key={subset.name}>
                {index > 0 && <View style={styles.sectionSeparator} />}
                <Pressable
                  onPress={() => onSectionPress(subset.name)}
                  style={styles.sectionRow}
                >
                  <View style={styles.sectionRowCopy}>
                    <Text style={styles.sectionRowText}>{subset.name}</Text>
                    <Text style={styles.sectionRowMeta}>
                      {subset.cardIdentityCount} cards · {subset.variantCount} variants
                    </Text>
                  </View>
                  <View style={styles.openPill}>
                    <Text style={styles.openPillText}>Open</Text>
                    <Text style={styles.openPillArrow}>{'>'}</Text>
                  </View>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function SetBrowser({
  filteredSets,
  onChangeSearch,
  onChangeYear,
  onSelectSet,
  search,
  sets,
  year,
  yearOptions,
}: {
  filteredSets: NativeChecklistSet[];
  onChangeSearch: (value: string) => void;
  onChangeYear: (value: string) => void;
  onSelectSet: (setId: string) => void;
  search: string;
  sets: NativeChecklistSet[];
  year: string;
  yearOptions: string[];
}) {
  return (
    <View style={styles.section}>
      <SearchInput
        onChangeText={onChangeSearch}
        placeholder="Search card sets"
        value={search}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.yearFilterScroll}
      >
        <View style={styles.yearFilterRow}>
          {yearOptions.map((option) => (
            <Pressable
              key={option}
              onPress={() => onChangeYear(option)}
              style={[styles.yearChip, year === option ? styles.yearChipActive : null]}
            >
              <Text style={[styles.yearChipText, year === option ? styles.yearChipTextActive : null]}>
                {option === 'all' ? 'All' : option}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.listHeader}>
        <Text style={styles.kicker}>Releases</Text>
      </View>

      {sets.length === 0 ? (
        <EmptyText message="No sets are available in the native catalog yet." />
      ) : filteredSets.length === 0 ? (
        <EmptyText message="No sets match this search or year." />
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
      <View style={styles.setCardBody}>
        <Text numberOfLines={3} style={styles.setTitle}>
          {set.name}
        </Text>
        <View style={styles.setTitleAccent} />

        <View style={styles.setMetaBlock}>
          <Text numberOfLines={1} style={styles.setMeta}>
            <Text style={styles.setMetaLabel}>Release date: </Text>{formatFullReleaseDate(set.releaseDate)}
          </Text>
        </View>

        <SetCover imageUrl={set.imageUrl} size="gallery" />

        <View style={styles.setActionRow}>
          <View style={styles.setAction}>
            <Text style={styles.setActionText}>Open checklist</Text>
            <Text style={styles.setActionArrow}>{'>'}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SetCover({
  imageUrl,
  size,
}: {
  imageUrl: string | null;
  size: 'gallery' | 'large' | 'small';
}) {
  const [failed, setFailed] = useState(false);
  const style = size === 'large'
    ? styles.setCoverLarge
    : size === 'gallery'
      ? styles.setCoverGallery
      : styles.setCoverSmall;

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
  homeBackLink: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 4,
  },
  homeBackLinkText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  homeSearchWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: '#e5e5e5',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 13,
    paddingHorizontal: 12,
  },
  homeSetCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderTopColor: colors.ink,
    borderTopWidth: 3,
    borderWidth: 1,
    overflow: 'hidden',
  },
  homeSetCardBody: {
    paddingBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 11,
  },
  homeSetEyebrow: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  finderCopy: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
  },
  finderPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftColor: colors.red,
    borderLeftWidth: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  finderTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionList: {
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionCount: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  sectionRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  sectionRowCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  sectionRowMeta: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
    marginTop: 3,
  },
  sectionRowText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  sectionSeparator: {
    backgroundColor: colors.border,
    height: 1,
  },
  openPill: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 4,
    flexDirection: 'row',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 9,
  },
  openPillArrow: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  openPillText: {
    color: colors.textInverse,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  browserBackButton: {
    alignSelf: 'flex-start',
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  browserBackText: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
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
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginBottom: 10,
  },
  helperText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 10,
  },
  homeSetTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.1,
    lineHeight: 22,
    marginTop: 12,
    textTransform: 'uppercase',
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
  selectedMeta: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: 5,
  },
  setAction: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
    paddingHorizontal: 13,
  },
  setActionArrow: {
    color: colors.red,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 16,
  },
  setActionRow: {
    marginTop: 12,
  },
  setActionText: {
    color: colors.ink,
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  setCardBody: {
    flex: 1,
    minWidth: 0,
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
  setCoverGallery: {
    alignSelf: 'stretch',
    aspectRatio: 16 / 9,
    height: undefined,
    width: '100%',
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
  setList: {
    gap: 11,
  },
  setMeta: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  setMetaBlock: {
    gap: 3,
    marginBottom: 12,
  },
  setMetaLabel: {
    color: colors.ink,
    fontWeight: '900',
  },
  setRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderTopColor: colors.red,
    borderTopWidth: 2,
    borderWidth: 1,
    minHeight: 0,
    padding: 12,
  },
  setTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 23,
    textTransform: 'uppercase',
  },
  setTitleAccent: {
    backgroundColor: colors.red,
    height: 2,
    marginBottom: 10,
    marginTop: 8,
    width: 44,
  },
  topBar: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  yearChip: {
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 12,
  },
  yearChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  yearChipText: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  yearChipTextActive: {
    color: colors.textInverse,
  },
  yearFilterRow: {
    flexDirection: 'row',
    gap: 7,
    paddingRight: 16,
  },
  yearFilterScroll: {
    marginTop: 10,
  },
});
