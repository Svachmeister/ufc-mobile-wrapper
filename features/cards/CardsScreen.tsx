import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import { Button, Screen, SegmentedControl, Text, TextField } from '@/components/ui';
import { borderWidths, colors, spacing } from '@/theme/tokens';
import { groupSetsByYear, type SetRow } from '@/lib/cards/cardGrouping';
import { useSets } from '@/lib/cards/queries';
import { useFightersList, type FighterListRow } from '@/lib/cards/fighterQueries';

type Tab = 'sets' | 'fighters';

type SetsListItem = { kind: 'year'; year: number } | { kind: 'set'; set: SetRow };

const SEARCH_DEBOUNCE_MS = 300;

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
  const router = useRouter();
  const [inputValue, setInputValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(inputValue), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [inputValue]);

  const query = useFightersList(debouncedSearch);
  const rows = query.data?.pages.flatMap((page) => page) ?? [];

  return (
    <>
      <View style={styles.searchWrap}>
        <TextField
          label="Search"
          placeholder="Fighter name"
          value={inputValue}
          onChangeText={setInputValue}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {query.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandRed} />
        </View>
      ) : query.isError ? (
        <View style={styles.centered}>
          <Text variant="body" style={styles.errorText}>
            Could not load fighters.
          </Text>
          <Button variant="outline" label="Try again" onPress={() => query.refetch()} style={styles.retryButton} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.centered}>
          <Text variant="body">No fighters found.</Text>
        </View>
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(row) => row.id}
          renderItem={({ item }) => (
            <FighterRowItem fighter={item} onPress={() => router.push(`/(tabs)/cards/fighter/${item.id}`)} />
          )}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              query.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          contentContainerStyle={styles.listContent}
        />
      )}
    </>
  );
}

function FighterRowItem({ fighter, onPress }: { fighter: FighterListRow; onPress: () => void }) {
  const secondary = [fighter.weight_class, fighter.nationality].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} style={styles.setRow}>
      <Text variant="heading">{fighter.name}</Text>
      {secondary ? (
        <Text variant="body" color="textSecondary">
          {secondary}
        </Text>
      ) : null}
    </Pressable>
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
  searchWrap: {
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
