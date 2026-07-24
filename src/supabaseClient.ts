import { createClient } from '@supabase/supabase-js';

// Fallback default credentials if Vercel environment variables are not configured in Vercel dashboard
const DEFAULT_SUPABASE_URL = 'https://jqxxfntzjkjoebgzeqxv.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_ATg7m6Y4xDlC57iT_w0OHA_Rpoy06lq';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

// Cek apakah url valid
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('ganti-dengan-project-id-anda') && 
  !supabaseAnonKey.includes('ganti-dengan-anon-key-anda')
);

export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

