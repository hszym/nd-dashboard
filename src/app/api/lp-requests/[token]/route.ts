import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { lpValuesToRow, sanitizeLpValues, validateLp } from "@/lib/lp";

// Public endpoints (no login): the only thing that makes them safe is that the
// token is an unguessable single-use secret, so they return as little as
// possible and never touch anything except the request the token names.

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const UNAVAILABLE = "This link is no longer available. Please ask for a new one.";

type RequestState = "open" | "used" | "expired" | "revoked" | "invalid";

function adminOrNull() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

/** Link status plus (only when open) the deal name to show on the form. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ state: "invalid" satisfies RequestState });
  }
  const admin = adminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }

  const { data } = await admin
    .from("lp_requests")
    .select("status, expires_at, cases(name)")
    .eq("token", token)
    .maybeSingle();
  if (!data) {
    return NextResponse.json({ state: "invalid" satisfies RequestState });
  }

  let state: RequestState = "open";
  if (data.status === "submitted") state = "used";
  else if (data.status === "revoked") state = "revoked";
  else if (new Date(data.expires_at).getTime() <= Date.now()) state = "expired";

  if (state !== "open") return NextResponse.json({ state });

  const relation = data.cases as { name: string } | { name: string }[] | null;
  const dealName = Array.isArray(relation) ? relation[0]?.name : relation?.name;
  return NextResponse.json({ state, dealName: dealName ?? null });
}

/** Submits the LP's details once: creates the LP row and closes the link. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: UNAVAILABLE }, { status: 404 });
  }

  const body = await request.json().catch(() => null);

  // Honeypot: real people never fill the hidden field; pretend success to bots.
  if (typeof body?.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const values = sanitizeLpValues(body?.values);
  const problem = validateLp(values, true);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const admin = adminOrNull();
  if (!admin) {
    return NextResponse.json(
      { error: "This form is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  // Atomically claim the link so it can only ever be used once.
  const now = new Date().toISOString();
  const { data: claimed } = await admin
    .from("lp_requests")
    .update({ status: "submitted", submitted_at: now, data: values })
    .eq("token", token)
    .eq("status", "pending")
    .gt("expires_at", now)
    .select("id, case_id")
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json({ error: UNAVAILABLE }, { status: 409 });
  }

  const { data: inserted, error: insertError } = await admin
    .from("ndas")
    .insert({
      case_id: claimed.case_id,
      ...lpValuesToRow(values),
      lp_status: "Contacted",
      status: "Draft",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    // Give the link back so the LP can try again.
    await admin
      .from("lp_requests")
      .update({ status: "pending", submitted_at: null, data: null })
      .eq("id", claimed.id);
    return NextResponse.json(
      { error: "Something went wrong saving your details. Please try again." },
      { status: 500 }
    );
  }

  await admin.from("lp_requests").update({ nda_id: inserted.id }).eq("id", claimed.id);

  return NextResponse.json({ ok: true });
}
