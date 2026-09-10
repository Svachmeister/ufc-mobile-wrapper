import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { Button, Text, TextField, TextLink } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { logAuthError, mapAuthError } from '@/lib/auth/errors';
import { DarkAuthLayout } from '@/features/auth/DarkAuthLayout';

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
      try {
        const { queryParams } = Linking.parse(url);
        const code = queryParams?.code;
        const accessToken = queryParams?.access_token;
        const refreshToken = queryParams?.refresh_token;

        let exchangeError: unknown = null;

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
          logAuthError('set-new-password (no code/tokens in link)', { url });
          setLinkError('This reset link is invalid or has expired.');
          return;
        }

        if (exchangeError) {
          logAuthError('set-new-password (exchange)', exchangeError);
          setLinkError('This reset link is invalid or has expired.');
          return;
        }

        setSessionReady(true);
      } catch (thrownError) {
        logAuthError('set-new-password (exchange thrown)', thrownError);
        setLinkError('This reset link is invalid or has expired.');
      }
    })();
  }, [url, sessionReady]);

  async function handleSetPassword() {
    setError(undefined);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        logAuthError('set-new-password', updateError);
        setError(mapAuthError(updateError));
        return;
      }

      router.replace('/(tabs)/fantasy');
    } catch (thrownError) {
      logAuthError('set-new-password (thrown)', thrownError);
      setError(mapAuthError(thrownError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <DarkAuthLayout>
      {linkError ? (
        <Text variant="body" color="brandRed" style={styles.message}>
          {linkError}
        </Text>
      ) : !sessionReady ? (
        <Text variant="body" color="surface" style={styles.message}>
          Verifying your reset link…
        </Text>
      ) : (
        <>
          <TextField
            label="New password"
            appearance="dark"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            editable={!loading}
          />
          <TextField
            label="Confirm password"
            appearance="dark"
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
        <TextLink href="/(auth)/sign-in" appearance="dark">
          Back to sign in
        </TextLink>
      </View>
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
  links: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
});
