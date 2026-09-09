import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider, useSession } from '@/lib/auth/SessionContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RootLayoutNav fontsLoaded={fontsLoaded} />
      </SessionProvider>
    </QueryClientProvider>
  );
}

function RootLayoutNav({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { session, isLoading: sessionLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const ready = fontsLoaded && !sessionLoading;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const isPasswordRecovery = inAuthGroup && segments[1] === 'set-new-password';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup && !isPasswordRecovery) {
      router.replace('/(tabs)/fantasy');
    }
  }, [ready, session, segments, router]);

  if (!ready) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
