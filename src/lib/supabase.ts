import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseAdmin = (): SupabaseClient | null => {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  return process.env.SUPABASE_STORAGE_BUCKET || 'campus-media';
};
