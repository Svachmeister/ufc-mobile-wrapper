import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import { Button, Screen, SegmentedControl, Text } from '@/components/ui';
import { borderWidths, colors, spacing } from '@/theme/tokens';
import { groupSetsByYear, type SetRow } from '@/lib/cards/cardGrouping';
import { useSets } from '@/lib/cards/queries';

type Tab = 'sets' | 'fighters';

type SetsListItem = { kind: 'year'; year: number } | { kind: 'set'; set: SetRow };

export function CardsScreen() {
  const [tab, setTab] = useState<Tab>('sets');

  return (
    <Screen>
      <View style={styles.segmentWrap}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'sets', label: 'Sets' },
            { value: 'fighters', label: 'Fighters' },
          ]}
        />
      </View>

      {tab === 'fighters' ? <FightersPane /> : <SetsPane />}
    </Screen>
  );
}

function FightersPane() {
  return (
    <View style={styles.centered}>
      <Text variant="body">Fighters arrive in the next update.</Text>
    </View>
  );
}

function SetsPane() {
  const router = useRouter();
  const query = useSets();

  if (query.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brandRed} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.centered}>
        <Text variant="body" style={styles.errorText}>
          Could not load sets.
        </Text>
        <Button variant="outline" label="Try again" onPress={() => query.refetch()} style={styles.retryButton} />
      </View>
    );
  }

  const sets = query.data ?? [];

  if (sets.length === 0) {
    return (
      <View style={styles.centered}>
        <Text variant="body">No sets yet.</Text>
      </View>
    );
  }

  const items: SetsListItem[] = groupSetsByYear(sets).flatMap((group) => [
    { kind: 'year' as const, year: group.year },
    ...group.sets.map((set) => ({ kind: 'set' as const, set })),
  ]);

  return (
    <FlashList
      data={items}
      keyExtractor={(item) => (item.kind === 'year' ? `year-${item.year}` : item.set.id)}
      renderItem={({ item }) =>
        item.kind === 'year' ? (
          <Text variant="label" color="textSecondary" style={styles.yearHeading}>
            {item.year}
          </Text>
        ) : (
          <SetRowItem set={item.set} onPress={() => router.push(`/(tabs)/cards/${item.set.id}`)} />
        )
      }
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
      contentContainerStyle={styles.listContent}
    />
  );
}

function SetRowItem({ set, onPress }: { set: SetRow; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.setRow}>
      <Text variant="heading">{set.name}</Text>
      <Text variant="body" color="textSecondary">
        {set.manufacturer}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segmentWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
  listContent: {
    paddingBottom: spacing.xxl,
  },
  yearHeading: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  setRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: borderWidths.structural,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
});
