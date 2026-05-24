import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { LoadingScreen } from '@/src/components/ui/ScreenState';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { colors } from '@/src/lib/theme/tokens';

type TabIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function tabIcon(name: TabIconName) {
  return function Icon({ color, focused, size }: { color: string; focused: boolean; size: number }) {
    return (
      <MaterialCommunityIcons
        color={color}
        name={name}
        size={focused ? size + 2 : size}
      />
    );
  };
}

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen label="Loading session" />;
  if (!isAuthenticated) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.red,
        tabBarIconStyle: {
          marginBottom: 1,
        },
        tabBarInactiveTintColor: colors.muted,
        tabBarItemStyle: {
          minWidth: 0,
          paddingHorizontal: 0,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '900',
          letterSpacing: 0.2,
          textTransform: 'uppercase',
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 74,
          paddingBottom: 12,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: tabIcon('view-dashboard-outline'),
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="fantasy"
        options={{
          tabBarIcon: tabIcon('trophy-outline'),
          tabBarLabel: 'Fantasy',
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          tabBarIcon: tabIcon('cards-outline'),
          tabBarLabel: 'Cards',
        }}
      />
      <Tabs.Screen
        name="sets"
        options={{
          tabBarIcon: tabIcon('format-list-bulleted-square'),
          tabBarLabel: 'Sets',
        }}
      />
      <Tabs.Screen
        name="fighters"
        options={{
          tabBarIcon: tabIcon('boxing-glove'),
          tabBarLabel: 'Fighters',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: tabIcon('account-circle-outline'),
          tabBarLabel: 'Profile',
        }}
      />
    </Tabs>
  );
}
