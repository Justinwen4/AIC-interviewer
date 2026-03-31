import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

let _client: SupabaseClient | null = null;

/** Server-only Supabase client with service role (bypasses RLS). */
export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;
  const env = getServerEnv();
  _client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
