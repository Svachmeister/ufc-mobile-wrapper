import { PropsWithChildren } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

const SYMBOL_ASPECT_RATIO = 684 / 660;
const SYMBOL_HEIGHT = 72;
const BACK_TOUCH_TARGET = 44;

// Muted light-on-dark tone, local to this primitive — theme/tokens.ts is
// outside this ticket's editable scope and this colour is not used elsewhere.
const DARK_MUTED_TEXT = 'rgba(255, 255, 255, 0.6)';

type DarkAuthLayoutProps = PropsWithChildren<{
  title: string;
  subtitle: string;
}>;

export function DarkAuthLayout({ title, subtitle, children }: DarkAuthLayoutProps) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Pressable onPress={Keyboard.dismiss} style={styles.flex}>
            <View style={styles.topBand}>
              <Pressable
                onPress={() => router.back()}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="chevron-back" size={24} color={colors.surface} />
              </Pressable>
              <Image
                source={require('@/assets/images/logo_fcs_symbol.png')}
                contentFit="contain"
                style={{ height: SYMBOL_HEIGHT, aspectRatio: SYMBOL_ASPECT_RATIO }}
              />
            </View>

            <View style={styles.titleBlock}>
              <Text variant="heading" color="surface" style={styles.title}>
                {title}
              </Text>
              <Text variant="body" style={styles.subtitle}>
                {subtitle}
              </Text>
            </View>

            <View style={styles.body}>{children}</View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.inverseBackground,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topBand: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  backButton: {
    position: 'absolute',
    left: spacing.xl,
    top: 0,
    bottom: 0,
    width: BACK_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  titleBlock: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: DARK_MUTED_TEXT,
  },
  body: {
    flexGrow: 1,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
});
