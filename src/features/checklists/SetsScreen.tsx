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
  loadNativeChecklists,
  loadNativeSetCards,
  loadNativeSetCardsBySubset,
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
  const detailRequestRef = useRef(0);
  const userCardStatusesRef = useRef<Record<string, string | null>>({});
  const [data, setData] = useState<SetsState>(emptyState);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<NativeChecklistCard[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [setSearch, setSetSearch] = useState('');
  const [setYearFilter, setSetYearFilter] = useState('all');
  const [fighterSearch, setFighterSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [matrixCards, setMatrixCards] = useState<NativeChecklistCard[]>([]);
  const [isMatrixLoading, setIsMatrixLoading] = useState(false);

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

  const loadSetCardsPage = useCallback(async ({ setId }: { setId: string }) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;

    setIsDetailLoading(true);
    setDetailError(null);
    setSelectedCards([]);

    const result = await loadNativeSetCards({
      from: 0,
      searchQuery: '',
      setId,
      userCardStatuses: userCardStatusesRef.current,
    });

    if (detailRequestRef.current !== requestId) {
      setIsDetailLoading(false);
      return;
    }

    if (result.error) {
      setDetailError(result.error);
    } else {
      setDetailError(null);
      setSelectedCards(result.cards);
    }

    setIsDetailLoading(false);
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
      setSelectedCards([]);
      setDetailError(null);
      setFighterSearch('');
      return;
    }

    loadSetCardsPage({ setId: selectedSetId });
  }, [loadSetCardsPage, selectedSetId]);

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
    setSelectedCards([]);
    setDetailError(null);
    setSelectedSection(null);
    setMatrixCards([]);
  }, []);

  const loadMatrixCards = useCallback(async ({ setId, subset }: { setId: string; subset: string }) => {
    setIsMatrixLoading(true);
    setMatrixCards([]);

    const result = await loadNativeSetCardsBySubset({
      setId,
      subset,
      userCardStatuses: userCardStatusesRef.current,
    });

    if (!result.error) {
      setMatrixCards(result.cards);
    }
    setIsMatrixLoading(false);
  }, []);

  const handleSectionPress = useCallback((section: string) => {
    if (section !== 'Base Set') return;
    setSelectedSection(section);
  }, []);

  const goBackFromMatrix = useCallback(() => {
    setSelectedSection(null);
    setMatrixCards([]);
  }, []);

  useEffect(() => {
    if (!selectedSetId || !selectedSection) return;
    loadMatrixCards({ setId: selectedSetId, subset: selectedSection });
  }, [loadMatrixCards, selectedSection, selectedSetId]);

  useEffect(() => {
    if (!selectedSection) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBackFromMatrix();
      return true;
    });
    return () => sub.remove();
  }, [goBackFromMatrix, selectedSection]);

  const selectedSet = useMemo(
    () => data.sets.find((set) => set.id === selectedSetId) ?? null,
    [data.sets, selectedSetId],
  );

  const matrixData = useMemo(() => {
    if (!selectedSection || !selectedSet) return null;
    return buildChecklistMatrixData({
      cards: matrixCards,
      sectionName: selectedSection,
      setName: selectedSet.name,
    });
  }, [matrixCards, selectedSection, selectedSet]);

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
        ) : (
          <SectionChecklistMatrix
            columns={matrixData.columns}
            meta={matrixData.meta}
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
          detailError={detailError}
          fighterSearch={fighterSearch}
          isDetailLoading={isDetailLoading}
          onBack={goBackToSets}
          onChangeFighterSearch={setFighterSearch}
          onSectionPress={handleSectionPress}
          selectedCards={selectedCards}
          selectedSet={selectedSet}
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

const CHECKLIST_SECTIONS = ['Base Set', 'Autographs', 'Memorabilia', 'Inserts', 'Parallels / Other'];

function ChecklistHome({
  detailError: _detailError,
  fighterSearch,
  isDetailLoading: _isDetailLoading,
  onBack,
  onChangeFighterSearch,
  onSectionPress,
  selectedCards: _selectedCards,
  selectedSet,
}: {
  detailError: string | null;
  fighterSearch: string;
  isDetailLoading: boolean;
  onBack: () => void;
  onChangeFighterSearch: (value: string) => void;
  onSectionPress: (section: string) => void;
  selectedCards: NativeChecklistCard[];
  selectedSet: NativeChecklistSet;
}) {
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
        <SetCover imageUrl={selectedSet.imageUrl} size="gallery" />

        <Text numberOfLines={3} style={styles.homeSetTitle}>{selectedSet.name}</Text>
        <Text style={styles.selectedMeta}>{formatFullReleaseDate(selectedSet.releaseDate)}</Text>

        <View style={styles.homeSearchWrap}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={onChangeFighterSearch}
            placeholder="Search fighters"
            placeholderTextColor={colors.gray500}
            returnKeyType="search"
            style={styles.searchInput}
            value={fighterSearch}
          />
          {fighterSearch ? (
            <Pressable onPress={() => onChangeFighterSearch('')} style={styles.clearSearchButton}>
              <Text style={styles.clearSearchText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.kicker}>Checklist Sections</Text>
        </View>

        <View style={styles.sectionList}>
          {CHECKLIST_SECTIONS.map((section, index) => (
            <View key={section}>
              {index > 0 && <View style={styles.sectionSeparator} />}
              <Pressable
                onPress={section === 'Base Set' ? () => onSectionPress(section) : undefined}
                style={styles.sectionRow}
              >
                <Text style={styles.sectionRowText}>{section}</Text>
                <Text style={styles.setActionArrow}>{'>'}</Text>
              </Pressable>
            </View>
          ))}
        </View>
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
  sectionList: {
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sectionRowText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionSeparator: {
    backgroundColor: colors.border,
    height: 1,
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
