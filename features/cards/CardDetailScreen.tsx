import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, Screen, Text } from '@/components/ui';
import { borderWidths, colors, radius, spacing } from '@/theme/tokens';
import { useCardDetail, type CardDetailData } from '@/lib/cards/queries';
import type { ParallelInfo } from '@/lib/cards/cardGrouping';
import { nextStatusFor, useMyCardStatuses, useSetCardStatus, type CardStatus } from '@/lib/cards/userCardStatuses';
import { OWNED_ICON, WANTED_ICON } from './ParallelLine';

const BACK_TARGET = 44;
const TOGGLE_ICON_SIZE = 14;
const BACK_ICON_SIZE = 24;

type CardDetailScreenProps = {
  cardId: string;
  // Card detail is reused as-is inside the Collection stack (M4-B), which has
  // no fighter-detail route of its own — rather than duplicate that route or
  // make this screen push across tabs, fighter names just render as plain
  // text there.
  enableFighterLinks?: boolean;
  // Where the back control lands when this screen has no history to pop to
  // (e.g. opened by a deep link) — differs by which tab's stack it's in.
  fallbackRoute?: '/(tabs)/cards' | '/(tabs)/collection';
};

export function CardDetailScreen({ cardId, enableFighterLinks = true, fallbackRoute = '/(tabs)/cards' }: CardDetailScreenProps) {
  const router = useRouter();
  const query = useCardDetail(cardId);

  function back() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute);
    }
  }

  if (query.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandRed} />
        </View>
      </Screen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text variant="body" style={styles.centeredText}>
            Could not load this card.
          </Text>
          <Button variant="outline" label="Try again" onPress={() => query.refetch()} style={styles.retryButton} />
        </View>
      </Screen>
    );
  }

  return <CardDetailBody data={query.data} enableFighterLinks={enableFighterLinks} onBack={back} />;
}

function CardDetailBody({
  data,
  enableFighterLinks,
  onBack,
}: {
  data: CardDetailData;
  enableFighterLinks: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const { card, parallels, fighters } = data;
  const statuses = useMyCardStatuses().data;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={BACK_ICON_SIZE} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="display">{card.card_number}</Text>
        {fighters.length > 0 ? (
          fighters.map((fighter) =>
            enableFighterLinks ? (
              <Pressable key={fighter.id} onPress={() => router.push(`/(tabs)/cards/fighter/${fighter.id}`)}>
                <Text variant="display" style={styles.fighterName}>
                  {fighter.name}
                </Text>
              </Pressable>
            ) : (
              <Text key={fighter.id} variant="display" style={styles.fighterName}>
                {fighter.name}
              </Text>
            ),
          )
        ) : (
          <Text variant="display" color="textSecondary" style={styles.fighterName}>
            Unknown fighter
          </Text>
        )}

        <Text variant="label" color="textSecondary" style={styles.metaLine}>
          {[card.setName, card.subset, card.is_rookie ? 'RC' : null].filter(Boolean).join(' · ')}
        </Text>

        <Text variant="label" style={styles.parallelsHeading}>
          Parallels
        </Text>
        {parallels.map((parallel) => (
          <ParallelRow key={parallel.id} parallel={parallel} status={statuses?.[parallel.id]} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function ParallelRow({ parallel, status }: { parallel: ParallelInfo; status: CardStatus | undefined }) {
  const [rowError, setRowError] = useState<string | null>(null);
  const setStatus = useSetCardStatus();

  const printRunLabel = parallel.print_run === 1 ? '1/1' : parallel.print_run != null ? `/${parallel.print_run}` : '—';

  function press(pressedStatus: CardStatus) {
    setRowError(null);
    setStatus.mutate(
      { cardId: parallel.id, nextStatus: nextStatusFor(status, pressedStatus) },
      { onError: () => setRowError('Could not save. Try again.') },
    );
  }

  return (
    <View style={styles.parallelRowWrap}>
      <View style={styles.parallelRow}>
        <View style={styles.parallelInfo}>
          <Text variant="body">{parallel.variation}</Text>
          <Text variant="body" color="textSecondary">
            {printRunLabel}
          </Text>
        </View>
        <View style={styles.toggleGroup}>
          <ToggleButton
            label="OWNED"
            icon={OWNED_ICON}
            active={status === 'owned'}
            disabled={setStatus.isPending}
            onPress={() => press('owned')}
          />
          <ToggleButton
            label="WANTED"
            icon={WANTED_ICON}
            active={status === 'wanted'}
            disabled={setStatus.isPending}
            onPress={() => press('wanted')}
          />
        </View>
      </View>
      {rowError ? (
        <Text variant="label" color="brandRed" style={styles.rowError}>
          {rowError}
        </Text>
      ) : null}
    </View>
  );
}

function ToggleButton({
  label,
  icon,
  active,
  disabled,
  onPress,
}: {
  label: 'OWNED' | 'WANTED';
  icon: typeof OWNED_ICON | typeof WANTED_ICON;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      style={[styles.toggleButton, active && styles.toggleButtonActive, disabled && styles.toggleButtonDisabled]}
    >
      <Ionicons name={icon} size={TOGGLE_ICON_SIZE} color={active ? colors.surface : colors.textPrimary} />
      <Text variant="label" color={active ? 'surface' : 'textPrimary'}>
        {label}
      </Text>
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  fighterName: {
    marginTop: spacing.xs,
  },
  metaLine: {
    marginTop: spacing.md,
  },
  parallelsHeading: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  parallelRowWrap: {
    borderBottomWidth: borderWidths.structural,
    borderBottomColor: colors.border,
  },
  parallelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  parallelInfo: {
    flexShrink: 1,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  toggleButton: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: spacing.sm,
    borderWidth: borderWidths.structural,
    borderColor: colors.textPrimary,
    borderRadius: radius.none,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.textPrimary,
  },
  toggleButtonDisabled: {
    opacity: 0.4,
  },
  rowError: {
    paddingBottom: spacing.sm,
  },
});
