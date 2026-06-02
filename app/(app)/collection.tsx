import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { sharedScreenStyles } from '@/src/components/ui/NativePrimitives';
import { colors } from '@/src/lib/theme/tokens';

export default function CollectionHubScreen() {
  const openMyCollection = () => {
    router.push('/my-collection' as never);
  };

  const openCardSets = () => {
    router.push('/sets' as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Collector hub</Text>
          <Text style={styles.title}>Collection</Text>
          <Text style={styles.subtitle}>Manage your binder, chase list, and set checklists.</Text>
        </View>

        <View style={styles.list}>
          <HubRow
            eyebrow="Inventory"
            label="My Collection"
            meta="Owned cards, wanted cards, and collector progress"
            onPress={openMyCollection}
          />
          <HubRow
            eyebrow="Checklists"
            label="Browse Card Sets"
            meta="Set checklists, card search, and chase targets"
            onPress={openCardSets}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HubRow({
  eyebrow,
  label,
  meta,
  onPress,
}: {
  eyebrow: string;
  label: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed ? styles.rowPressed : null,
      ]}
    >
      <View style={styles.rowRail}>
        <Text style={styles.rowRailText}>FCS</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowEyebrow}>{eyebrow}</Text>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
      <Text style={styles.rowAction}>Open</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fbfaf7',
    flex: 1,
  },
  header: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderTopColor: colors.red,
    borderTopWidth: 3,
    borderWidth: 1,
    padding: 16,
  },
  kicker: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  list: {
    gap: 10,
    marginTop: 16,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 86,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowAction: {
    borderColor: colors.border,
    borderRadius: 4,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textTransform: 'uppercase',
  },
  rowEyebrow: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  rowLabel: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  rowMeta: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  rowPressed: {
    opacity: 0.62,
  },
  rowRail: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 4,
    height: 50,
    justifyContent: 'center',
    width: 42,
  },
  rowRailText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
    backgroundColor: '#fbfaf7',
  },
  subtitle: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
