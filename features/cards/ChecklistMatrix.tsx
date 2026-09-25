import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { Text } from '@/components/ui';
import { borderWidths, colors, radius, spacing, typography } from '@/theme/tokens';
import {
  matrixColumns,
  parallelChipLabel,
  parallelKey,
  type ChecklistCard,
  type MatrixColumn,
  type ParallelInfo,
} from '@/lib/cards/cardGrouping';
import {
  nextStatusFor,
  useSetCardStatus,
  type CardStatus,
  type MyCardStatusMap,
  type NextCardStatus,
} from '@/lib/cards/userCardStatuses';
import { RcTag } from './ParallelChip';

const FIRST_COLUMN_WIDTH = 112;
const COLUMN_WIDTH = 60;
const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 52;
const CELL_SIZE = 44;
const ERROR_VISIBLE_MS = 3000;

type PressCell = (cardId: string, nextStatus: NextCardStatus) => void;

/**
 * Sticky layout: one horizontal ScrollView holds both the header row and a
 * vertical FlashList, so header and rows share a single horizontal offset
 * natively and can never drift apart. The header sits above the list (not
 * inside it), so it stays put while rows scroll vertically. The first
 * column is part of each row — vertically it moves with its own row by
 * construction — and is pinned horizontally by translating it by the
 * scroll offset on the native driver, so it's updated on the UI thread in
 * the same frame as the scroll rather than round-tripping through JS.
 */
