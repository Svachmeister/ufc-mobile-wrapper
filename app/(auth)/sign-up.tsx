import { useState } from 'react';
import { StyleSheet, Text as RNText } from 'react-native';

import { Button, Text, TextField, TextLink } from '@/components/ui';
import { colors, spacing, typography } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { logAuthError, mapAuthError } from '@/lib/auth/errors';
import { DarkAuthLayout } from '@/features/auth/DarkAuthLayout';

function getConfirmPasswordError(password: string, confirmPassword: string): string | undefined {
  if (password && !confirmPassword) {
    return 'Please confirm your password.';
  }

  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }

  return undefined;
}

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const confirmPasswordError = getConfirmPasswordError(password, confirmPassword);

  async function handleSignUp() {
    setError(undefined);

    if (confirmPasswordError) {
      setConfirmTouched(true);
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });

      if (signUpError) {
        logAuthError('sign-up', signUpError);
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
    } catch (thrownError) {
      logAuthError('sign-up (thrown)', thrownError);
      setError(mapAuthError(thrownError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <DarkAuthLayout title="Join the society" subtitle="Create your collector profile.">
      {confirmationSent ? (
        <Text variant="body" color="surface" style={styles.message}>
          Check your email to confirm your account before logging in.
        </Text>
      ) : (
        <>
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
            placeholder="your@email.com"
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
          <TextField
            label="Confirm password"
            appearance="dark"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onBlur={() => setConfirmTouched(true)}
            secureTextEntry
            textContentType="newPassword"
            editable={!loading}
            error={confirmTouched ? confirmPasswordError : undefined}
          />

          <Button label="Create account" onPress={handleSignUp} loading={loading} style={styles.submit} />

          <TextLink href="/(auth)/sign-in" appearance="dark" style={styles.secondaryLine}>
            Already a member? <RNText style={styles.secondaryEmphasis}>Log in</RNText>
          </TextLink>
        </>
      )}
    </DarkAuthLayout>
  );
}

const styles = StyleSheet.create({
  message: {
    textAlign: 'center',
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
