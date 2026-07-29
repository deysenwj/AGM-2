import { createClient } from '@supabase/supabase-js';

// Fallback default credentials if Vercel environment variables are not configured in Vercel dashboard
const DEFAULT_SUPABASE_URL = 'https://raizwhqfiowyzbhiwbnq.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_Yv1DNnIWI-PJUbQwdTfttQ_ji6W4Ssj';

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
    // ponytail: disable auto-connect realtime to save mobile bandwidth;
    // channels are explicitly subscribed in App.tsx
    realtime: {
      params: {
        eventsPerSecond: 40,
      },
    },
    global: {
      // 10s fetch timeout for slow mobile connections
      fetch: (url, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        return fetch(url, {
          ...options,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));
      },
    },
  }
);
