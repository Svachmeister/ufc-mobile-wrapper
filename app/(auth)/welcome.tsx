import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Button, Text } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

const MARK_ASPECT_RATIO = 962 / 1118;

export default function Welcome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const markWidth = width * 0.7;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <View style={styles.topSpacer} />

      <View style={styles.markBlock}>
        <Image
          source={require('@/assets/images/logo_fightcardsociety_mark.png')}
          contentFit="contain"
          style={{ width: markWidth, aspectRatio: MARK_ASPECT_RATIO }}
        />
        <View style={styles.rule} />
        <Text variant="label" color="surface" style={styles.tagline}>
          Collect. Track. Compete.
        </Text>
      </View>

      <View style={styles.middleSpacer} />

      <View style={styles.buttons}>
        <Button label="Log in" onPress={() => router.push('/(auth)/sign-in')} style={styles.buttonGap} />
        <Button variant="outlineDark" label="Sign up" onPress={() => router.push('/(auth)/sign-up')} />
      </View>

      <View style={styles.bottomSpacer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.inverseBackground,
  },
  topSpacer: {
    height: '8%',
  },
  bottomSpacer: {
    height: '4%',
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
    letterSpacing: 3,
    opacity: 0.7,
    textAlign: 'center',
  },
  middleSpacer: {
    flex: 1,
  },
  buttons: {
    paddingHorizontal: spacing.xl,
  },
  buttonGap: {
    marginBottom: spacing.sm,
  },
});
