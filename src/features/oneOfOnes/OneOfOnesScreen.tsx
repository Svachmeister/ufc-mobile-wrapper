import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
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
import { colors, radius } from '@/src/lib/theme/tokens';
import { buildWebApiUrl } from '@/src/lib/webApi';

type TrackerStatus = 'pulled' | 'not_seen';

type OneOfOneTrackerRow = {
  candidate_card_id: string;
  card_name: string | null;
  card_number: string | null;
  fighter_name: string | null;
  first_seen_at: string | null;
  id: string;
  print_run: string | number | null;
  primary_image_url: string | null;
  primary_source_url: string | null;
  set_name: string | null;
  subset: string | null;
  tracker_card_id: string | null;
  tracker_status: TrackerStatus;
  variation: string | null;
  verified_at: string | null;
};

type TrackerFeedResponse = {
  rows?: OneOfOneTrackerRow[];
  totalLoaded?: number;
};

type TrackerFilter = 'all' | 'pulled' | 'not_seen';

const FILTERS: { key: TrackerFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pulled', label: 'Pulled' },
  { key: 'not_seen', label: 'Not Seen' },
];

const TRACKER_LIMIT = '100';

function getStatusLabel(status: TrackerStatus) {
  return status === 'not_seen' ? 'NOT SEEN' : 'PULLED';
}

function getStatusHelper(status: TrackerStatus) {
  return status === 'not_seen' ? 'No verified pull yet.' : null;
}

function formatRelativeTime(value: string | null) {
  if (!value) return 'RECENT';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'RECENT';

  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));

  if (diffMinutes < 1) return 'JUST NOW';
  if (diffMinutes < 60) return `${diffMinutes} MIN AGO`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} HOURS AGO`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} DAYS AGO`;
}

function formatCardLine(card: OneOfOneTrackerRow) {
  const primary = card.card_name || card.set_name || 'Unknown Card';
  const details = [card.variation, card.card_number ? `#${card.card_number}` : null]
    .filter(Boolean)
    .join(' - ');

  return [primary, details].filter(Boolean).join(' ');
}

