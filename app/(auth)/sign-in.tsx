import { useState } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';

import { Button, TextField, TextLink } from '@/components/ui';
import { colors, spacing, typography } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { logAuthError, mapAuthError } from '@/lib/auth/errors';
import { DarkAuthLayout } from '@/features/auth/DarkAuthLayout';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(undefined);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        logAuthError('sign-in', signInError);
        setError(mapAuthError(signInError));
      }
    } catch (thrownError) {
      logAuthError('sign-in (thrown)', thrownError);
      setError(mapAuthError(thrownError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <DarkAuthLayout title="Welcome back" subtitle="Sign in to your Fight Card Society account.">
      <TextField
        label="Email"
        appearance="dark"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@email.com"
        editable={!loading}
      />
      <TextField
        label="Password"
        appearance="dark"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        editable={!loading}
        error={error}
      />

      <View style={styles.forgotRow}>
        <TextLink href="/(auth)/forgot-password" appearance="dark" style={styles.forgotLink}>
          Forgot password?
        </TextLink>
      </View>

      <Button label="Sign in" onPress={handleSignIn} loading={loading} style={styles.submit} />

      <TextLink href="/(auth)/sign-up" appearance="dark" style={styles.secondaryLine}>
        New to Fight Card Society? <RNText style={styles.secondaryEmphasis}>Create account</RNText>
      </TextLink>
    </DarkAuthLayout>
  );
}

const styles = StyleSheet.create({
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  forgotLink: {
    textAlign: 'right',
  },
  submit: {
    marginTop: spacing.sm,
  },
  secondaryLine: {
    marginTop: spacing.lg,
  },
  secondaryEmphasis: {
    fontFamily: typography.fontFamily.heading,
    color: colors.surface,
    textTransform: 'uppercase',
  },
});
