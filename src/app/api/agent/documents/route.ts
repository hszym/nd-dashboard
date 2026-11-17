import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAgent } from "@/lib/agent-auth";
import {
  AGENT_ATTACHMENT_TYPES,
  CASE_FILES_BUCKET_NAME,
  DEAL_DOCUMENTS_BUCKET_NAME,
  cleanHttpsUrl,
  isDocumentStatus,
  isDocumentType,
  mirrorPath,
  resolveRound,
  ROUND_DOCUMENT_TYPES,
} from "@/lib/agent-documents";

// A deal's documents for Claude: read what exists, then record each document's status,
// its link (OneDrive or any https link) and, for the 2-pager and the Deck, the PDF kept in
// the app for the intro email. Admin tokens only: these are the same edits an admin makes
// in the Documents panel.

async function findCase(admin: SupabaseClient, slug: unknown) {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const { data } = await admin.from("cases").select("id, slug, name").eq("slug", slug).maybeSingle();
  return data as { id: string; slug: string; name: string } | null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin } = auth.caller;

  const deal = await findCase(admin, request.nextUrl.searchParams.get("slug"));
  if (!deal) return NextResponse.json({ error: "Unknown deal." }, { status: 404 });

  const [{ data: documents, error }, { data: fields }, { data: rounds }] = await Promise.all([
    admin.from("documents").select("id, type, round_id, status, file_url, attachment_url, mirror_path, mirror_hash, mirror_synced_at, updated_at").eq("case_id", deal.id),
    admin
      .from("cases")
      .select("sector, website_url, intro_email_subject, intro_email_text, intro_email_html")
      .eq("id", deal.id)
      .maybeSingle(),
    admin.from("case_rounds").select("id, name, sort, status, currency, amount_target, amount_remaining, deadline").eq("case_id", deal.id).order("sort"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // The deal's money lives in its rounds. For callers that only know one objective, the
  // current round's figures are repeated in `case` (currency, amount_target, amount_remaining, deadline).
  const current = await resolveRound(admin, deal.id, undefined);
  const cur = (rounds ?? []).find((r) => r.id === current?.id);
  return NextResponse.json({
    deal,
    documents: documents ?? [],
    rounds: rounds ?? [],
    current_round: cur?.name ?? null,
    case: {
      ...fields,
      currency: cur?.currency ?? null,
      amount_target: cur?.amount_target ?? null,
      amount_remaining: cur?.amount_remaining ?? null,
      deadline: cur?.deadline ?? null,
    },
  });
}

/** Creates or updates one document row. Only the fields sent are changed. */
export async function POST(request: NextRequest) {
  const auth = await requireAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin, role } = auth.caller;
  if (role !== "admin") return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const deal = await findCase(admin, body?.slug);
  if (!deal) return NextResponse.json({ error: "Unknown deal." }, { status: 404 });
  if (!isDocumentType(body?.type)) return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
  const type = body.type;

  // Term Sheet, 2-pager and Case Review belong to a round: the one named in `round`, else the current one.
  let round = null;
  if (ROUND_DOCUMENT_TYPES.includes(type)) {
    round = await resolveRound(admin, deal.id, body.round);
    if (!round) return NextResponse.json({ error: "Unknown round." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!isDocumentStatus(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    patch.status = body.status;
  }
  if (body.file_url !== undefined) {
    const url = cleanHttpsUrl(body.file_url);
    if (url === undefined) return NextResponse.json({ error: "file_url must be an https link." }, { status: 400 });
    patch.file_url = url;
  }
  if (body.attachment_path !== undefined) {
    const p = body.attachment_path;
    if (!AGENT_ATTACHMENT_TYPES.includes(type)) {
      return NextResponse.json({ error: "Only the 2-pager and the Deck can have an attachment." }, { status: 400 });
    }
    if (typeof p !== "string" || !new RegExp(`^${deal.id}/[a-z0-9-]+-\\d+\\.pdf$`).test(p)) {
      return NextResponse.json({ error: "Invalid attachment path." }, { status: 400 });
    }
    // The file must already be in the bucket (uploaded through the signed URL).
    const name = p.split("/")[1];
    const { data: listed } = await admin.storage.from(CASE_FILES_BUCKET_NAME).list(deal.id, { search: name, limit: 5 });
    if (!listed?.some((f) => f.name === name)) {
      return NextResponse.json({ error: "The file was not found in storage. Upload it first." }, { status: 400 });
    }
    patch.attachment_url = admin.storage.from(CASE_FILES_BUCKET_NAME).getPublicUrl(p).data.publicUrl;
  }
  if (body.mirror_path !== undefined) {
    if (type === "Intro Email") return NextResponse.json({ error: "The Intro Email has no PDF." }, { status: 400 });
    if (body.mirror_path !== mirrorPath(deal.id, type, round)) {
      return NextResponse.json({ error: "Invalid mirror path." }, { status: 400 });
    }
    const hash = body.mirror_hash;
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) {
      return NextResponse.json({ error: "mirror_hash must be a SHA-256 hex string." }, { status: 400 });
    }
    // The file must already be in the private bucket (uploaded through the signed URL).
    const [folder, name] = (body.mirror_path as string).split("/");
    const { data: listed } = await admin.storage.from(DEAL_DOCUMENTS_BUCKET_NAME).list(folder, { search: name, limit: 5 });
    if (!listed?.some((f) => f.name === name)) {
      return NextResponse.json({ error: "The file was not found in storage. Upload it first." }, { status: 400 });
    }
    patch.mirror_path = body.mirror_path;
    patch.mirror_hash = hash;
    patch.mirror_synced_at = new Date().toISOString();
    if (typeof body.mirror_source === "string") patch.mirror_source = body.mirror_source.slice(0, 200);
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  let lookup = admin.from("documents").select("id").eq("case_id", deal.id).eq("type", type);
  lookup = round ? lookup.eq("round_id", round.id) : lookup.is("round_id", null);
  const { data: existing } = await lookup.limit(1).maybeSingle();

  if (existing) {
    const { data, error } = await admin.from("documents").update(patch).eq("id", existing.id).select("id, type, status, file_url, attachment_url").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, created: false, document: data });
  }
  const { data, error } = await admin
    .from("documents")
    .insert({ case_id: deal.id, round_id: round?.id ?? null, type, status: "Missing", ...patch })
    .select("id, type, status, file_url, attachment_url")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, created: true, document: data });
}
