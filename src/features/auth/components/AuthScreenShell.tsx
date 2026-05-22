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
        <View style={styles.brandBlock}>
          <Image
            source={require('../../../../assets/images/logo-fight-card-society.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>Fight Card Society</Text>
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.heading}>{heading}</Text>
          <View style={styles.rule} />
          <Text style={styles.tagline}>{tagline}</Text>
        </View>

        <View style={styles.formBlock}>{children}</View>

        <View style={styles.footer}>{footer}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.1,
    marginTop: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 30,
  },
  container: {
    backgroundColor: '#050505',
    flex: 1,
  },
  copyBlock: {
    marginBottom: 24,
  },
  footer: {
    alignItems: 'center',
    marginTop: 22,
  },
  formBlock: {
    gap: 14,
  },
  heading: {
    color: '#ffffff',
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: 1.4,
    lineHeight: 36,
    textTransform: 'uppercase',
  },
  logo: {
    height: 108,
    width: 108,
  },
  rule: {
    backgroundColor: '#dc2626',
    height: 3,
    marginBottom: 12,
    marginTop: 12,
    width: 56,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 28,
    paddingHorizontal: 22,
    paddingTop: 44,
  },
  tagline: {
    color: '#c7c7c7',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
});
