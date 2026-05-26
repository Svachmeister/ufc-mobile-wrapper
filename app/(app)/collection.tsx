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
        <Text style={styles.title}>Collection</Text>
        <Text style={styles.subtitle}>Your cards and set checklists live here.</Text>

        <View style={styles.list}>
          <HubRow
            label="My Collection"
            meta="Owned cards, wanted list, and collector progress"
            onPress={openMyCollection}
          />
          <HubRow
            label="Browse Card Sets"
            meta="Set checklists and card browsing"
            onPress={openCardSets}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HubRow({
  label,
  meta,
  onPress,
}: {
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
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
      <Text style={styles.rowAction}>Open</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  list: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 22,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 72,
    paddingVertical: 14,
  },
  rowAction: {
    color: colors.red,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  rowLabel: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  rowMeta: {
    color: colors.gray500,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  rowPressed: {
    opacity: 0.62,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
    backgroundColor: '#ffffff',
  },
  subtitle: {
    color: colors.gray500,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 6,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});
