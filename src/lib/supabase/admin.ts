import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

let _client: SupabaseClient | null = null;

function assertServiceRoleKey(key: string): void {
  if (key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is the publishable (anon) key. Server routes need the service_role secret: Supabase → Project Settings → API → “service_role” (not “anon” / publishable). Paste it into .env.local and restart the dev server.",
    );
  }
}

/** Server-only Supabase client with service role (bypasses RLS). */
export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;
  const env = getServerEnv();
  assertServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY);
  _client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
