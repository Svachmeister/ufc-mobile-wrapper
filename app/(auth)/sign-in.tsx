import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text, TextField, TextLink } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { mapAuthError } from '@/lib/auth/errors';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(undefined);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError(mapAuthError(signInError));
    }
  }

  return (
    <Screen>
      <View style={styles.backRow}>
        <TextLink href="/(auth)/welcome" style={styles.backLink}>
          ← Back
        </TextLink>
      </View>
      <View style={styles.content}>
        <Text variant="display" style={styles.wordmark}>
          Fight Card Society
        </Text>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!loading}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          editable={!loading}
          error={error}
        />

        <Button label="Sign in" onPress={handleSignIn} loading={loading} style={styles.submit} />

        <View style={styles.links}>
          <TextLink href="/(auth)/forgot-password">Forgot password?</TextLink>
          <TextLink href="/(auth)/sign-up" style={styles.secondLink}>
            Create account
          </TextLink>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    alignItems: 'flex-start',
  },
  backLink: {
    textAlign: 'left',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  wordmark: {
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  submit: {
    marginTop: spacing.sm,
  },
  links: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  secondLink: {
    marginTop: spacing.sm,
  },
});
