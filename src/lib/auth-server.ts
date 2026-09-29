import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * For admin-only Route Handlers: builds a request-scoped session client,
 * resolves the signed-in user + role, and returns both if the caller is an
 * admin — or null if not signed in or not an admin, so the route can bail
 * out with a 401/403 in one line. Server-only (pulls in next/headers) — keep
 * this out of @/lib/auth, which client components also import.
 */
export async function requireAdmin(): Promise<{
  supabase: SupabaseClient;
  user: User;
} | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = await getRole(supabase, user.id);
  if (role !== "admin") return null;
  return { supabase, user };
}
