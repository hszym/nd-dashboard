import { NextRequest, NextResponse } from "next/server";
import { requireAgent } from "@/lib/agent-auth";

// After Claude wrote dashboard changes (answers, new questions, priority) into the
// deal's 00_README.md, it confirms here. Questions created in the dashboard get
// their MD id (Q-nnn) at this point.

const REF_RE = /^Q-\d{3,6}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const auth = await requireAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin } = auth.caller;

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !Array.isArray(body?.items) || body.items.length > 300) {
    return NextResponse.json({ error: "Expected { slug, items: [{ id, ref? }] }." }, { status: 400 });
  }

  const { data: deal } = await admin.from("cases").select("id").eq("slug", slug).maybeSingle();
  if (!deal) return NextResponse.json({ error: "Unknown deal." }, { status: 404 });

  const now = new Date().toISOString();
  const acked: string[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const item of body.items) {
    const id = typeof item?.id === "string" ? item.id : "";
    const ref = typeof item?.ref === "string" ? item.ref.trim() : "";
    if (!UUID_RE.test(id) || (ref && !REF_RE.test(ref))) {
      errors.push({ id, error: "Invalid id or ref." });
      continue;
    }
    const patch: Record<string, unknown> = { md_synced_at: now };
    if (ref) patch.ref = ref;

    // Only rows of this deal; a ref can only be set on a row that has none.
    let query = admin.from("case_questions").update(patch).eq("id", id).eq("case_id", deal.id);
    if (ref) query = query.is("ref", null);
    const { data, error } = await query.select("id").maybeSingle();
    if (error) errors.push({ id, error: error.message });
    else if (!data) errors.push({ id, error: "Not found, or it already has a ref." });
    else acked.push(id);
  }

  return NextResponse.json({ acked, errors });
}
