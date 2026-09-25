import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, Screen, Text } from '@/components/ui';
import { borderWidths, colors, spacing } from '@/theme/tokens';
import { useCardDetail } from '@/lib/cards/queries';
import type { ParallelInfo } from '@/lib/cards/cardGrouping';

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

  const { card, parallels, fighters } = query.data;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
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
          <ParallelRow key={parallel.id} parallel={parallel} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function ParallelRow({ parallel }: { parallel: ParallelInfo }) {
  const printRunLabel = parallel.print_run === 1 ? '1/1' : parallel.print_run != null ? `/${parallel.print_run}` : '—';

  return (
    <View style={styles.parallelRow}>
      <Text variant="body">{parallel.variation}</Text>
      <Text variant="body" color="textSecondary">
        {printRunLabel}
      </Text>
    </View>
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
  parallelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidths.structural,
    borderBottomColor: colors.border,
  },
});
