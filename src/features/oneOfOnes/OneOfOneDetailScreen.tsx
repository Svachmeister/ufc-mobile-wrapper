import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { sharedScreenStyles } from '@/src/components/ui/NativePrimitives';
import { LoadingScreen, ScreenState } from '@/src/components/ui/ScreenState';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { supabase } from '@/src/lib/supabase';
import { colors, radius } from '@/src/lib/theme/tokens';

type OneOfOneDetail = {
  card_id: string | null;
  card_name: string | null;
  card_number: string | null;
  created_at: string | null;
  fighter_id: string | null;
  fighter_name: string | null;
  first_seen_at: string | null;
  id: string;
  notes: string | null;
  parallel_name: string | null;
  primary_image_url: string | null;
  primary_source_url: string | null;
  set_id: string | null;
  set_name: string | null;
  status: 'verified_seen' | 'verified_owned' | string | null;
  updated_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
};

const DETAIL_SELECT = [
  'id',
  'card_id',
  'fighter_id',
  'set_id',
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
  'verified_by',
  'notes',
  'created_at',
  'updated_at',
].join(',');

function getStatusLabel(status: string | null) {
  if (status === 'verified_owned') return 'OWNED';
  return 'SURFACED';
}

function formatDisplayDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date
    .toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();
}

function formatCardTitle(card: OneOfOneDetail) {
  return [card.card_name, card.parallel_name].filter(Boolean).join(' - ') || '1-of-1 Card';
}

function getRouteId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export function OneOfOneDetailScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const cardId = getRouteId(params.id);
  const [card, setCard] = useState<OneOfOneDetail | null>(null);
  const [hasImageFailed, setHasImageFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCard = useCallback(async () => {
    if (!user?.id || !cardId) return;

    setError(null);

    const { data, error: loadError } = await supabase
      .from('one_of_one_cards')
      .select(DETAIL_SELECT)
      .eq('id', cardId)
      .in('status', ['verified_seen', 'verified_owned'])
      .maybeSingle();

    if (loadError) {
      setError('Could not load tracker card.');
      setCard(null);
      return;
    }

    setCard((data as OneOfOneDetail | null) ?? null);
    setHasImageFailed(false);
  }, [cardId, user?.id]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      await loadCard();
      if (mounted) setIsLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [loadCard]);

  const refresh = async () => {
    setIsRefreshing(true);
    await loadCard();
    setIsRefreshing(false);
  };

  const openSource = async () => {
    if (!card?.primary_source_url) return;
    await Linking.openURL(card.primary_source_url);
  };

  const seenDate = formatDisplayDate(card?.first_seen_at ?? null);
  const verifiedDate = formatDisplayDate(card?.verified_at ?? null);
  const createdDate = formatDisplayDate(card?.created_at ?? null);
  const detailDate = useMemo(() => {
    if (verifiedDate && seenDate) return `VERIFIED ${verifiedDate} - FIRST SEEN ${seenDate}`;
    if (verifiedDate) return `VERIFIED ${verifiedDate}`;
    if (seenDate) return `FIRST SEEN ${seenDate}`;
    if (createdDate) return `ADDED ${createdDate}`;
    return 'DATE TBA';
  }, [createdDate, seenDate, verifiedDate]);

  if (isLoading) return <LoadingScreen label="Loading tracker card" />;

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ScreenState
          actionLabel="Try again"
          message="Pull to refresh or retry the tracker card."
          onAction={loadCard}
          title="Tracker unavailable"
        />
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ScreenState title="Tracker card not found." />
      </SafeAreaView>
    );
  }

  const showImage = Boolean(card.primary_image_url && !hasImageFailed);
  const isOwned = card.status === 'verified_owned';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={(
          <RefreshControl refreshing={isRefreshing} tintColor={colors.ink} onRefresh={refresh} />
        )}
      >
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
            <Text style={styles.kicker}>1-of-1 Tracker</Text>
            <Text style={styles.title}>Card Detail</Text>
            <Text style={styles.subtitle}>Verified Society sighting</Text>
          </View>
        </View>

        <View style={styles.imageArea}>
          <View style={styles.badgeRow}>
            <Text style={[styles.statusBadge, isOwned ? styles.statusBadgeOwned : null]}>
              {getStatusLabel(card.status)}
            </Text>
            <Text style={styles.oneBadge}>1-of-1</Text>
          </View>
          {showImage ? (
            <Image
              onError={() => setHasImageFailed(true)}
              resizeMode="cover"
              source={{ uri: card.primary_image_url as string }}
              style={styles.cardImage}
            />
          ) : (
            <View style={styles.cardArt}>
              <Text style={styles.cardArtBrand}>FCS</Text>
              <View style={styles.cardArtRule} />
              <MaterialCommunityIcons color={colors.red} name="cards-outline" size={38} />
            </View>
          )}
        </View>

        <View style={styles.detailPanel}>
          <Text style={styles.fighterName}>
            {(card.fighter_name || 'Unknown Fighter').toUpperCase()}
          </Text>
          <Text style={styles.cardTitle}>{formatCardTitle(card).toUpperCase()}</Text>

          <View style={styles.metaGrid}>
            <InfoItem label="Card No." value={card.card_number ? `#${card.card_number}` : 'TBA'} />
            <InfoItem label="Set" value={card.set_name || 'Unknown Set'} />
          </View>

          <Text style={styles.dateText}>{detailDate}</Text>

          {card.primary_source_url ? (
            <Pressable
              onPress={openSource}
              style={({ pressed }) => [styles.sourceButton, pressed ? styles.pressed : null]}
            >
              <View style={styles.sourceButtonCopy}>
                <MaterialCommunityIcons color={colors.textInverse} name="open-in-new" size={17} />
                <Text style={styles.sourceButtonText}>Open Source</Text>
              </View>
              <MaterialCommunityIcons color={colors.textInverse} name="chevron-right" size={18} />
            </Pressable>
          ) : null}
        </View>

        {card.notes ? (
          <View style={styles.notesPanel}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{card.notes}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>
        {value}
      </Text>
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
    left: 12,
    position: 'absolute',
    top: 12,
    zIndex: 2,
  },
  cardArt: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderColor: colors.red,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 138,
    justifyContent: 'center',
    width: 106,
  },
  cardArtBrand: {
    color: colors.textInverse,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  cardArtRule: {
    backgroundColor: colors.red,
    height: 3,
    marginVertical: 10,
    width: 42,
  },
  cardImage: {
    height: '100%',
    width: '100%',
  },
  cardTitle: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
    lineHeight: 19,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  container: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  dateText: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 14,
    textTransform: 'uppercase',
  },
  detailPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderTopColor: colors.red,
    borderTopWidth: 3,
    borderWidth: 1,
    padding: 16,
  },
  fighterName: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 31,
    textTransform: 'uppercase',
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
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 260,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  infoItem: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    minHeight: 68,
    padding: 10,
  },
  infoLabel: {
    color: colors.gray700,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  kicker: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  notesPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 16,
  },
  notesText: {
    color: colors.gray700,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 8,
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
  screenStateWrap: {
    backgroundColor: colors.canvas,
    flex: 1,
    justifyContent: 'center',
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
    gap: 13,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sourceButton: {
    alignItems: 'center',
    backgroundColor: colors.red,
    borderColor: colors.red,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  sourceButtonCopy: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sourceButtonText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
