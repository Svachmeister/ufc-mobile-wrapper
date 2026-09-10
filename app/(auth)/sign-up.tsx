import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Text, TextField, TextLink } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { mapAuthError } from '@/lib/auth/errors';
import { DarkAuthLayout } from './_components/DarkAuthLayout';

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSignUp() {
    setError(undefined);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (signUpError) {
      setLoading(false);
      setError(mapAuthError(signUpError));
      return;
    }

    if (data.session && data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', data.user.id)
        .single();

      if (!profile?.username) {
        await supabase.from('profiles').update({ username }).eq('id', data.user.id);
      }
    } else {
      setConfirmationSent(true);
    }

    setLoading(false);
  }

  const backRow = (
    <View style={styles.backRow}>
      <TextLink href="/(auth)/welcome" appearance="dark" style={styles.backLink}>
        ← Back
      </TextLink>
    </View>
  );

  if (confirmationSent) {
    return (
      <DarkAuthLayout>
        {backRow}
        <Text variant="body" color="surface" style={styles.message}>
          Check your email to confirm your account before signing in.
        </Text>
      </DarkAuthLayout>
    );
  }

  return (
    <DarkAuthLayout>
      {backRow}

      <TextField
        label="Username"
        appearance="dark"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        editable={!loading}
      />
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
        textContentType="newPassword"
        editable={!loading}
        error={error}
      />

      <Button label="Create account" onPress={handleSignUp} loading={loading} style={styles.submit} />

      <View style={styles.links}>
        <TextLink href="/(auth)/sign-in" appearance="dark">
          Already have an account? Sign in
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
  message: {
    textAlign: 'center',
  },
  submit: {
    marginTop: spacing.sm,
  },
  links: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
});
