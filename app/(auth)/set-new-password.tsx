import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { Button, Screen, Text, TextField, TextLink } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { mapAuthError } from '@/lib/auth/errors';

export default function SetNewPassword() {
  const router = useRouter();
  const url = Linking.useURL();

  const [sessionReady, setSessionReady] = useState(false);
  const [linkError, setLinkError] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url || sessionReady) {
      return;
    }

    (async () => {
      const { queryParams } = Linking.parse(url);
      const code = queryParams?.code;
      const accessToken = queryParams?.access_token;
      const refreshToken = queryParams?.refresh_token;

      let exchangeError: { message: string } | null = null;

      if (typeof code === 'string') {
        const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
        exchangeError = codeError;
      } else if (typeof accessToken === 'string' && typeof refreshToken === 'string') {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        exchangeError = sessionError;
      } else {
        setLinkError('This reset link is invalid or has expired.');
        return;
      }

      if (exchangeError) {
        setLinkError('This reset link is invalid or has expired.');
        return;
      }

      setSessionReady(true);
    })();
  }, [url, sessionReady]);

  async function handleSetPassword() {
    setError(undefined);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(mapAuthError(updateError));
      return;
    }

    router.replace('/(tabs)/fantasy');
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Text variant="display" style={styles.wordmark}>
          Fight Card Society
        </Text>

        {linkError ? (
          <Text variant="body" color="brandRed" style={styles.message}>
            {linkError}
          </Text>
        ) : !sessionReady ? (
          <Text variant="body" style={styles.message}>
            Verifying your reset link…
          </Text>
        ) : (
          <>
            <TextField
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              editable={!loading}
            />
            <TextField
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
              editable={!loading}
              error={error}
            />

            <Button label="Set password" onPress={handleSetPassword} loading={loading} style={styles.submit} />
          </>
        )}

        <View style={styles.links}>
          <TextLink href="/(auth)/sign-in">Back to sign in</TextLink>
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
