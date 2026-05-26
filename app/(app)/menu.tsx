import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { sharedScreenStyles } from '@/src/components/ui/NativePrimitives';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { colors } from '@/src/lib/theme/tokens';

export default function MenuScreen() {
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const openProfile = () => {
    router.push('/profile' as never);
  };

  const openWebTools = () => {
    router.push('/web-fallback' as never);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await signOut();
    } catch {
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Menu</Text>
        <View style={styles.list}>
          <MenuRow label="Profile" onPress={openProfile} />
          <MenuRow label="Web Tools" onPress={openWebTools} />
          <MenuRow
            disabled={isSigningOut}
            label={isSigningOut ? 'Signing Out...' : 'Sign Out'}
            onPress={handleSignOut}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed || disabled ? styles.rowPressed : null,
      ]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  list: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    minHeight: 58,
    justifyContent: 'center',
  },
  rowLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  rowPressed: {
    opacity: 0.62,
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
    backgroundColor: '#ffffff',
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 18,
  },
});
