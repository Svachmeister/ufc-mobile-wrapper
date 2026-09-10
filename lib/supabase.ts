import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// SecureStore warns above 2048 bytes per value; Supabase session payloads can exceed that.
const CHUNK_SIZE = 1800;

// Tolerant: a missing/corrupt/non-numeric count is treated as "no chunks"
// rather than propagating NaN (which would make every loop below a silent
// no-op and getItem return '' instead of null — a real, previously-present bug).
async function getChunkCount(key: string): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(`${key}_chunks`);
    if (!raw) {
      return 0;
    }
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch (error) {
    console.error('[secure-store] getChunkCount failed', key, error);
    return 0;
  }
}

// Best-effort cleanup used both by removeItem and by getItem when it finds a
// corrupt/partial value. Never throws — a failed delete here must not block
// sign-out or block treating a bad read as "no session".
async function clearChunks(key: string, chunkCount: number): Promise<void> {
  const deletions = Array.from({ length: chunkCount }, (_, i) =>
    SecureStore.deleteItemAsync(`${key}_${i}`).catch((error) => {
      console.error('[secure-store] failed to delete chunk', `${key}_${i}`, error);
    }),
  );
  await Promise.all(deletions);
  await SecureStore.deleteItemAsync(`${key}_chunks`).catch((error) => {
    console.error('[secure-store] failed to delete chunk count key', `${key}_chunks`, error);
  });
}

const chunkedSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const chunkCount = await getChunkCount(key);
    if (chunkCount === 0) {
      return null;
    }

    try {
      const chunks: string[] = [];
      for (let i = 0; i < chunkCount; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
        if (chunk === null) {
          throw new Error(`Missing chunk ${i} of ${chunkCount} for "${key}"`);
        }
        chunks.push(chunk);
      }
      return chunks.join('');
    } catch (error) {
      // A partial/corrupt stored value must never surface as a thrown error
      // to Supabase — treat it as "no session", and clear the wreckage so
      // the next read doesn't repeat the same failure.
      console.error('[secure-store] getItem found a corrupt/partial value, clearing', key, error);
      await clearChunks(key, chunkCount);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousChunkCount = await getChunkCount(key);

    const newChunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      newChunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    try {
      await Promise.all(newChunks.map((chunk, i) => SecureStore.setItemAsync(`${key}_${i}`, chunk)));

      for (let i = newChunks.length; i < previousChunkCount; i++) {
        await SecureStore.deleteItemAsync(`${key}_${i}`);
      }

      // Written last and only once every chunk succeeded, so a failed write
      // above leaves the previous, still-valid chunk set in place rather
      // than pointing at a partially-written one.
      await SecureStore.setItemAsync(`${key}_chunks`, String(newChunks.length));
    } catch (error) {
      console.error('[secure-store] setItem failed, value was not fully stored', key, error);
      throw error;
    }
  },

  async removeItem(key: string): Promise<void> {
    const chunkCount = await getChunkCount(key);
    await clearChunks(key, chunkCount);
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
