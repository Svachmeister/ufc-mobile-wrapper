import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// SecureStore warns above 2048 bytes per value; Supabase session payloads can exceed that.
const CHUNK_SIZE = 1800;

async function getChunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${key}_chunks`);
  return raw ? parseInt(raw, 10) : 0;
}

const chunkedSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const chunkCount = await getChunkCount(key);
    if (chunkCount === 0) {
      return null;
    }

    const chunks: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
      if (chunk === null) {
        return null;
      }
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousChunkCount = await getChunkCount(key);

    const newChunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      newChunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    await Promise.all(newChunks.map((chunk, i) => SecureStore.setItemAsync(`${key}_${i}`, chunk)));

    for (let i = newChunks.length; i < previousChunkCount; i++) {
      await SecureStore.deleteItemAsync(`${key}_${i}`);
    }

    await SecureStore.setItemAsync(`${key}_chunks`, String(newChunks.length));
  },

  async removeItem(key: string): Promise<void> {
    const chunkCount = await getChunkCount(key);
    for (let i = 0; i < chunkCount; i++) {
      await SecureStore.deleteItemAsync(`${key}_${i}`);
    }
    await SecureStore.deleteItemAsync(`${key}_chunks`);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Set them in .env.local.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: chunkedSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
