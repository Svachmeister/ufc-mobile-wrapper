import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const FIGHTER_COLUMN_WIDTH = 102;
const MATRIX_COLUMN_WIDTH = 40;
const MATRIX_ROW_HEIGHT = 56;
const STATUS_TOUCH_SIZE = 38;
const STATUS_ICON_SIZE = 22;

type ChecklistStatus = 'owned' | 'unmarked' | 'wanted';

type PreviewColumn = {
  key: string;
  label: string;
};

type PreviewRow = {
  code: string;
  fighter: string;
  statuses: Record<string, ChecklistStatus>;
};

const columns: PreviewColumn[] = [
  { key: 'base', label: 'Base' },
  { key: 'refractor', label: 'Ref' },
  { key: 'green', label: '/99' },
  { key: 'gold', label: '/50' },
  { key: 'orange', label: '/25' },
  { key: 'black', label: '/10' },
  { key: 'red', label: '/5' },
  { key: 'superfractor', label: '1/1' },
];

const rows: PreviewRow[] = [
  {
    code: 'CRA-01',
    fighter: 'Ailin Perez',
    statuses: {
      base: 'owned',
      refractor: 'wanted',
      green: 'unmarked',
      gold: 'unmarked',
      orange: 'owned',
      black: 'unmarked',
      red: 'wanted',
      superfractor: 'unmarked',
    },
  },
  {
    code: 'CRA-02',
    fighter: 'Christian Duncan',
    statuses: {
      base: 'owned',
      refractor: 'owned',
      green: 'wanted',
      gold: 'unmarked',
      orange: 'unmarked',
      black: 'unmarked',
      red: 'unmarked',
      superfractor: 'unmarked',
    },
  },
  {
    code: 'CRA-03',
    fighter: 'Charles Jourdain',
    statuses: {
      base: 'unmarked',
      refractor: 'wanted',
      green: 'owned',
      gold: 'unmarked',
      orange: 'unmarked',
      black: 'wanted',
      red: 'unmarked',
      superfractor: 'unmarked',
    },
  },
  {
    code: 'CRA-04',
    fighter: 'Jose Mariscal',
    statuses: {
      base: 'owned',
      refractor: 'unmarked',
      green: 'unmarked',
      gold: 'wanted',
      orange: 'unmarked',
      black: 'unmarked',
      red: 'unmarked',
      superfractor: 'unmarked',
    },
  },
  {
    code: 'CRA-05',
    fighter: 'Carlos Prates',
    statuses: {
      base: 'owned',
      refractor: 'owned',
      green: 'wanted',
      gold: 'owned',
      orange: 'unmarked',
      black: 'wanted',
      red: 'unmarked',
      superfractor: 'unmarked',
    },
  },
  {
    code: 'CRA-06',
    fighter: 'Danny Barlow',
    statuses: {
      base: 'unmarked',
      refractor: 'owned',
      green: 'unmarked',
      gold: 'unmarked',
      orange: 'wanted',
      black: 'unmarked',
      red: 'unmarked',
      superfractor: 'unmarked',
    },
  },
  {
    code: 'CRA-07',
    fighter: 'Jiri Prochazka',
    statuses: {
      base: 'owned',
      refractor: 'wanted',
      green: 'owned',
      gold: 'wanted',
      orange: 'unmarked',
      black: 'owned',
      red: 'wanted',
      superfractor: 'unmarked',
    },
  },
  {
    code: 'CRA-08',
    fighter: 'Alex Pereira',
    statuses: {
      base: 'owned',
      refractor: 'owned',
      green: 'owned',
      gold: 'wanted',
      orange: 'wanted',
      black: 'unmarked',
      red: 'wanted',
      superfractor: 'unmarked',
    },
  },
];

export default function SectionChecklistPreview() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.backText}>{'\u2039 BACK'}</Text>

        <View style={styles.header}>
          <Text style={styles.title}>Checklist</Text>
          <Text style={styles.subtitle}>
            {'Chrome Rookie Autographs \u00b7 2025 Topps Chrome UFC'}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryAccent} />
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>CHROME ROOKIE AUTOGRAPHS</Text>
            <Text style={styles.summaryMeta}>{'41 fighters \u00b7 9 parallels'}</Text>
          </View>
        </View>

        <View style={styles.matrixCard}>
          <View style={styles.matrixGrid}>
            <View style={styles.leftTrack}>
              <View style={styles.fighterHeaderCell}>
                <Text style={styles.fighterHeaderText}>Fighter</Text>
              </View>

              {rows.map((row) => (
                <View key={row.code} style={styles.fighterCell}>
                  <Text style={styles.cardCode}>{row.code}</Text>
                  <Text numberOfLines={2} style={styles.fighterName}>
                    {row.fighter}
                  </Text>
                </View>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.matrixTrack}>
                <View style={styles.matrixHeaderTrack}>
                  {columns.map((column) => (
                    <View key={column.key} style={styles.columnHeaderCell}>
                      <Text numberOfLines={1} style={styles.columnHeaderText}>
                        {column.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {rows.map((row) => (
                  <View key={row.code} style={styles.matrixRowTrack}>
                    {columns.map((column) => (
                      <View key={column.key} style={styles.statusCell}>
                        <StatusMarker status={row.statuses[column.key] ?? 'unmarked'} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        <View style={styles.legend}>
          <LegendItem label="Owned" status="owned" />
          <LegendItem label="Wanted" status="wanted" />
          <LegendItem label="Unmarked" status="unmarked" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LegendItem({ label, status }: { label: string; status: ChecklistStatus }) {
  return (
    <View style={styles.legendItem}>
      <StatusMarker status={status} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function StatusMarker({ status }: { status: ChecklistStatus }) {
  const isOwned = status === 'owned';
  const isWanted = status === 'wanted';

  return (
    <Pressable onPress={() => undefined} style={styles.statusTouch}>
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
}

const styles = StyleSheet.create({
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
    height: 44,
    justifyContent: 'center',
    width: MATRIX_COLUMN_WIDTH,
  },
  columnHeaderText: {
    color: '#4f4f49',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.2,
    lineHeight: 11,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  container: {
    backgroundColor: '#fbfaf7',
    flex: 1,
  },
  content: {
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  fighterCell: {
    borderTopColor: '#eeeeea',
    borderTopWidth: 1,
    height: MATRIX_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 9,
    width: FIGHTER_COLUMN_WIDTH,
  },
  fighterHeaderCell: {
    backgroundColor: '#f7f7f3',
    height: 44,
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
    marginTop: 14,
    overflow: 'hidden',
  },
  matrixGrid: {
    flexDirection: 'row',
  },
  matrixHeaderTrack: {
    backgroundColor: '#f7f7f3',
    flexDirection: 'row',
    height: 44,
  },
  matrixRowTrack: {
    borderTopColor: '#eeeeea',
    borderTopWidth: 1,
    flexDirection: 'row',
    height: MATRIX_ROW_HEIGHT,
  },
  matrixTrack: {
    minWidth: MATRIX_COLUMN_WIDTH * columns.length,
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
