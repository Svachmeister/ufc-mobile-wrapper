import type { ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type AuthScreenShellProps = {
  children: ReactNode;
  footer: ReactNode;
  heading: string;
  tagline: string;
};

export function AuthScreenShell({
  children,
  footer,
  heading,
  tagline,
}: AuthScreenShellProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoBlock}>
          <Image
            source={require('../../../../assets/images/logo_fightcardsociety.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.formSurface}>
          <View style={styles.copyBlock}>
            <Text style={styles.heading}>{heading}</Text>
            <View style={styles.rule} />
            <Text style={styles.tagline}>{tagline}</Text>
          </View>

          <View style={styles.formBlock}>{children}</View>

          <View style={styles.footer}>{footer}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  copyBlock: {
    marginBottom: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 18,
  },
  formBlock: {
    gap: 13,
  },
  formSurface: {
    paddingHorizontal: 22,
    paddingTop: 2,
    zIndex: 1,
  },
  heading: {
    color: '#080808',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1.2,
    lineHeight: 29,
    textTransform: 'uppercase',
  },
  logo: {
    height: 276,
    width: 276,
    zIndex: 1,
  },
  logoBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 0,
    paddingHorizontal: 22,
    paddingTop: 18,
    zIndex: 1,
  },
  rule: {
    backgroundColor: '#dc2626',
    height: 3,
    marginBottom: 10,
    marginTop: 9,
    width: 58,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 26,
    position: 'relative',
  },
  tagline: {
    color: '#3b3b3b',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
