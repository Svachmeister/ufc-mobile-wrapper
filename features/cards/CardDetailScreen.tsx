import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, Screen, Text } from '@/components/ui';
import { borderWidths, colors, radius, spacing } from '@/theme/tokens';
import { useCardDetail, type CardDetailData } from '@/lib/cards/queries';
import type { ParallelInfo } from '@/lib/cards/cardGrouping';
import { useMyCardStatuses, useSetCardStatus, type CardStatus } from '@/lib/cards/userCardStatuses';

const BACK_TARGET = 44;
const BACK_ICON_SIZE = 24;

export function CardDetailScreen({ cardId }: { cardId: string }) {
  const router = useRouter();
  const query = useCardDetail(cardId);

  function back() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/cards');
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

  return <CardDetailBody data={query.data} onBack={back} />;
}

function CardDetailBody({ data, onBack }: { data: CardDetailData; onBack: () => void }) {
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
          fighters.map((fighter) => (
            <Pressable key={fighter.id} onPress={() => router.push(`/(tabs)/cards/fighter/${fighter.id}`)}>
              <Text variant="display" style={styles.fighterName}>
                {fighter.name}
              </Text>
            </Pressable>
          ))
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
      { cardId: parallel.id, pressedStatus },
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
            label="HAVE"
            active={status === 'owned'}
            disabled={setStatus.isPending}
            onPress={() => press('owned')}
          />
          <ToggleButton
            label="WANT"
            active={status === 'wanted'}
            disabled={setStatus.isPending}
            onPress={() => press('wanted')}
          />
        </View>
      </View>
      {rowError ? (
        <Text variant="label" color="textSecondary" style={styles.rowError}>
          {rowError}
        </Text>
      ) : null}
    </View>
  );
}

function ToggleButton({
  label,
  active,
  disabled,
  onPress,
}: {
  label: 'HAVE' | 'WANT';
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
