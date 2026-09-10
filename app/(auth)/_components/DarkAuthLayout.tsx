import { PropsWithChildren } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';

import { colors, spacing } from '@/theme/tokens';

const MARK_ASPECT_RATIO = 962 / 1118;

export function DarkAuthLayout({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const markWidth = width * 0.4;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Pressable onPress={Keyboard.dismiss} style={styles.flex}>
            <View style={styles.markWrap}>
              <Image
                source={require('@/assets/images/logo_fightcardsociety_mark.png')}
                contentFit="contain"
                style={{ width: markWidth, aspectRatio: MARK_ASPECT_RATIO }}
              />
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
  markWrap: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
});
