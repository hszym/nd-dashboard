import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-only client using the service role key — bypasses RLS entirely and
 * can call the Supabase Auth admin API (list/create/delete users). NEVER
 * import this from a "use client" component or otherwise let it reach the
 * browser. Only use it after independently verifying the caller is an admin
 * via a normal per-request session client (see supabase-server.ts) — this
 * client has no notion of who's calling.
 */
export function createSupabaseAdminClient() {
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured — user management is unavailable until it's added as an env var."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** A short, random temporary password for a newly created account. */
export function generateTempPassword(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/[=+/]/g, "")
    .slice(0, 16);
}
