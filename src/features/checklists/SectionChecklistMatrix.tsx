import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useCallback, useMemo } from 'react';
import { FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const FIGHTER_COLUMN_WIDTH = 102;
const MATRIX_COLUMN_WIDTH = 58;
const MATRIX_HEADER_HEIGHT = 54;
const MATRIX_ROW_HEIGHT = 56;
const STATUS_TOUCH_SIZE = 38;
const STATUS_ICON_SIZE = 22;

export type ChecklistCellStatus = 'owned' | 'wanted' | null;

export type SectionChecklistColumn = {
  key: string;
  label: string;
  sortLabel?: string;
};

export type SectionChecklistRow = {
  key: string;
  cardCode?: string;
  fighterName: string;
  cells: Record<string, ChecklistCellStatus>;
};

export type SectionChecklistMatrixProps = {
  columns: SectionChecklistColumn[];
  meta: string;
  onBack?: () => void;
  onCellPress?: (
    rowKey: string,
    columnKey: string,
    currentStatus: ChecklistCellStatus,
  ) => void;
  rows: SectionChecklistRow[];
  sectionName: string;
  setName: string;
};

export default function SectionChecklistMatrix({
  columns,
  meta,
  onBack,
  onCellPress,
  rows,
  sectionName,
  setName,
}: SectionChecklistMatrixProps) {
  const matrixWidth = useMemo(() => MATRIX_COLUMN_WIDTH * columns.length, [columns.length]);
  const totalMatrixWidth = useMemo(
    () => FIGHTER_COLUMN_WIDTH + matrixWidth,
    [matrixWidth],
  );

  const keyExtractor = useCallback((row: SectionChecklistRow) => row.key, []);

  const getItemLayout = useCallback((
    _data: ArrayLike<SectionChecklistRow> | null | undefined,
    index: number,
  ) => ({
    index,
    length: MATRIX_ROW_HEIGHT,
    offset: MATRIX_ROW_HEIGHT * index,
  }), []);

  const renderRow = useCallback(({ item }: { item: SectionChecklistRow }) => (
    <MatrixRow
      columns={columns}
      onCellPress={onCellPress}
      row={item}
    />
  ), [columns, onCellPress]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>{'\u2039 BACK'}</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Checklist</Text>
          <Text style={styles.subtitle}>{setName}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryAccent} />
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>{sectionName}</Text>
            <Text style={styles.summaryMeta}>{meta}</Text>
          </View>
        </View>

        <View style={styles.matrixCard}>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.matrixHorizontalScroll}
          >
            <View style={[styles.matrixTrack, { width: totalMatrixWidth }]}>
              <View style={styles.matrixHeaderTrack}>
                <View style={styles.fighterHeaderCell}>
                  <Text style={styles.fighterHeaderText}>Fighter</Text>
                </View>

                {columns.map((column) => (
                  <View key={column.key} style={styles.columnHeaderCell}>
                    <ColumnHeaderLabel label={column.label} />
                  </View>
                ))}
              </View>

              <FlatList
                data={rows}
                getItemLayout={getItemLayout}
                initialNumToRender={16}
                keyExtractor={keyExtractor}
                maxToRenderPerBatch={14}
                removeClippedSubviews
                renderItem={renderRow}
                showsVerticalScrollIndicator={false}
                style={styles.matrixList}
                windowSize={6}
              />
            </View>
          </ScrollView>
        </View>

        <View style={styles.legend}>
          <LegendItem label="Owned" status="owned" />
          <LegendItem label="Wanted" status="wanted" />
          <LegendItem label="Unmarked" status={null} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const MatrixRow = memo(function MatrixRow({
  columns,
  onCellPress,
  row,
}: {
  columns: SectionChecklistColumn[];
  onCellPress?: SectionChecklistMatrixProps['onCellPress'];
  row: SectionChecklistRow;
}) {
  return (
    <View style={styles.matrixRowTrack}>
      <View style={styles.fighterCell}>
        {row.cardCode ? <Text style={styles.cardCode}>{row.cardCode}</Text> : null}
        <Text numberOfLines={2} style={styles.fighterName}>
          {row.fighterName}
        </Text>
      </View>

      {columns.map((column) => (
        <MatrixStatusCell
          columnKey={column.key}
          key={column.key}
          onCellPress={onCellPress}
          rowKey={row.key}
          status={row.cells[column.key] ?? null}
        />
      ))}
    </View>
  );
});

const MatrixStatusCell = memo(function MatrixStatusCell({
  columnKey,
  onCellPress,
  rowKey,
  status,
}: {
  columnKey: string;
  onCellPress?: SectionChecklistMatrixProps['onCellPress'];
  rowKey: string;
  status: ChecklistCellStatus;
}) {
  const handlePress = useCallback(() => {
    onCellPress?.(rowKey, columnKey, status);
  }, [columnKey, onCellPress, rowKey, status]);

  return (
    <View style={styles.statusCell}>
      <StatusMarker
        onPress={handlePress}
        status={status}
      />
    </View>
  );
});

const ColumnHeaderLabel = memo(function ColumnHeaderLabel({ label }: { label: string }) {
  const [name, printRun] = label.split(/\s+(\/.+)$/);

  return (
    <View style={styles.columnHeaderLabel}>
      <Text numberOfLines={2} style={styles.columnHeaderName}>
        {name}
      </Text>
      {printRun ? (
        <Text numberOfLines={1} style={styles.columnHeaderPrintRun}>
          {printRun}
        </Text>
      ) : null}
    </View>
  );
});

function LegendItem({ label, status }: { label: string; status: ChecklistCellStatus }) {
  return (
    <View style={styles.legendItem}>
      <StatusMarker status={status} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const StatusMarker = memo(function StatusMarker({
  onPress,
  status,
}: {
  onPress?: () => void;
  status: ChecklistCellStatus;
}) {
  const isOwned = status === 'owned';
  const isWanted = status === 'wanted';

  return (
    <Pressable onPress={onPress} style={styles.statusTouch}>
      {isWanted ? (
        <View style={styles.wantedIcon}>
          <MaterialCommunityIcons color="#e10600" name="magnify" size={STATUS_ICON_SIZE} />
        </View>
      ) : (
        <View
          style={[
            styles.statusIcon,
            isOwned ? styles.ownedIcon : styles.unmarkedIcon,
          ]}
        >
          {isOwned ? <Text style={styles.checkMark}>{'\u2713'}</Text> : null}
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingRight: 12,
  },
  backText: {
    alignSelf: 'flex-start',
    color: '#4f4f49',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  cardCode: {
    color: '#e10600',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: STATUS_ICON_SIZE,
    textAlign: 'center',
  },
  columnHeaderCell: {
    alignItems: 'center',
    height: MATRIX_HEADER_HEIGHT,
    justifyContent: 'center',
    width: MATRIX_COLUMN_WIDTH,
  },
  columnHeaderLabel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  columnHeaderName: {
    color: '#4f4f49',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.1,
    lineHeight: 9,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  columnHeaderPrintRun: {
    color: '#e10600',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.1,
    lineHeight: 10,
    marginTop: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  container: {
    backgroundColor: '#fbfaf7',
    flex: 1,
  },
  content: {
    flex: 1,
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  fighterCell: {
    height: MATRIX_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 9,
    width: FIGHTER_COLUMN_WIDTH,
  },
  fighterHeaderCell: {
    backgroundColor: '#f7f7f3',
    borderRightColor: '#eeeeea',
    borderRightWidth: 1,
    height: MATRIX_HEADER_HEIGHT,
    justifyContent: 'flex-end',
    paddingBottom: 8,
    paddingHorizontal: 9,
    width: FIGHTER_COLUMN_WIDTH,
  },
  fighterHeaderText: {
    color: '#080808',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  fighterName: {
    color: '#080808',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 15,
    marginTop: 3,
  },
  header: {
    marginTop: 10,
  },
  leftTrack: {
    borderRightColor: '#eeeeea',
    borderRightWidth: 1,
  },
  legend: {
    alignSelf: 'stretch',
    backgroundColor: '#ffffff',
    borderColor: '#d8d8d2',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  legendText: {
    color: '#4f4f49',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  matrixCard: {
    backgroundColor: '#ffffff',
    borderColor: '#d8d8d2',
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    marginTop: 14,
    minHeight: 0,
    overflow: 'hidden',
  },
  matrixHorizontalScroll: {
    flex: 1,
  },
  matrixHeaderTrack: {
    backgroundColor: '#f7f7f3',
    flexDirection: 'row',
    height: MATRIX_HEADER_HEIGHT,
  },
  matrixList: {
    flex: 1,
  },
  matrixRowTrack: {
    borderTopColor: '#eeeeea',
    borderTopWidth: 1,
    flexDirection: 'row',
    height: MATRIX_ROW_HEIGHT,
  },
  matrixTrack: {
    flex: 1,
  },
  ownedIcon: {
    backgroundColor: '#188038',
    borderColor: '#188038',
  },
  statusCell: {
    alignItems: 'center',
    height: MATRIX_ROW_HEIGHT,
    justifyContent: 'center',
    width: MATRIX_COLUMN_WIDTH,
  },
  statusIcon: {
    alignItems: 'center',
    borderRadius: STATUS_ICON_SIZE / 2,
    borderWidth: 2,
    height: STATUS_ICON_SIZE,
    justifyContent: 'center',
    width: STATUS_ICON_SIZE,
  },
  statusTouch: {
    alignItems: 'center',
    height: STATUS_TOUCH_SIZE,
    justifyContent: 'center',
    width: STATUS_TOUCH_SIZE,
  },
  subtitle: {
    color: '#4f4f49',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 4,
  },
  summaryAccent: {
    backgroundColor: '#e10600',
    width: 4,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderColor: '#d8d8d2',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 12,
    overflow: 'hidden',
  },
  summaryCopy: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  summaryMeta: {
    color: '#4f4f49',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  summaryTitle: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  title: {
    color: '#080808',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 36,
  },
  unmarkedIcon: {
    backgroundColor: '#ffffff',
    borderColor: '#b7b7af',
  },
  wantedIcon: {
    alignItems: 'center',
    height: STATUS_ICON_SIZE,
    justifyContent: 'center',
    width: STATUS_ICON_SIZE,
  },
});
