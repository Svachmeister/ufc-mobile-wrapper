import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, FormIndicator, Screen, Text } from '@/components/ui';
import { borderWidths, colors, spacing, typography } from '@/theme/tokens';
import {
  ageFromDateOfBirth,
  fighterInitials,
  formatRecord,
  formatText,
  MISSING,
} from '@/lib/fantasy/pickDisplay';
import { buildFighterCardSections, useFighterCards, useFighterDetail, type FighterDetailRow } from '@/lib/cards/fighterQueries';
import type { FighterCardGroupRow } from '@/lib/cards/cardGrouping';
import { useMyCardStatuses, type MyCardStatusMap } from '@/lib/cards/userCardStatuses';
import { ParallelChip, RcTag } from './ParallelChip';

const BACK_TARGET = 44;
const BACK_ICON_SIZE = 24;
// Same fixed photo height as the picks flow's fighter tiles, so a fighter
// looks the same whichever screen you meet them on.
const PHOTO_HEIGHT = 160;

type ListItem =
  | { kind: 'setHeading'; key: string; setName: string }
  | { kind: 'card'; key: string; setId: string; card: FighterCardGroupRow };

export function FighterDetailScreen({ fighterId }: { fighterId: string }) {
  const router = useRouter();
  const detailQuery = useFighterDetail(fighterId);

  function back() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/cards');
    }
  }

  if (detailQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandRed} />
        </View>
      </Screen>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text variant="body" style={styles.centeredText}>
            Could not load this fighter.
          </Text>
          <Button variant="outline" label="Try again" onPress={() => detailQuery.refetch()} style={styles.retryButton} />
        </View>
      </Screen>
    );
  }

  return <FighterDetailBody fighter={detailQuery.data} onBack={back} />;
}

function FighterDetailBody({ fighter, onBack }: { fighter: FighterDetailRow; onBack: () => void }) {
  const router = useRouter();
  const displayName = fighter.name?.trim() || 'Unknown fighter';
  const [nowMs] = useState(() => Date.now());
  const age = ageFromDateOfBirth(fighter.date_of_birth, nowMs);

  const cardsQuery = useFighterCards(fighter.id);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = cardsQuery;
  const statuses = useMyCardStatuses().data;

  // Pages of 1000 load in the background and the list grows as they arrive,
  // same pattern as M3-A's set checklist.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { sections, total } = useMemo(() => buildFighterCardSections(cardsQuery.data?.pages), [cardsQuery.data]);

  const items: ListItem[] = useMemo(
    () =>
      sections.flatMap((section) => [
        { kind: 'setHeading' as const, key: `heading-${section.set_id}`, setName: section.set_name },
        ...section.cards.map((card) => ({
          kind: 'card' as const,
          key: `${section.set_id}-${card.card_number}-${card.subset}`,
          setId: section.set_id,
          card,
        })),
      ]),
    [sections],
  );

  function openCard(setId: string, cardId: string) {
    router.push(`/(tabs)/cards/${setId}/${cardId}`);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={BACK_ICON_SIZE} color={colors.textPrimary} />
        </Pressable>
      </View>

      <FlashList
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) =>
          item.kind === 'setHeading' ? (
            <Text variant="label" color="textSecondary" style={styles.setHeading}>
              {item.setName}
            </Text>
          ) : (
            <FighterCardRowItem
              card={item.card}
              statuses={statuses}
              onPress={() => openCard(item.setId, item.card.parallels[0].id)}
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.profile}>
            {fighter.image_url ? (
              <Image
                source={{ uri: fighter.image_url }}
                style={styles.photo}
                contentFit="contain"
                contentPosition="bottom"
                transition={0}
              />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Text variant="heading" color="textSecondary">
                  {fighterInitials(displayName)}
                </Text>
              </View>
            )}

            <Text variant="display" style={styles.name}>
              {displayName}
            </Text>
            {fighter.nickname ? (
              <Text variant="body" color="textSecondary" style={styles.nickname}>
                "{fighter.nickname}"
              </Text>
            ) : null}

            <Text variant="body" style={styles.record}>
              {formatRecord(fighter)}
            </Text>
            <FormIndicator lastFive={fighter.last_five} style={styles.formRow} />

            <View style={styles.tape}>
              {[
                { label: 'Weight class', value: formatText(fighter.weight_class) },
                { label: 'Height', value: formatText(fighter.height) },
                { label: 'Reach', value: formatText(fighter.reach) },
                { label: 'Age', value: age == null ? MISSING : String(age) },
                { label: 'Stance', value: formatText(fighter.stance) },
                { label: 'Nationality', value: formatText(fighter.nationality) },
              ].map((row, position) => (
                <TapeRow key={row.label} label={row.label} value={row.value} divided={position > 0} />
              ))}
            </View>

            <Text variant="label" style={styles.cardsHeading}>
              Cards · {total}
            </Text>
          </View>
        }
        ListEmptyComponent={
          cardsQuery.isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.brandRed} />
            </View>
          ) : cardsQuery.isError ? (
            <View style={styles.centered}>
              <Text variant="body" style={styles.errorText}>
                Could not load this fighter's cards.
              </Text>
              <Button variant="outline" label="Try again" onPress={() => cardsQuery.refetch()} style={styles.retryButton} />
            </View>
          ) : (
            <View style={styles.centered}>
              <Text variant="body">No cards for this fighter.</Text>
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
      />
    </Screen>
  );
}

function TapeRow({ label, value, divided }: { label: string; value: string; divided: boolean }) {
  return (
    <View style={[styles.tapeRow, divided && styles.tapeRowDivided]}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

function FighterCardRowItem({
  card,
  statuses,
  onPress,
}: {
  card: FighterCardGroupRow;
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
          <Text variant="label" color="textSecondary" numberOfLines={1} style={styles.cardSubset}>
            {card.subset}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
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
  header: {
    flexDirection: 'row',
    paddingLeft: spacing.lg,
    paddingTop: spacing.sm,
  },
  back: {
    width: BACK_TARGET,
    height: BACK_TARGET,
    marginLeft: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  profile: {
    paddingHorizontal: spacing.lg,
  },
  // No background fill — a cut-out portrait sits on the white screen, anchored
  // to the bottom of a fixed-height area, same as the picks flow's tiles.
  photo: {
    width: '100%',
    height: PHOTO_HEIGHT,
  },
  photoPlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    marginTop: spacing.md,
  },
  nickname: {
    marginTop: spacing.xs,
  },
  record: {
    marginTop: spacing.sm,
    fontFamily: typography.fontFamily.bodyMedium,
  },
  formRow: {
    marginTop: spacing.sm,
  },
  tape: {
    marginTop: spacing.lg,
    borderTopWidth: borderWidths.structural,
    borderBottomWidth: borderWidths.structural,
    borderColor: colors.border,
  },
  tapeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  tapeRowDivided: {
    borderTopWidth: borderWidths.structural,
    borderTopColor: colors.border,
  },
  cardsHeading: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  setHeading: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
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
  cardSubset: {
    flexShrink: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
