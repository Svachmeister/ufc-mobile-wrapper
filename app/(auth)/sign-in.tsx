import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, TextField, TextLink } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { mapAuthError } from '@/lib/auth/errors';
import { DarkAuthLayout } from './_components/DarkAuthLayout';

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
    <DarkAuthLayout>
      <View style={styles.backRow}>
        <TextLink href="/(auth)/welcome" appearance="dark" style={styles.backLink}>
          ← Back
        </TextLink>
      </View>

      <TextField
        label="Email"
        appearance="dark"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
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

      <Button label="Sign in" onPress={handleSignIn} loading={loading} style={styles.submit} />

      <View style={styles.links}>
        <TextLink href="/(auth)/forgot-password" appearance="dark">
          Forgot password?
        </TextLink>
        <TextLink href="/(auth)/sign-up" appearance="dark" style={styles.secondLink}>
          Create account
        </TextLink>
      </View>
    </DarkAuthLayout>
  );
}

const styles = StyleSheet.create({
  backRow: {
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  backLink: {
    textAlign: 'left',
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
