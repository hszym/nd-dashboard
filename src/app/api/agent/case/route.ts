import { NextRequest, NextResponse } from "next/server";
import { requireAgent } from "@/lib/agent-auth";
import { cleanHttpsUrl } from "@/lib/agent-documents";

// A few descriptive fields of a deal and its intro email template, for Claude. Admin tokens only.
// mode "fill" (default) only writes fields that are empty today, so nothing a member typed is
// overwritten; mode "set" overwrites the fields sent.

type Cleaner = (v: unknown) => string | number | null | undefined;

const text = (max: number): Cleaner => (v) => {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return null;
  return s.length <= max ? s : undefined;
};
const money: Cleaner = (v) => {
  if (v === null) return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n < 1e13 ? n : undefined;
};

const FIELDS: Record<string, Cleaner> = {
  sector: text(120),
  currency: (v) => (typeof v === "string" && /^[A-Z]{3}$/.test(v.trim()) ? v.trim() : v === null ? null : undefined),
  amount_target: money,
  amount_remaining: money,
  deadline: (v) => (v === null ? null : typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined),
  website_url: (v) => cleanHttpsUrl(v),
  intro_email_subject: text(300),
  intro_email_text: text(5000),
  intro_email_html: text(20000),
};

export async function POST(request: NextRequest) {
  const auth = await requireAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin, role } = auth.caller;
  if (role !== "admin") return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || typeof body?.fields !== "object" || body.fields === null) {
    return NextResponse.json({ error: "Expected { slug, fields, mode? }." }, { status: 400 });
  }
  const mode = body.mode === "set" ? "set" : "fill";

  const { data: current } = await admin.from("cases").select("*").eq("slug", slug).maybeSingle();
  if (!current) return NextResponse.json({ error: "Unknown deal." }, { status: 404 });

  const patch: Record<string, unknown> = {};
  const skipped: { field: string; reason: string }[] = [];
  for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) {
    const clean = FIELDS[key];
    if (!clean) { skipped.push({ field: key, reason: "not allowed" }); continue; }
    const v = clean(value);
    if (v === undefined) { skipped.push({ field: key, reason: "invalid value" }); continue; }
    const existing = (current as Record<string, unknown>)[key];
    const hasValue = existing !== null && existing !== undefined && String(existing).trim() !== "";
    if (mode === "fill" && hasValue) { skipped.push({ field: key, reason: "already has a value" }); continue; }
    patch[key] = v;
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from("cases").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", current.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ updated: Object.keys(patch), skipped });
}