export function OneOfOnesScreen() {
  const { session, user } = useAuth();
  const [cards, setCards] = useState<OneOfOneTrackerRow[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<TrackerFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loadedCount, setLoadedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const loadCards = useCallback(async () => {
    if (!user?.id) return;

    const accessToken = session?.access_token;
    if (!accessToken) {
      setError('Sign in again to load the 1-of-1 tracker.');
      setCards([]);
      setLoadedCount(0);
      return;
    }

    const url = buildWebApiUrl('/api/one-of-one-tracker', {
      limit: TRACKER_LIMIT,
      status: filter,
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
    });

    if (!url) {
      setError('Tracker API is not configured for this native build.');
      setCards([]);
      setLoadedCount(0);
      return;
    }

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        setError('Could not load 1-of-1 tracker cards.');
        setCards([]);
        setLoadedCount(0);
        return;
      }

      const payload = (await response.json()) as TrackerFeedResponse;
      const rows = Array.isArray(payload.rows) ? payload.rows : [];

      setError(null);
      setCards(rows);
      setLoadedCount(typeof payload.totalLoaded === 'number' ? payload.totalLoaded : rows.length);
    } catch {
      setError('Could not load 1-of-1 tracker cards.');
      setCards([]);
      setLoadedCount(0);
    }
  }, [debouncedSearch, filter, session?.access_token, user?.id]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setIsLoading(true);
      await loadCards();
      if (mounted) setIsLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [loadCards]);

  const refresh = async () => {
    setIsRefreshing(true);
    await loadCards();
    setIsRefreshing(false);
  };

  const openReportForm = () => {
    router.push('/report-one-of-one' as never);
  };

  const openCardDetail = (id: string) => {
    router.push(`/one-of-ones/${id}` as never);
  };

  const hasCards = cards.length > 0;
  const hasSearchOrFilter = Boolean(search.trim()) || filter !== 'all';

  if (isLoading) return <LoadingScreen label="Loading tracker" />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <FlatList
        data={cards}
        keyExtractor={(card) => card.id}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.ink}
            onRefresh={refresh}
          />
        }
        ListHeaderComponent={(
          <>
            <View style={styles.header}>
              <Pressable
                accessibilityLabel="Back"
                hitSlop={10}
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
              >
                <MaterialCommunityIcons color={colors.ink} name="chevron-left" size={24} />
              </Pressable>
              <View style={styles.headerCopy}>
                <Text style={styles.kicker}>Fight Card Society</Text>
                <Text style={styles.title}>1-of-1 Tracker</Text>
                <Text style={styles.subtitle}>
                  Verified 1-of-1 cards that have been pulled or publicly reported.
                </Text>
              </View>
            </View>

            <View style={styles.searchWrap}>
              <MaterialCommunityIcons color={colors.gray700} name="magnify" size={19} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setSearch}
                placeholder="Search fighter, set, card, number"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                value={search}
              />
              {search ? (
                <Pressable
                  accessibilityLabel="Clear search"
                  hitSlop={8}
                  onPress={() => setSearch('')}
                  style={({ pressed }) => [styles.clearSearchButton, pressed ? styles.pressed : null]}
                >
                  <MaterialCommunityIcons color={colors.ink} name="close" size={17} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.filterRow}>
              {FILTERS.map((item) => {
                const isActive = filter === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setFilter(item.key)}
                    style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                  >
                    <Text style={[styles.filterChipText, isActive ? styles.filterChipTextActive : null]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {hasCards ? (
              <Text style={styles.resultCount}>
                Showing {loadedCount} tracker cards
              </Text>
            ) : null}

            <Pressable
              onPress={openReportForm}
              style={({ pressed }) => [styles.reportButton, pressed ? styles.pressed : null]}
            >
              <View style={styles.reportButtonCopy}>
                <MaterialCommunityIcons color={colors.textInverse} name="plus-box-outline" size={18} />
                <Text style={styles.reportButtonText}>Report 1-of-1</Text>
              </View>
              <MaterialCommunityIcons color={colors.textInverse} name="chevron-right" size={18} />
            </Pressable>

            {error ? (
              <ScreenState
                actionLabel="Try again"
                message="Pull to refresh or retry the tracker feed."
                onAction={loadCards}
                title="Tracker unavailable"
              />
            ) : null}
          </>
        )}
        ListEmptyComponent={(
          !error ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>
                {hasSearchOrFilter
                  ? 'No tracker cards match this search.'
                  : 'No tracker cards loaded yet.'}
              </Text>
              <Text style={styles.emptyText}>Pulled and Not Seen tracker candidates will appear here.</Text>
            </View>
          ) : null
        )}
        renderItem={({ item }) => (
          <TrackerCard
            card={item}
            hasImageFailed={failedImages.has(item.id)}
            onImageError={() => {
              setFailedImages((current) => {
                const next = new Set(current);
                next.add(item.id);
                return next;
              });
            }}
            onPress={
              item.tracker_status === 'pulled' && item.tracker_card_id
                ? () => openCardDetail(item.tracker_card_id as string)
                : undefined
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

function TrackerCard({
  card,
  hasImageFailed,
  onImageError,
  onPress,
}: {
  card: OneOfOneTrackerRow;
  hasImageFailed: boolean;
  onImageError: () => void;
  onPress?: () => void;
}) {
  const showImage = Boolean(card.primary_image_url && !hasImageFailed);
  const timeValue = card.first_seen_at || card.verified_at;
  const statusHelper = getStatusHelper(card.tracker_status);

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        card.tracker_status === 'not_seen' ? styles.notSeenCard : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.imageArea}>
        <View style={styles.badgeRow}>
          <Text style={[
            styles.statusBadge,
            card.tracker_status === 'not_seen' ? styles.notSeenStatusBadge : null,
          ]}>
            {getStatusLabel(card.tracker_status)}
          </Text>
          <Text style={styles.oneBadge}>1-of-1</Text>
        </View>
        {showImage ? (
          <Image
            onError={onImageError}
            resizeMode="cover"
            source={{ uri: card.primary_image_url as string }}
            style={styles.cardImage}
          />
        ) : (
          <View style={styles.cardArt}>
            <Text style={styles.cardArtBrand}>FCS</Text>
            <View style={styles.cardArtRule} />
            <MaterialCommunityIcons color={colors.red} name="cards-outline" size={30} />
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTopLine}>
          <Text numberOfLines={1} style={styles.timeText}>
            {statusHelper || formatRelativeTime(timeValue)}
          </Text>
        </View>
        <Text numberOfLines={2} style={styles.fighterName}>
          {(card.fighter_name || 'Unknown Fighter').toUpperCase()}
        </Text>
        <Text numberOfLines={2} style={styles.cardName}>
          {formatCardLine(card).toUpperCase()}
        </Text>
        {card.set_name ? (
          <Text numberOfLines={1} style={styles.setName}>
            {card.set_name}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 5,
    left: 10,
    position: 'absolute',
    top: 10,
    zIndex: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderTopColor: colors.ink,
    borderTopWidth: 3,
    borderWidth: 1,
    overflow: 'hidden',
  },
  notSeenCard: {
    borderTopColor: colors.border,
  },
  cardArt: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderColor: colors.red,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 112,
    justifyContent: 'center',
    width: 86,
  },
  cardArtBrand: {
    color: colors.textInverse,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  cardArtRule: {
    backgroundColor: colors.red,
    height: 3,
    marginVertical: 8,
    width: 34,
  },
  cardBody: {
    padding: 14,
  },
  cardImage: {
    height: '100%',
    width: '100%',
  },
  cardName: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
    lineHeight: 16,
    marginTop: 7,
    textTransform: 'uppercase',
  },
  cardTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clearSearchButton: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  container: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  emptyText: {
    color: colors.gray700,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 6,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
    textTransform: 'uppercase',
  },
  emptyWrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopColor: colors.red,
    borderTopWidth: 3,
    borderWidth: 1,
    padding: 18,
  },
  fighterName: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
    lineHeight: 25,
    marginTop: 7,
    textTransform: 'uppercase',
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  filterChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  filterChipText: {
    color: colors.gray700,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  header: {
    alignItems: 'flex-start',
    borderBottomColor: colors.ink,
    borderBottomWidth: 2,
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  imageArea: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    height: 190,
    justifyContent: 'center',
  },
  kicker: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  oneBadge: {
    backgroundColor: colors.surface,
    borderColor: colors.red,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.red,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 3,
    textTransform: 'uppercase',
  },
  notSeenStatusBadge: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    color: colors.ink,
  },
  pressed: {
    opacity: 0.65,
  },
  reportButton: {
    alignItems: 'center',
    backgroundColor: colors.red,
    borderColor: colors.red,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: 13,
  },
  reportButtonCopy: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  reportButtonText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  resultCount: {
    color: colors.gray700,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: -5,
    textTransform: 'uppercase',
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
    gap: 13,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    minHeight: 44,
    padding: 0,
  },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  separator: {
    height: 12,
  },
  setName: {
    color: colors.gray500,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginTop: 9,
  },
  statusBadge: {
    backgroundColor: colors.red,
    borderColor: colors.red,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.textInverse,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 3,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.gray700,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 5,
  },
  timeText: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 31,
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
