import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAgent } from "@/lib/agent-auth";
import {
  AGENT_ATTACHMENT_TYPES,
  CASE_FILES_BUCKET_NAME,
  cleanHttpsUrl,
  isDocumentStatus,
  isDocumentType,
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

  const [{ data: documents, error }, { data: fields }] = await Promise.all([
    admin.from("documents").select("id, type, status, file_url, attachment_url, updated_at").eq("case_id", deal.id),
    admin
      .from("cases")
      .select("sector, currency, amount_target, amount_remaining, deadline, website_url, intro_email_subject, intro_email_text, intro_email_html")
      .eq("id", deal.id)
      .maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deal, documents: documents ?? [], case: fields });
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
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  const { data: existing } = await admin
    .from("documents")
    .select("id")
    .eq("case_id", deal.id)
    .eq("type", type)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await admin.from("documents").update(patch).eq("id", existing.id).select("id, type, status, file_url, attachment_url").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, created: false, document: data });
  }
  const { data, error } = await admin
    .from("documents")
    .insert({ case_id: deal.id, type, status: "Missing", ...patch })
    .select("id, type, status, file_url, attachment_url")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, created: true, document: data });
}
