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
  if (!status) return 'No status';
  return status.replace(/_/g, ' ');
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
      <StatusBar style="light" />
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
          title="Collection"
        />

        {error ? (
          <ScreenState
            actionLabel="Try again"
            message="The native collection feed did not load. Pull to refresh or retry."
            onAction={loadCollection}
            title="Collection unavailable"
          />
        ) : null}

        <View style={styles.hero}>
          <Text style={styles.kicker}>My cards</Text>
          <Text style={styles.heroTitle}>
            {hasAnyCards ? 'Your collection is live' : 'Start your collection'}
          </Text>
          <Text style={styles.heroText}>
            This native view is read-only for Milestone 3. Card status editing and checklist toggles stay in the web experience for now.
          </Text>
        </View>

        <View style={styles.grid}>
          <StatTile label="Owned" value={String(collection.summary.owned)} />
          <StatTile label="Owned-like" value={String(collection.summary.ownedLike)} />
          <StatTile label="Wanted" value={String(collection.summary.wanted)} />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.kicker}>Owned cards</Text>
            <Text style={styles.countBadge}>{ownedCards.length} shown</Text>
          </View>

          {ownedCards.length > 0 ? (
            <View style={styles.cardList}>
              {ownedCards.map((card) => (
                <CollectionCardRow key={card.id} card={card} />
              ))}
            </View>
          ) : (
            <Text style={styles.panelText}>No owned cards found yet.</Text>
          )}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.kicker}>Wanted cards</Text>
            <Text style={styles.countBadge}>{wantedCards.length} shown</Text>
          </View>

          {wantedCards.length > 0 ? (
            <View style={styles.cardList}>
              {wantedCards.map((card) => (
                <CollectionCardRow key={card.id} card={card} />
              ))}
            </View>
          ) : (
            <Text style={styles.panelText}>Your wanted list is empty in the native preview.</Text>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.kicker}>Checklists</Text>
          <Text style={styles.sectionTitle}>Browsing coming next</Text>
          <Text style={styles.panelText}>
            The next native collection milestone can add set browsing and checklist detail screens. This pass only reads your current card rows.
          </Text>
          <WebFallbackButton
            label="Open WebView fallback"
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
      <Text style={styles.statusBadge}>{formatStatus(card.status)}</Text>
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
    marginTop: 14,
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48,
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
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.1,
    lineHeight: 24,
    marginTop: 8,
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
});
