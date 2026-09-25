import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, Screen, Text } from '@/components/ui';
import { borderWidths, colors, radius, spacing } from '@/theme/tokens';
import { groupChecklistRows, type ChecklistCard } from '@/lib/cards/cardGrouping';
import { useSet, useSetChecklist, useSetSubsets } from '@/lib/cards/queries';
import { useMyCardStatuses, type MyCardStatusMap } from '@/lib/cards/userCardStatuses';
import { ParallelChip, RcTag } from './ParallelChip';

const BACK_TARGET = 44;
const BACK_ICON_SIZE = 24;

export function SetChecklistScreen({ setId }: { setId: string }) {
  const router = useRouter();
  const setQuery = useSet(setId);
  const subsetsQuery = useSetSubsets(setId);
  const [selectedSubset, setSelectedSubset] = useState<string | null>(null);

  const subsets = subsetsQuery.data ?? [];

  useEffect(() => {
    if (subsets.length > 0 && (!selectedSubset || !subsets.includes(selectedSubset))) {
      setSelectedSubset(subsets[0]);
    }
  }, [subsets, selectedSubset]);

  function back() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/cards');
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={BACK_ICON_SIZE} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text variant="heading" numberOfLines={1}>
            {setQuery.data?.name ?? ' '}
          </Text>
          {setQuery.data ? (
            <Text variant="label" color="textSecondary">
              {setQuery.data.year} · {setQuery.data.manufacturer}
            </Text>
          ) : null}
        </View>
      </View>

      {subsetsQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandRed} />
        </View>
      ) : subsetsQuery.isError ? (
        <View style={styles.centered}>
          <Text variant="body" style={styles.errorText}>
            Could not load this set.
          </Text>
          <Button
            variant="outline"
            label="Try again"
            onPress={() => subsetsQuery.refetch()}
            style={styles.retryButton}
          />
        </View>
      ) : subsets.length === 0 ? (
        <View style={styles.centered}>
          <Text variant="body">No cards in this subset.</Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRow}
            contentContainerStyle={styles.chipRowContent}
          >
            {subsets.map((subset) => {
              const active = subset === selectedSubset;
              return (
                <Pressable
                  key={subset}
                  onPress={() => setSelectedSubset(subset)}
                  style={[styles.subsetChip, active && styles.subsetChipActive]}
                >
                  <Text variant="label" color={active ? 'surface' : 'textPrimary'}>
                    {subset}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedSubset ? (
            <ChecklistList
              setId={setId}
              subset={selectedSubset}
              onSelectCard={(cardId) => router.push(`/(tabs)/cards/${setId}/${cardId}`)}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function ChecklistList({
  setId,
  subset,
  onSelectCard,
}: {
  setId: string;
  subset: string;
  onSelectCard: (cardId: string) => void;
}) {
  const checklist = useSetChecklist(setId, subset);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = checklist;
  const statuses = useMyCardStatuses().data;

  // Pages of 1000 load and render as they arrive rather than waiting for the
  // whole subset, so this keeps pulling the next page in the background
  // until the subset is exhausted.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const rows = useMemo(() => checklist.data?.pages.flatMap((page) => page) ?? [], [checklist.data]);
  const cards = useMemo(() => groupChecklistRows(rows), [rows]);

  if (checklist.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brandRed} />
      </View>
    );
  }

  if (checklist.isError) {
    return (
      <View style={styles.centered}>
        <Text variant="body" style={styles.errorText}>
          Could not load this subset.
        </Text>
        <Button variant="outline" label="Try again" onPress={() => checklist.refetch()} style={styles.retryButton} />
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={styles.centered}>
        <Text variant="body">No cards in this subset.</Text>
      </View>
    );
  }

  return (
    <FlashList
      data={cards}
      keyExtractor={(card) => card.card_number}
      renderItem={({ item }) => (
        <ChecklistCardRow card={item} statuses={statuses} onPress={() => onSelectCard(item.parallels[0].id)} />
      )}
      contentContainerStyle={styles.listContent}
    />
  );
}

function ChecklistCardRow({
  card,
  statuses,
  onPress,
}: {
  card: ChecklistCard;
  statuses: MyCardStatusMap | undefined;
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
        <View style={styles.chipsRow}>
          {card.parallels.map((parallel) => (
            <ParallelChip key={parallel.id} parallel={parallel} status={statuses?.[parallel.id]} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
    paddingTop: spacing.sm,
  },
  back: {
    width: BACK_TARGET,
    height: BACK_TARGET,
    marginLeft: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    alignSelf: 'center',
  },
  chipRow: {
    flexGrow: 0,
    borderBottomWidth: borderWidths.structural,
    borderBottomColor: colors.border,
  },
  chipRowContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  subsetChip: {
    borderWidth: borderWidths.structural,
    borderColor: colors.textPrimary,
    borderRadius: radius.none,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  subsetChipActive: {
    backgroundColor: colors.textPrimary,
  },
  listContent: {
    paddingBottom: spacing.xxl,
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
