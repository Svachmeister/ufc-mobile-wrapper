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
      heading="Sign In"
      tagline="Track your cards. Build your collection. Make your picks."
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
          placeholderTextColor="#8a8a8a"
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
            placeholderTextColor="#8a8a8a"
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
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  field: {
    gap: 7,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#151515',
    borderWidth: 1,
    color: '#080808',
    fontSize: 16,
    fontWeight: '700',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  label: {
    color: '#111111',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  passwordInput: {
    color: '#080808',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    minHeight: 50,
    paddingLeft: 14,
    paddingRight: 8,
  },
  passwordRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#151515',
    borderWidth: 1,
    flexDirection: 'row',
  },
  passwordToggle: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  passwordToggleText: {
    color: '#111111',
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
    minHeight: 52,
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
    color: '#dc2626',
  },
  switchText: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '800',
  },
});
