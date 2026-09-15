import { env } from '../config/env';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseAdmin = (): SupabaseClient | null => {
  if (supabaseClient) return supabaseClient;

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key && key.trim() !== '') {
    supabaseClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return supabaseClient;
  }

  return null;
};

export const getSupabaseBucket = (): string => {
  return env.SUPABASE_STORAGE_BUCKET;
};
