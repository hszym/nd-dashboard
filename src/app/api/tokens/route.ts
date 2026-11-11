import { NextRequest, NextResponse } from "next/server";
import { generateToken } from "@/lib/agent-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Personal API tokens for Claude. Session-authenticated: a member only ever sees
// and manages their own tokens (RLS enforces it too).

const MAX_ACTIVE_TOKENS = 10;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, name, created_at, last_used_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tokens: data ?? [] });
}

/** Creates a token and returns it once; only its hash is stored. */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "Give the token a name." }, { status: 400 });

  const { count } = await supabase
    .from("api_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS) {
    return NextResponse.json(
      { error: `You already have ${MAX_ACTIVE_TOKENS} active tokens. Revoke one first.` },
      { status: 400 }
    );
  }

  const { token, hash } = generateToken();
  const { data, error } = await supabase
    .from("api_tokens")
    .insert({ user_id: user.id, name, token_hash: hash })
    .select("id, name, created_at")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not create the token." }, { status: 500 });
  }
  return NextResponse.json({ token, id: data.id, name: data.name, created_at: data.created_at });
}
