import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';

import { Button, Text, TextField, TextLink } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { mapAuthError } from '@/lib/auth/errors';
import { DarkAuthLayout } from './_components/DarkAuthLayout';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSendResetLink() {
    setError(undefined);
    setLoading(true);

    const redirectTo = Linking.createURL('set-new-password');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setLoading(false);

    if (resetError) {
      setError(mapAuthError(resetError));
      return;
    }

    setSent(true);
  }

  return (
    <DarkAuthLayout>
      {sent ? (
        <Text variant="body" color="surface" style={styles.message}>
          If an account exists for that email, a reset link is on its way.
        </Text>
      ) : (
        <>
          <TextField
            label="Email"
            appearance="dark"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!loading}
            error={error}
          />
          <Button label="Send reset link" onPress={handleSendResetLink} loading={loading} style={styles.submit} />
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
