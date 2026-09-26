import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import { Button, Screen, SegmentedControl, Text } from '@/components/ui';
import { borderWidths, colors, spacing } from '@/theme/tokens';
import { buildCollectionSections, computeCollectionStats, useMyMarkedCards } from '@/lib/cards/collectionQueries';
import type { CollectionCardGroupRow } from '@/lib/cards/cardGrouping';
import type { CardStatus } from '@/lib/cards/userCardStatuses';
import { ParallelLine, RcTag } from '@/features/cards/ParallelLine';

type ListItem =
  | { kind: 'setHeading'; key: string; setName: string; count: number }
  | { kind: 'card'; key: string; card: CollectionCardGroupRow };

// Text.tsx's "label" variant uppercases via CSS, so mixed-case source text is
// fine and matches how the rest of the app writes these strings.
const SEGMENT_LABEL: Record<CardStatus, string> = {
  owned: 'Owned',
  wanted: 'Wanted',
};

export function CollectionScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<CardStatus>('owned');
  const query = useMyMarkedCards();

  const rows = query.data ?? [];
  const stats = computeCollectionStats(rows);
  const sections = buildCollectionSections(rows, segment);

  const items: ListItem[] = sections.flatMap((section) => {
    const count = section.cards.reduce((sum, card) => sum + card.parallels.length, 0);
    return [
      { kind: 'setHeading' as const, key: `heading-${section.set_id}`, setName: section.set_name, count },
      ...section.cards.map((card) => ({
        kind: 'card' as const,
        key: `${section.set_id}-${card.subset}-${card.card_number}`,
        card,
      })),
    ];
  });

  function openCard(cardId: string) {
    router.push(`/(tabs)/collection/${cardId}`);
  }

  return (
    <Screen>
      <View style={styles.statsRow}>
        <StatBlock value={stats.cards} label="Cards" />
        <StatBlock value={stats.sets} label="Sets" />
        <StatBlock value={stats.oneOfOnes} label="1/1s" />
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedControl
          value={segment}
          onChange={setSegment}
          options={[
            { value: 'owned', label: 'My Cards' },
            { value: 'wanted', label: 'Wantlist' },
          ]}
        />
      </View>

      {query.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandRed} />
        </View>
      ) : query.isError ? (
        <View style={styles.centered}>
          <Text variant="body" style={styles.errorText}>
            Could not load your collection.
          </Text>
          <Button variant="outline" label="Try again" onPress={() => query.refetch()} style={styles.retryButton} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text variant="body" style={styles.centeredText}>
            {segment === 'owned'
              ? 'No cards yet. Open any card and tap OWNED.'
              : 'Your wantlist is empty. Open any card and tap WANTED.'}
          </Text>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) =>
            item.kind === 'setHeading' ? (
              <SetHeadingRow setName={item.setName} count={item.count} segment={segment} />
            ) : (
              <CollectionCardRowItem
                card={item.card}
                segment={segment}
                onPress={() => openCard(item.card.parallels[0].id)}
              />
            )
          }
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          contentContainerStyle={styles.listContent}
        />
      )}
    </Screen>
  );
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statBlock}>
      <Text variant="numeric">{value}</Text>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

function SetHeadingRow({ setName, count, segment }: { setName: string; count: number; segment: CardStatus }) {
  return (
    <View style={styles.setHeadingRow}>
      <Text variant="label" color="textSecondary" numberOfLines={1} style={styles.setHeadingName}>
        {setName}
      </Text>
      <Text variant="label" color="textSecondary">
        {count} {SEGMENT_LABEL[segment]}
      </Text>
    </View>
  );
}

function CollectionCardRowItem({
  card,
  segment,
  onPress,
}: {
  card: CollectionCardGroupRow;
  segment: CardStatus;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.cardRow}>
      <Text variant="heading" style={styles.cardNumber} numberOfLines={1}>
        {card.card_number}
      </Text>
      <View style={styles.cardMain}>
        <View style={styles.cardTitleRow}>
          <Text variant="heading" numberOfLines={1} style={styles.cardFighter}>
            {card.fighter_name}
          </Text>
          {card.is_rookie ? <RcTag /> : null}
        </View>
        <Text variant="label" color="textSecondary" numberOfLines={1}>
          {card.subset}
        </Text>
        {/* Every parallel here already belongs to the selected segment —
            buildCollectionSections filtered by status before grouping — so
            each item's status is just the segment itself, not a per-parallel lookup. */}
        <ParallelLine parallels={card.parallels} statusFor={() => segment} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xl,
  },
  statBlock: {
    gap: spacing.xs,
  },
  segmentWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  centeredText: {
    textAlign: 'center',
  },
  errorText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    alignSelf: 'center',
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  setHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  setHeadingName: {
    flexShrink: 1,
  },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: borderWidths.structural,
    borderBottomColor: colors.border,
  },
  cardNumber: {
    width: 44,
  },
  cardMain: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardFighter: {
    flexShrink: 1,
  },
});
