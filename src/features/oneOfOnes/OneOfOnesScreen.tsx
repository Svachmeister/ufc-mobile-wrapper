import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { sharedScreenStyles } from '@/src/components/ui/NativePrimitives';
import { LoadingScreen, ScreenState } from '@/src/components/ui/ScreenState';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { supabase } from '@/src/lib/supabase';
import { colors, radius } from '@/src/lib/theme/tokens';

type OneOfOneCard = {
  card_name: string | null;
  card_number: string | null;
  created_at: string | null;
  fighter_name: string | null;
  first_seen_at: string | null;
  id: string;
  parallel_name: string | null;
  primary_image_url: string | null;
  primary_source_url: string | null;
  set_name: string | null;
  status: 'verified_seen' | 'verified_owned' | string | null;
  verified_at: string | null;
};

type TrackerFilter = 'all' | 'owned' | 'surfaced';

const TRACKER_SELECT = [
  'id',
  'fighter_name',
  'set_name',
  'card_name',
  'card_number',
  'parallel_name',
  'status',
  'primary_image_url',
  'primary_source_url',
  'first_seen_at',
  'verified_at',
  'created_at',
].join(',');

const FILTERS: { key: TrackerFilter; label: string }[] = [
  { key: 'surfaced', label: 'Surfaced' },
  { key: 'owned', label: 'Owned' },
  { key: 'all', label: 'All' },
];

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

function formatCardLine(card: OneOfOneCard) {
  const primary = card.card_name || card.set_name || 'Unknown Card';
  const details = [card.parallel_name, card.card_number ? `#${card.card_number}` : null]
    .filter(Boolean)
    .join(' - ');

  return [primary, details].filter(Boolean).join(' ');
}

function getStatusLabel(status: string | null) {
  if (status === 'verified_owned') return 'OWNED';
  return 'SURFACED';
}

export function OneOfOnesScreen() {
  const { user } = useAuth();
  const [cards, setCards] = useState<OneOfOneCard[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<TrackerFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadCards = useCallback(async () => {
    if (!user?.id) return;

    const { data, error: loadError } = await supabase
      .from('one_of_one_cards')
      .select(TRACKER_SELECT)
      .in('status', ['verified_seen', 'verified_owned'])
      .order('first_seen_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (loadError) {
      setError('Could not load 1-of-1 tracker cards.');
      setCards([]);
      return;
    }

    setError(null);
    setCards(((data ?? []) as unknown) as OneOfOneCard[]);
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
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

  const filteredCards = useMemo(() => {
    if (filter === 'owned') return cards.filter((card) => card.status === 'verified_owned');
    if (filter === 'surfaced') return cards.filter((card) => card.status === 'verified_seen');
    return cards;
  }, [cards, filter]);

  if (isLoading) return <LoadingScreen label="Loading tracker" />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <FlatList
        data={filteredCards}
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
                <Text style={styles.subtitle}>Verified first sightings from the Society</Text>
              </View>
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
              <Text style={styles.emptyTitle}>No verified 1-of-1 cards yet.</Text>
              <Text style={styles.emptyText}>Approved Society sightings will appear here.</Text>
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
}: {
  card: OneOfOneCard;
  hasImageFailed: boolean;
  onImageError: () => void;
}) {
  const showImage = Boolean(card.primary_image_url && !hasImageFailed);
  const isOwned = card.status === 'verified_owned';
  const timeValue = card.first_seen_at || card.verified_at || card.created_at;

  return (
    <View style={styles.card}>
      <View style={styles.imageArea}>
        <View style={styles.badgeRow}>
          <Text style={[styles.statusBadge, isOwned ? styles.statusBadgeOwned : null]}>
            {getStatusLabel(card.status)}
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
            {formatRelativeTime(timeValue)}
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
    </View>
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
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
    gap: 13,
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
  statusBadgeOwned: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
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
