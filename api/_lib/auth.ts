// api/_lib/auth.ts — Server-side Supabase auth verification
// Shared helper for API routes. Never trusts x-user-id header as identity.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';

export type AuthResult = {
  /** Verified Supabase user ID, or null if not authenticated */
  userId: string | null;
  /** True only when a valid Bearer token was verified */
  isAuthenticated: boolean;
  /** Error message if verification failed (not logged to client) */
  error: string | null;
};

let supabaseAuthClient: ReturnType<typeof createClient> | null = null;

function getSupabaseAuthClient() {
  if (supabaseAuthClient) return supabaseAuthClient;
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const key =
    process.env.SUPABASE_WORKER_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  if (!url || !key) return null;
  supabaseAuthClient = createClient(url, key);
  return supabaseAuthClient;
}

/**
 * Verify Bearer token from Authorization header.
 * Returns AuthResult with verified user ID or null.
 * Never returns x-user-id as authenticated identity.
 */
export async function verifyAuth(
  req: VercelRequest
): Promise<AuthResult> {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { userId: null, isAuthenticated: false, error: null };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { userId: null, isAuthenticated: false, error: 'empty_token' };
  }

  const supabase = getSupabaseAuthClient();
  if (!supabase) {
    return { userId: null, isAuthenticated: false, error: 'supabase_unavailable' };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
      return { userId: null, isAuthenticated: false, error: 'invalid_token' };
    }
    return { userId: data.user.id, isAuthenticated: true, error: null };
  } catch {
    return { userId: null, isAuthenticated: false, error: 'verification_failed' };
  }
}
