import type { SupabaseClient } from "@supabase/supabase-js";

export type Role = "admin" | "team";

export function isValidRole(value: string | undefined | null): value is Role {
  return value === "admin" || value === "team";
}

/**
 * Looks up the signed-in user's role from public.profiles. Falls back to the
 * least-privileged role ("team") if there's no user or no profile row yet —
 * new Supabase Auth users get a "team" profile automatically (see the
 * on_auth_user_created trigger), so this should only happen transiently.
 */
export async function getRole(
  supabase: SupabaseClient,
  userId: string | undefined | null
): Promise<Role> {
  if (!userId) return "team";
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return isValidRole(data?.role) ? data.role : "team";
}
