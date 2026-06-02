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

import {
  WebFallbackButton,
  sharedScreenStyles,
} from '@/src/components/ui/NativePrimitives';
import { LoadingScreen, ScreenState } from '@/src/components/ui/ScreenState';
import { useAuth } from '@/src/features/auth/AuthProvider';
import {
  type NativeCollectionCard,
  type NativeCollectionSummary,
  OWNED_LIKE_STATUSES,
  loadNativeCollection,
} from '@/src/lib/collection';
import { colors } from '@/src/lib/theme/tokens';

type CollectionState = {
  cards: NativeCollectionCard[];
  summary: NativeCollectionSummary;
};

const emptySummary = {
  owned: 0,
  ownedLike: 0,
  wanted: 0,
};

function formatStatus(status: string | null) {
  if (status === 'owned') return 'Owned';
  if (status === 'for_sale') return 'For Sale';
  if (status === 'for_trade') return 'For Trade';
  if (status === 'not_for_sale') return 'Not For Sale';
  if (status === 'not_for_trade') return 'Not For Trade';
  if (status === 'wanted') return 'Wanted';
  if (!status) return 'Missing';
  return status.replace(/_/g, ' ');
}

function getStatusBadgeStyle(status: string | null) {
  if (status === 'wanted') return styles.statusWanted;
  if (status === 'owned') return styles.statusOwned;
  if (status === 'for_sale' || status === 'for_trade') return styles.statusMarket;
  if (status === 'not_for_sale' || status === 'not_for_trade') return styles.statusLocked;
  return styles.statusMissing;
}

function getCardDetailParts(detail: string) {
  const parts = detail.split(' - ').map((part) => part.trim()).filter(Boolean);
  const setName = parts[0] ?? 'Set details pending';
  const cardNumber = parts.find((part) => part.startsWith('#')) ?? null;
  const parallel = parts.find((part) => !part.startsWith('#') && part !== setName) ?? null;

  return { cardNumber, parallel, setName };
}

