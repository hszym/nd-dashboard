import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRole, type Role } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Personal API tokens let Claude (running on a team member's PC) call the
 * `/api/agent/*` routes without the Supabase service_role key. Only the SHA-256
 * hash of a token is stored; the token itself is shown once, when it is created.
 * Server-only (uses node:crypto and the service-role client).
 */

export const TOKEN_PREFIX = "nd_";
const TOKEN_RE = /^nd_[A-Za-z0-9_-]{43}$/;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A new random token (32 bytes, base64url) and its hash. */
export function generateToken(): { token: string; hash: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export interface AgentCaller {
  userId: string;
  role: Role;
  /** Service-role client: bypasses RLS, so routes must only touch what they validate. */
  admin: SupabaseClient;
}

export type AgentAuthResult =
  | { ok: true; caller: AgentCaller }
  | { ok: false; status: 401 | 503; error: string };

/**
 * Resolves the caller of an `/api/agent/*` request from `Authorization: Bearer nd_...`.
 * Rejects unknown or revoked tokens with the same generic 401.
 */
export async function requireAgent(request: NextRequest): Promise<AgentAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!TOKEN_RE.test(token)) {
    return { ok: false, status: 401, error: "Missing or invalid token." };
  }

  let admin: SupabaseClient;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false, status: 503, error: "The agent API is not configured on the server." };
  }

  const { data } = await admin
    .from("api_tokens")
    .select("id, user_id, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data || data.revoked_at) {
    return { ok: false, status: 401, error: "Missing or invalid token." };
  }

  // Best effort: lets members see when a token was last used.
  await admin
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  const role = await getRole(admin, data.user_id);
  return { ok: true, caller: { userId: data.user_id, role, admin } };
}
