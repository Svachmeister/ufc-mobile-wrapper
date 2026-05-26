import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ScreenHeader,
  SectionPanel,
  StatTile,
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
        <ScreenHeader
          action={<WebFallbackButton onPress={openWebFallback} />}
          subtitle="Your saved cards, wanted list, and collector progress."
          title="My Collection"
        />

        {error ? (
          <ScreenState
            actionLabel="Try again"
            message="The native collection feed did not load. Pull to refresh or retry."
            onAction={loadCollection}
            title="Collection unavailable"
          />
        ) : null}

        <SectionPanel accent style={styles.hero}>
          <Text style={styles.kicker}>Collector progress</Text>
          <Text style={styles.heroTitle}>
            {hasAnyCards ? 'Your collection is live' : 'Start your collection'}
          </Text>
          <Text style={styles.heroText}>
            Track the cards you own, the ones you are chasing, and the sets you are building.
          </Text>
        </SectionPanel>

        <View style={styles.grid}>
          <StatTile label="Owned" value={String(collection.summary.owned)} />
          <StatTile label="In Collection" value={String(collection.summary.ownedLike)} />
          <StatTile label="Wanted" value={String(collection.summary.wanted)} />
        </View>

        <SectionPanel style={styles.panel}>
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
            <Text style={styles.panelText}>Cards you add to your collection will appear here.</Text>
          )}
        </SectionPanel>

        <SectionPanel style={styles.panel}>
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
            <Text style={styles.panelText}>Your wanted list is clear. Mark cards as wanted when you are ready to chase them.</Text>
          )}
        </SectionPanel>

        <SectionPanel style={styles.utilityPanel} variant="muted">
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
        </SectionPanel>
      </ScrollView>
    </SafeAreaView>
  );
}

function CollectionCardRow({ card }: { card: NativeCollectionCard }) {
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
      <Text style={[styles.statusBadge, getStatusBadgeStyle(card.status)]}>
        {formatStatus(card.status)}
      </Text>
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
    gap: 8,
    marginTop: 14,
  },
  cardRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  cardTitle: {
    color: colors.ink,
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
    color: colors.gray700,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  hero: {
    padding: 18,
  },
  heroText: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  heroTitle: {
    color: colors.ink,
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
  panel: {
    padding: 16,
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
    fontSize: 19,
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
    paddingHorizontal: 8,
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
    padding: 14,
  },
});
