import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, Text } from 'react-native';

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

function tabLabel(label: string) {
  return function Label({ color }: { color: string; focused: boolean }) {
    return (
      <Text numberOfLines={2} style={[styles.tabLabel, { color }]}>
        {label}
      </Text>
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
          fontSize: 8,
          fontWeight: '900',
          letterSpacing: 0,
          textTransform: 'uppercase',
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 74,
          paddingBottom: 10,
          paddingTop: 7,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: tabIcon('view-dashboard-outline'),
          tabBarLabel: tabLabel('Society'),
        }}
      />
      <Tabs.Screen
        name="fantasy"
        options={{
          tabBarIcon: tabIcon('trophy-outline'),
          tabBarLabel: tabLabel('Fantasy'),
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          tabBarIcon: tabIcon('cards-outline'),
          tabBarLabel: tabLabel('Collection'),
        }}
      />
      <Tabs.Screen
        name="sets"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="fighters"
        options={{
          tabBarIcon: tabIcon('boxing-glove'),
          tabBarLabel: tabLabel('Fighters'),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          tabBarIcon: tabIcon('menu'),
          tabBarLabel: tabLabel('Menu'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="my-collection"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="one-of-ones"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="report-one-of-one"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 8.5,
    textAlign: 'center',
    textTransform: 'uppercase',
    width: 74,
  },
});