export function CollectionScreen() {
  const { user } = useAuth();
  const [collection, setCollection] = useState<CollectionState>({
    cards: [],
    summary: emptySummary,
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadCollection = useCallback(async () => {
    if (!user?.id) return;

    const result = await loadNativeCollection(user.id);
    setError(result.error);
    setCollection({
      cards: result.cards,
      summary: result.summary,
    });
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      await loadCollection();
      if (mounted) setIsLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [loadCollection]);

  const refresh = async () => {
    setIsRefreshing(true);
    await loadCollection();
    setIsRefreshing(false);
  };

  const openWebFallback = () => {
    router.push('/web-fallback' as never);
  };

  const ownedCards = useMemo(
    () => collection.cards.filter((card) => card.status && OWNED_LIKE_STATUSES.has(card.status)).slice(0, 6),
    [collection.cards],
  );
  const wantedCards = useMemo(
    () => collection.cards.filter((card) => card.status === 'wanted').slice(0, 5),
    [collection.cards],
  );
  const uniqueFighterCount = useMemo(
    () => new Set(collection.cards.map((card) => card.fighterName).filter(Boolean)).size,
    [collection.cards],
  );
  const hasAnyCards = collection.cards.length > 0;

  if (isLoading) return <LoadingScreen label="Loading collection" />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
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
          <View style={styles.headerText}>
            <Text style={styles.title}>My Collection</Text>
            <Text style={styles.subtitle}>Inventory, chase list, and set progress.</Text>
          </View>
          <Pressable onPress={openWebFallback} style={styles.webButton}>
            <Text style={styles.webButtonText}>Web</Text>
          </Pressable>
        </View>

        {error ? (
          <ScreenState
            actionLabel="Try again"
            message="The native collection feed did not load. Pull to refresh or retry."
            onAction={loadCollection}
            title="Collection unavailable"
          />
        ) : null}

        <View style={styles.summaryPanel}>
          <View>
            <Text style={styles.kicker}>Collector inventory</Text>
            <Text style={styles.summaryTitle}>
              {hasAnyCards ? 'Your cards, organized.' : 'Start building your binder.'}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <InventoryStat label="Owned" value={String(collection.summary.owned)} />
            <InventoryStat label="Wanted" value={String(collection.summary.wanted)} />
            <InventoryStat label="Fighters" value={String(uniqueFighterCount)} />
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.kicker}>Collection Highlights</Text>
              <Text style={styles.sectionTitle}>In your binder</Text>
            </View>
            <Text style={styles.countBadge}>{ownedCards.length} shown</Text>
          </View>

          {ownedCards.length > 0 ? (
            <View style={styles.cardList}>
              {ownedCards.map((card) => (
                <CollectionCardRow key={card.id} card={card} />
              ))}
            </View>
          ) : (
            <InventoryEmptyText message="Cards marked Owned from set checklists will appear here." />
          )}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.kicker}>Wanted List</Text>
              <Text style={styles.sectionTitle}>Cards to chase</Text>
            </View>
            <Text style={styles.countBadge}>{wantedCards.length} shown</Text>
          </View>

          {wantedCards.length > 0 ? (
            <View style={styles.cardList}>
              {wantedCards.map((card) => (
                <CollectionCardRow key={card.id} card={card} />
              ))}
            </View>
          ) : (
            <InventoryEmptyText message="Mark cards as Wanted from checklists to build your chase list." />
          )}
        </View>

        <View style={styles.utilityPanel}>
          <Text style={styles.kicker}>Collection Tools</Text>
          <Text style={styles.sectionTitle}>Need full checklist controls?</Text>
          <Text style={styles.panelText}>
            Open the complete web tools when you need the full checklist workflow.
          </Text>
          <WebFallbackButton
            label="Open Web Tools"
            onPress={openWebFallback}
            style={styles.secondaryButton}
            textStyle={styles.secondaryButtonText}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CollectionCardRow({ card }: { card: NativeCollectionCard }) {
  const { cardNumber, parallel, setName } = getCardDetailParts(card.detail);
  const isWanted = card.status === 'wanted';

  return (
    <View style={[styles.cardRow, isWanted ? styles.cardRowWanted : null]}>
      <View style={[styles.cardNumberChip, isWanted ? styles.cardNumberChipWanted : null]}>
        <Text numberOfLines={1} style={[styles.cardNumberText, isWanted ? styles.cardNumberTextWanted : null]}>
          {cardNumber ?? 'FCS'}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {card.fighterName}
        </Text>
        <Text numberOfLines={1} style={styles.cardDetail}>
          {setName}
        </Text>
        {parallel ? <Text numberOfLines={1} style={styles.cardParallel}>{parallel}</Text> : null}
      </View>
      <Text style={[styles.statusBadge, getStatusBadgeStyle(card.status)]}>
        {formatStatus(card.status)}
      </Text>
    </View>
  );
}

function InventoryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.inventoryStat}>
      <Text style={styles.inventoryStatValue}>{value}</Text>
      <Text style={styles.inventoryStatLabel}>{label}</Text>
    </View>
  );
}

function InventoryEmptyText({ message }: { message: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardDetail: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 4,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardList: {
    gap: 9,
    marginTop: 13,
  },
  cardNumberChip: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 5,
    width: 52,
  },
  cardNumberChipWanted: {
    backgroundColor: colors.surface,
    borderColor: colors.red,
  },
  cardNumberText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.25,
    textAlign: 'center',
  },
  cardNumberTextWanted: {
    color: colors.red,
  },
  cardParallel: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginTop: 3,
  },
  cardRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 72,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  cardRowWanted: {
    borderColor: 'rgba(225, 6, 0, 0.35)',
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  container: {
    backgroundColor: '#fbfaf7',
    flex: 1,
  },
  countBadge: {
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.gray700,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  emptyBox: {
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  emptyText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 14,
  },
  inventoryStat: {
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  inventoryStatLabel: {
    color: colors.textSoft,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  inventoryStatValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  kicker: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    padding: 14,
  },
  panelHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  panelText: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
    backgroundColor: '#fbfaf7',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.1,
    lineHeight: 23,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  statusBadge: {
    alignSelf: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.gray700,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  statusLocked: {
    borderColor: colors.border,
    color: colors.gray500,
  },
  statusMarket: {
    borderColor: colors.red,
    color: colors.red,
  },
  statusMissing: {
    borderColor: colors.border,
    color: colors.gray500,
  },
  statusOwned: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    color: colors.textInverse,
  },
  statusWanted: {
    borderColor: colors.red,
    color: colors.red,
  },
  utilityPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    padding: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  subtitle: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 6,
  },
  summaryPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderTopColor: colors.red,
    borderTopWidth: 3,
    borderWidth: 1,
    padding: 14,
  },
  summaryTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
    lineHeight: 25,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  webButton: {
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  webButtonText: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
});
