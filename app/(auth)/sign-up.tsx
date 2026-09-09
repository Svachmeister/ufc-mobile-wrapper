import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text, TextField, TextLink } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { mapAuthError } from '@/lib/auth/errors';

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

  if (confirmationSent) {
    return (
      <Screen>
        <View style={styles.content}>
          <Text variant="display" style={styles.wordmark}>
            Fight Card Society
          </Text>
          <Text variant="body" style={styles.message}>
            Check your email to confirm your account before signing in.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Text variant="display" style={styles.wordmark}>
          Fight Card Society
        </Text>

        <TextField label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" editable={!loading} />
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
          textContentType="newPassword"
          editable={!loading}
          error={error}
        />

        <Button label="Create account" onPress={handleSignUp} loading={loading} style={styles.submit} />

        <View style={styles.links}>
          <TextLink href="/(auth)/sign-in">Already have an account? Sign in</TextLink>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  wordmark: {
    textAlign: 'center',
    marginBottom: spacing.xxl,
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
