import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Button, Text } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

const MARK_ASPECT_RATIO = 879 / 911;

export default function Welcome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const markWidth = width * 0.7;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <View style={styles.content}>
        <View style={styles.markBlock}>
          <Image
            source={require('@/assets/images/logo_fcs_flat.png')}
            contentFit="contain"
            style={{ width: markWidth, aspectRatio: MARK_ASPECT_RATIO }}
          />
          <View style={styles.rule} />
          <Text variant="label" color="surface" style={styles.tagline}>
            One passion. One place. One society.
          </Text>
        </View>

        <View style={styles.buttons}>
          <Button label="Log in" onPress={() => router.push('/(auth)/sign-in')} style={styles.buttonGap} />
          <Button variant="outlineDark" label="Create account" onPress={() => router.push('/(auth)/sign-up')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.inverseBackground,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  markBlock: {
    alignItems: 'center',
  },
  rule: {
    width: 48,
    height: 2,
    backgroundColor: colors.brandRed,
    marginTop: spacing.lg,
  },
  tagline: {
    marginTop: spacing.md,
    fontSize: 13,
    letterSpacing: 2,
    opacity: 0.7,
    textAlign: 'center',
  },
  buttons: {
    marginTop: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
  },
  buttonGap: {
    marginBottom: spacing.sm,
  },
});
