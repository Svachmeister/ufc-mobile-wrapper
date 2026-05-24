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
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarItemStyle: {
          minWidth: 0,
          paddingHorizontal: 0,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '900',
          letterSpacing: 0.25,
          textTransform: 'uppercase',
        },
        tabBarStyle: {
          backgroundColor: '#0b0b0c',
          borderTopColor: colors.border,
          height: 70,
          paddingBottom: 12,
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
