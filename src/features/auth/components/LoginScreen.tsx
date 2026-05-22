import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/src/lib/supabase';

import { AuthScreenShell } from './AuthScreenShell';

type LoginScreenProps = {
  onShowRegister: () => void;
};

export function LoginScreen({ onShowRegister }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setError('Enter your email and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message || 'Unable to log in.');
    }
  };

  return (
    <AuthScreenShell
      heading="Member Access"
      tagline="Track your collection. Play fantasy. Join the society."
      footer={
        <Pressable disabled={isSubmitting} onPress={onShowRegister}>
          <Text style={styles.switchText}>
            New here? <Text style={styles.switchAction}>Create an account</Text>
          </Text>
        </Pressable>
      }
    >
      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="member@email.com"
          placeholderTextColor="#686868"
          style={styles.input}
          value={email}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#686868"
            secureTextEntry={!showPassword}
            style={styles.passwordInput}
            value={password}
          />
          <Pressable
            hitSlop={10}
            onPress={() => setShowPassword((nextValue) => !nextValue)}
            style={styles.passwordToggle}
          >
            <Text style={styles.passwordToggleText}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        </View>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        disabled={isSubmitting}
        onPress={handleLogin}
        style={({ pressed }) => [
          styles.primaryButton,
          (pressed || isSubmitting) && styles.primaryButtonPressed,
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.primaryButtonText}>Login</Text>
        )}
      </Pressable>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  field: {
    gap: 7,
  },
  input: {
    backgroundColor: '#111111',
    borderBottomColor: '#c9c9c9',
    borderBottomWidth: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  label: {
    color: '#a9a9a9',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  passwordInput: {
    color: '#ffffff',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    minHeight: 52,
    paddingLeft: 14,
    paddingRight: 8,
  },
  passwordRow: {
    alignItems: 'center',
    backgroundColor: '#111111',
    borderBottomColor: '#c9c9c9',
    borderBottomWidth: 1,
    flexDirection: 'row',
  },
  passwordToggle: {
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  passwordToggleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 54,
  },
  primaryButtonPressed: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  switchAction: {
    color: '#ffffff',
  },
  switchText: {
    color: '#a8a8a8',
    fontSize: 14,
    fontWeight: '800',
  },
});
