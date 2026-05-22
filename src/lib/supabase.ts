import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const resolvedSupabaseUrl = supabaseUrl || 'https://example.supabase.co';
const resolvedSupabaseAnonKey = supabaseAnonKey || 'missing-anon-key';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Native Supabase auth will not work until these are configured.',
  );
}

const auth = new AuthClient({
  url: `${resolvedSupabaseUrl}/auth/v1`,
  headers: {
    apikey: resolvedSupabaseAnonKey,
    Authorization: `Bearer ${resolvedSupabaseAnonKey}`,
  },
  storage: AsyncStorage,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
});

const rest = new PostgrestClient(`${resolvedSupabaseUrl}/rest/v1`, {
  headers: {
    apikey: resolvedSupabaseAnonKey,
    Authorization: `Bearer ${resolvedSupabaseAnonKey}`,
  },
  fetch: async (input, init = {}) => {
    const {
      data: { session },
    } = await auth.getSession();
    const headers = new Headers(init.headers);

    headers.set('apikey', resolvedSupabaseAnonKey);
    headers.set('Authorization', `Bearer ${session?.access_token || resolvedSupabaseAnonKey}`);

    return fetch(input, {
      ...init,
      headers,
    });
  },
});

export const supabase = {
  auth,
  from: rest.from.bind(rest),
};

export type MobileSupabaseClient = typeof supabase;

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      auth.startAutoRefresh();
    } else {
      auth.stopAutoRefresh();
    }
  });
}
