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
import { buildWebApiUrl } from '@/src/lib/webApi';

import { AuthScreenShell } from './AuthScreenShell';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;

type RegisterScreenProps = {
  onShowLogin: () => void;
};

export function RegisterScreen({ onShowLogin }: RegisterScreenProps) {
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');

  const handleRegister = async () => {
    const nextCountry = country.trim();
    const nextEmail = email.trim();
    const nextUsername = username.trim().toLowerCase();

    if (!usernamePattern.test(nextUsername)) {
      setError('Username must be 3-20 letters, numbers, or underscores.');
      return;
    }

    if (!emailPattern.test(nextEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (!nextCountry) {
      setError('Enter your country.');
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const availabilityUrl = buildWebApiUrl('/api/profile/username-availability', {
      username: nextUsername,
    });

    if (!availabilityUrl) {
      setIsSubmitting(false);
      setError('Username check is not configured.');
      return;
    }

    let availability: { available?: boolean; error?: string } = {};
    try {
      const availabilityResponse = await fetch(availabilityUrl);
      availability = await availabilityResponse.json();

      if (!availabilityResponse.ok) {
        setIsSubmitting(false);
        setError(availability.error || 'Could not verify that username.');
        return;
      }
    } catch {
      setIsSubmitting(false);
      setError('Could not verify that username.');
      return;
    }

    if (availability.available === false) {
      setIsSubmitting(false);
      setError('Username is already taken.');
      return;
    }

    if (availability.available !== true) {
      setIsSubmitting(false);
      setError('Could not verify that username.');
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: nextEmail,
      password,
      options: {
        data: {
          country: nextCountry,
          username: nextUsername,
        },
      },
    });

    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message || 'Unable to create account.');
      return;
    }

    if (!data.session) {
      setMessage('Check your email to confirm your account.');
      setPassword('');
    }
  };

  return (
    <AuthScreenShell
      heading="Join The Society"
      tagline="Start your collection. Complete your sets. Play Fantasy League."
      footer={
        <Pressable disabled={isSubmitting} onPress={onShowLogin}>
          <Text style={styles.switchText}>
            Already a member? <Text style={styles.switchAction}>Login</Text>
          </Text>
        </Pressable>
      }
    >
      <View style={styles.field}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setUsername}
          placeholder="fightfan"
          placeholderTextColor="#8a8a8a"
          style={styles.input}
          value={username}
        />
      </View>

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
            placeholder="Minimum 8 characters"
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

      <View style={styles.field}>
        <Text style={styles.label}>Country</Text>
        <TextInput
          autoCapitalize="words"
          onChangeText={setCountry}
          placeholder="Country"
          placeholderTextColor="#8a8a8a"
          style={styles.input}
          value={country}
        />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
      {message && <Text style={styles.messageText}>{message}</Text>}

      <Pressable
        disabled={isSubmitting}
        onPress={handleRegister}
        style={({ pressed }) => [
          styles.primaryButton,
          (pressed || isSubmitting) && styles.primaryButtonPressed,
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.primaryButtonText}>Create Account</Text>
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
  messageText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
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
