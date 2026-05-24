import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ScreenHeader,
  WebFallbackButton,
  sharedScreenStyles,
} from '@/src/components/ui/NativePrimitives';
import { LoadingScreen, ScreenState } from '@/src/components/ui/ScreenState';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { type NativeProfile, loadNativeProfile } from '@/src/lib/profile';
import { colors } from '@/src/lib/theme/tokens';

function shortenUserId(value?: string | null) {
  if (!value) return 'Unavailable';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getConfigStatus() {
  return {
    supabase: Boolean(
      process.env.EXPO_PUBLIC_SUPABASE_URL &&
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ),
    webApi: Boolean(process.env.EXPO_PUBLIC_WEB_API_BASE_URL?.trim()),
  };
}

export function ProfileScreen() {
  const { signOut, user } = useAuth();
  const [profile, setProfile] = useState<NativeProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const configStatus = useMemo(() => getConfigStatus(), []);
  const displayName = profile?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || 'Member';

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;

    const result = await loadNativeProfile(user.id);
    setError(result.error);
    setProfile(result.profile);
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      await loadProfile();
      if (mounted) setIsLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [loadProfile]);

  const refresh = async () => {
    setIsRefreshing(true);
    await loadProfile();
    setIsRefreshing(false);
  };

  const openWebFallback = () => {
    router.push('/web-fallback' as never);
  };

  const handleLogout = async () => {
    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      await signOut();
    } catch {
      setLogoutError('Could not sign out. Try again.');
      setIsLoggingOut(false);
    }
  };

  if (isLoading) return <LoadingScreen label="Loading profile" />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.text}
            onRefresh={refresh}
          />
        }
      >
        <ScreenHeader
          action={<WebFallbackButton onPress={openWebFallback} />}
          title="Profile"
        />

        {error ? (
          <ScreenState
            actionLabel="Try again"
            message="Your native profile could not be loaded. Pull to refresh or retry."
            onAction={loadProfile}
            title="Profile unavailable"
          />
        ) : null}

        <View style={styles.hero}>
          <Text style={styles.kicker}>Member settings</Text>
          <Text style={styles.heroTitle}>{displayName}</Text>
          <Text style={styles.heroText}>
            Native profile is read-only for this milestone. Account editing remains in the web experience until the next profile pass.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.kicker}>Account</Text>
          <View style={styles.infoList}>
            <InfoRow label="Email" value={user?.email || 'Unavailable'} />
            <InfoRow label="Username" value={profile?.username || 'Not set'} />
            <InfoRow label="Country" value={profile?.country || 'Not set'} />
            <InfoRow label="User ID" value={shortenUserId(user?.id)} />
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.kicker}>App status</Text>
          <View style={styles.statusGrid}>
            <StatusTile label="Supabase" ok={configStatus.supabase} />
            <StatusTile label="Web API" ok={configStatus.webApi} />
          </View>
          <Text style={styles.panelText}>
            These checks only confirm native environment variables are present. They do not expose secrets.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.kicker}>Profile tools</Text>
          <Text style={styles.sectionTitle}>Editing coming later</Text>
          <Text style={styles.panelText}>
            Username, country, avatar, and profile details are view-only in this native milestone.
          </Text>
          <WebFallbackButton
            label="Open WebView fallback"
            onPress={openWebFallback}
            style={styles.secondaryButton}
            textStyle={styles.secondaryButtonText}
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.kicker}>Session</Text>
          <Text style={styles.panelText}>
            Sign out of the native app and return to the login/register flow.
          </Text>
          {logoutError ? <Text style={styles.errorText}>{logoutError}</Text> : null}
          <Pressable
            disabled={isLoggingOut}
            onPress={handleLogout}
            style={[styles.logoutButton, isLoggingOut ? styles.disabledButton : null]}
          >
            <Text style={styles.logoutButtonText}>
              {isLoggingOut ? 'Signing out...' : 'Logout'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatusTile({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={styles.statusTile}>
      <Text style={styles.statusValue}>{ok ? 'Yes' : 'No'}</Text>
      <Text style={styles.statusLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  disabledButton: {
    opacity: 0.62,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 12,
  },
  hero: {
    backgroundColor: colors.panel,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: colors.accent,
    borderTopWidth: 3,
    borderWidth: 1,
    padding: 18,
  },
  heroText: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 32,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    width: 86,
  },
  infoList: {
    gap: 10,
    marginTop: 14,
  },
  infoRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 13,
  },
  infoValue: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  kicker: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  logoutButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 16,
  },
  panelText: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.1,
    lineHeight: 24,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statusLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 5,
    textTransform: 'uppercase',
  },
  statusTile: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderWidth: 1,
    flex: 1,
    padding: 13,
  },
  statusValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
});
