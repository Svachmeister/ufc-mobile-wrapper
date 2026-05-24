import { supabase } from '@/src/lib/supabase';

export type NativeProfile = {
  country: string | null;
  username: string | null;
};

export async function loadNativeProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('username,country')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return {
      error: 'Could not load profile.',
      profile: null,
    };
  }

  return {
    error: null,
    profile: (data as NativeProfile | null) ?? null,
  };
}