export function ChecklistMatrix({
  cards,
  statuses,
  onSelectCard,
}: {
  cards: ChecklistCard[];
  statuses: MyCardStatusMap | undefined;
  onSelectCard: (cardId: string) => void;
}) {
  const columns = useMemo(() => matrixColumns(cards), [cards]);
  const cellsByCard = useMemo(() => {
    const byCard = new Map<string, Map<string, ParallelInfo>>();
    for (const card of cards) {
      const cells = new Map<string, ParallelInfo>();
      for (const parallel of card.parallels) {
        const key = parallelKey(parallel);
        if (!cells.has(key)) {
          cells.set(key, parallel);
        }
      }
      byCard.set(card.card_number, cells);
    }
    return byCard;
  }, [cards]);

  const [scrollX] = useState(() => new Animated.Value(0));
  const stickyX = useMemo(
    () => scrollX.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: 'clamp' }),
    [scrollX],
  );
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true }),
    [scrollX],
  );

  const [viewportHeight, setViewportHeight] = useState(0);
  function onViewportLayout(event: LayoutChangeEvent) {
    setViewportHeight(event.nativeEvent.layout.height);
  }

  const [errorVisible, setErrorVisible] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  useEffect(() => {
    if (errorCount === 0) {
      return;
    }
    const timer = setTimeout(() => setErrorVisible(false), ERROR_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [errorCount]);

  // Same hook the card detail uses — optimistic update, rollback and the
  // console.error all live in its options, which run for every call.
  // mutateAsync is used instead of per-call mutate callbacks because those
  // only fire for the latest call, and cells can be tapped in quick
  // succession. A cell whose previous write is still in flight ignores
  // presses, the way the detail screen disables its buttons meanwhile.
  const { mutateAsync } = useSetCardStatus();
  const inFlight = useRef(new Set<string>());
  const pressCell = useCallback<PressCell>(
    (cardId, nextStatus) => {
      if (inFlight.current.has(cardId)) {
        return;
      }
      inFlight.current.add(cardId);
      mutateAsync({ cardId, nextStatus })
        .catch(() => {
          setErrorVisible(true);
          setErrorCount((count) => count + 1);
        })
        .finally(() => {
          inFlight.current.delete(cardId);
        });
    },
    [mutateAsync],
  );

  const gridWidth = FIRST_COLUMN_WIDTH + columns.length * COLUMN_WIDTH;

  return (
    <View style={styles.container}>
      {/* The error replaces the hint rather than stacking above it, so the
          grid never shifts under the user's finger mid-tapping. */}
      <Text variant="body" color={errorVisible ? 'brandRed' : 'textSecondary'} style={styles.hint} numberOfLines={1}>
        {errorVisible ? 'Could not save. Try again.' : 'Tap = HAVE · Hold = WANT'}
      </Text>

      <View style={styles.viewport} onLayout={onViewportLayout}>
        {viewportHeight > 0 ? (
          <Animated.ScrollView
            horizontal
            bounces={false}
            directionalLockEnabled
            scrollEventThrottle={16}
            onScroll={onScroll}
          >
            <View style={{ width: gridWidth, height: viewportHeight }}>
              <View style={styles.headerRow}>
                <Animated.View style={[styles.corner, { transform: [{ translateX: stickyX }] }]} />
                {columns.map((column) => (
                  <ColumnHeader key={column.key} column={column} />
                ))}
              </View>
              <FlashList
                data={cards}
                keyExtractor={(card) => card.card_number}
                renderItem={({ item }) => (
                  <MatrixRow
                    card={item}
                    cells={cellsByCard.get(item.card_number)}
                    columns={columns}
                    statuses={statuses}
                    stickyX={stickyX}
                    onSelectCard={onSelectCard}
                    onPressCell={pressCell}
                  />
                )}
                contentContainerStyle={styles.listContent}
              />
            </View>
          </Animated.ScrollView>
        ) : null}
      </View>
    </View>
  );
}

function printRunLabel(printRun: number | null): string | null {
  if (printRun == null) {
    return null;
  }
  return printRun === 1 ? '1/1' : `/${printRun}`;
}

function ColumnHeader({ column }: { column: MatrixColumn }) {
  const printRun = printRunLabel(column.print_run);
  return (
    <View style={styles.headerCell}>
      <Text variant="label" style={styles.headerText} numberOfLines={2}>
        {column.variation}
      </Text>
      {printRun ? (
        <Text variant="label" style={styles.headerText} numberOfLines={1}>
          {printRun}
        </Text>
      ) : null}
    </View>
  );
}

function surname(fighterName: string): string {
  const parts = fighterName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? '';
}

function MatrixRow({
  card,
  cells,
  columns,
  statuses,
  stickyX,
  onSelectCard,
  onPressCell,
}: {
  card: ChecklistCard;
  cells: Map<string, ParallelInfo> | undefined;
  columns: MatrixColumn[];
  statuses: MyCardStatusMap | undefined;
  stickyX: Animated.AnimatedInterpolation<number>;
  onSelectCard: (cardId: string) => void;
  onPressCell: PressCell;
}) {
  return (
    <View style={styles.row}>
      <Animated.View style={[styles.firstCell, { transform: [{ translateX: stickyX }] }]}>
        <Pressable
          onPress={() => onSelectCard(card.parallels[0].id)}
          style={styles.firstCellPress}
          accessibilityRole="button"
          accessibilityLabel={`${card.card_number} ${card.fighter_name}`}
        >
          <Text variant="heading" style={styles.cardNumber} numberOfLines={1}>
            {card.card_number}
          </Text>
          <View style={styles.nameRow}>
            <Text variant="heading" style={styles.surname} numberOfLines={1}>
              {surname(card.fighter_name)}
            </Text>
            {card.is_rookie ? <RcTag /> : null}
          </View>
        </Pressable>
      </Animated.View>
      {columns.map((column) => {
        const parallel = cells?.get(column.key);
        return (
          <MatrixCell
            key={column.key}
            cardNumber={card.card_number}
            parallel={parallel}
            status={parallel ? statuses?.[parallel.id] : undefined}
            onPress={onPressCell}
          />
        );
      })}
    </View>
  );
}

/**
 * Same visual rules as ParallelChip: owned fills black (whatever the print
 * run) · otherwise a 1/1 gets the 3px border · wanted adds the dot. A
 * parallel the card doesn't come in gets a faint fill and no press handler.
 */
const MatrixCell = memo(function MatrixCell({
  cardNumber,
  parallel,
  status,
  onPress,
}: {
  cardNumber: string;
  parallel: ParallelInfo | undefined;
  status: CardStatus | undefined;
  onPress: PressCell;
}) {
  if (!parallel) {
    return (
      <View style={styles.cellSlot} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[styles.cell, styles.cellMissing]} />
      </View>
    );
  }

  const isOwned = status === 'owned';
  const isWanted = status === 'wanted';
  const isOneOfOne = parallel.print_run === 1;

  return (
    <Pressable
      onPress={() => onPress(parallel.id, nextStatusFor(status, 'owned'))}
      onLongPress={() => onPress(parallel.id, nextStatusFor(status, 'wanted'))}
      style={styles.cellSlot}
      accessibilityRole="button"
      accessibilityLabel={`${cardNumber} ${parallelChipLabel(parallel)}`}
      accessibilityValue={{ text: isOwned ? 'Have' : isWanted ? 'Want' : 'Not marked' }}
      accessibilityHint="Tap to toggle have, hold to toggle want"
    >
      <View style={[styles.cell, isOneOfOne && !isOwned && styles.cellOneOfOne, isOwned && styles.cellOwned]}>
        {isWanted ? <View style={styles.wantedDot} /> : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hint: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  viewport: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    height: HEADER_HEIGHT,
    borderTopWidth: borderWidths.structural,
    borderTopColor: colors.border,
    borderBottomWidth: borderWidths.structural,
    borderBottomColor: colors.border,
  },
  corner: {
    width: FIRST_COLUMN_WIDTH,
    backgroundColor: colors.surface,
    borderRightWidth: borderWidths.structural,
    borderRightColor: colors.border,
    zIndex: 1,
  },
  headerCell: {
    width: COLUMN_WIDTH,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontFamily: typography.fontFamily.headingMedium,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    borderBottomWidth: borderWidths.structural,
    borderBottomColor: colors.border,
  },
  firstCell: {
    width: FIRST_COLUMN_WIDTH,
    backgroundColor: colors.surface,
    borderRightWidth: borderWidths.structural,
    borderRightColor: colors.border,
    zIndex: 1,
  },
  firstCellPress: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  cardNumber: {
    fontSize: 16,
    lineHeight: 18,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  surname: {
    flexShrink: 1,
    fontFamily: typography.fontFamily.headingMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  cellSlot: {
    width: COLUMN_WIDTH,
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: borderWidths.structural,
    borderColor: colors.border,
    borderRadius: radius.none,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOneOfOne: {
    borderWidth: borderWidths.emphasis,
    borderColor: colors.textPrimary,
  },
  cellOwned: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  // No border, and the border grey at half strength so a missing parallel
  // reads as "not part of this card" rather than as a mark.
  cellMissing: {
    borderWidth: 0,
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  // Same 6pt round dot as ParallelChip's wanted mark.
  wantedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textPrimary,
  },
});
