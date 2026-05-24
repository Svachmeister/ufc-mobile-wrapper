import { Redirect, Tabs } from 'expo-router';

import { LoadingScreen } from '@/src/components/ui/ScreenState';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { colors } from '@/src/lib/theme/tokens';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen label="Loading session" />;
  if (!isAuthenticated) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '900',
          letterSpacing: 0.45,
          textTransform: 'uppercase',
        },
        tabBarStyle: {
          backgroundColor: '#0b0b0c',
          borderTopColor: colors.border,
          height: 72,
          paddingBottom: 14,
          paddingTop: 10,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="fantasy"
        options={{
          tabBarLabel: 'Fantasy',
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          tabBarLabel: 'Cards',
        }}
      />
      <Tabs.Screen
        name="sets"
        options={{
          tabBarLabel: 'Sets',
        }}
      />
      <Tabs.Screen
        name="fighters"
        options={{
          tabBarLabel: 'Fighters',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tabs>
  );
}
