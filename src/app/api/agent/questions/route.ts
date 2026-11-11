import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAgent } from "@/lib/agent-auth";

// Open questions for Claude. The deal's 00_README.md (OneDrive) is the source of
// truth; the dashboard shows the questions and lets the team answer them.
//
// `md_synced_at` is the sync marker. null means "the dashboard has a change the
// MD file has not seen yet" (a question created or answered in the dashboard):
// those rows are returned as `pending`, and a push from the MD never overwrites
// them. Rows that came from the MD are inserted with md_synced_at = now().

const REF_RE = /^Q-\d{3,6}$/;
const MAX_ITEMS = 300;

interface QuestionInput {
  ref: string;
  question: string;
  priority: "normal" | "blocking";
  source: string | null;
  status: "open" | "answered";
  answer: string | null;
}

function parseItems(raw: unknown): { items: QuestionInput[]; error?: string } {
  if (!Array.isArray(raw)) return { items: [], error: "`questions` must be an array." };
  if (raw.length > MAX_ITEMS) return { items: [], error: `At most ${MAX_ITEMS} questions per call.` };
  const items: QuestionInput[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const ref = typeof r?.ref === "string" ? r.ref.trim() : "";
    const question = typeof r?.question === "string" ? r.question.trim() : "";
    if (!REF_RE.test(ref)) return { items: [], error: `Invalid ref "${ref}" (expected Q-001).` };
    if (seen.has(ref)) return { items: [], error: `Duplicate ref ${ref}.` };
    seen.add(ref);
    if (!question || question.length > 2000) {
      return { items: [], error: `${ref}: question is empty or longer than 2000 characters.` };
    }
    const answer = typeof r?.answer === "string" && r.answer.trim() ? r.answer.trim().slice(0, 4000) : null;
    const source = typeof r?.source === "string" && r.source.trim() ? r.source.trim().slice(0, 300) : null;
    items.push({
      ref,
      question,
      priority: r?.priority === "blocking" ? "blocking" : "normal",
      source,
      status: r?.status === "answered" ? "answered" : "open",
      answer,
    });
  }
  return { items };
}

async function findCase(admin: SupabaseClient, slug: unknown) {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const { data } = await admin.from("cases").select("id, slug, name").eq("slug", slug).maybeSingle();
  return data as { id: string; slug: string; name: string } | null;
}

/** The deal's questions; `pending: true` rows are changes made in the dashboard that the MD must receive. */
export async function GET(request: NextRequest) {
  const auth = await requireAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin } = auth.caller;

  const deal = await findCase(admin, request.nextUrl.searchParams.get("slug"));
  if (!deal) return NextResponse.json({ error: "Unknown deal." }, { status: 404 });

  const { data, error } = await admin
    .from("case_questions")
    .select("id, ref, question, answer, status, priority, source, created_at, answered_at, md_synced_at")
    .eq("case_id", deal.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const questions = (data ?? []).map((q) => ({ ...q, pending: q.md_synced_at === null }));
  return NextResponse.json({ deal, questions });
}

/** Pushes the questions parsed from the deal's 00_README.md. Never deletes. */
export async function POST(request: NextRequest) {
  const auth = await requireAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin, userId } = auth.caller;

  const body = await request.json().catch(() => null);
  const deal = await findCase(admin, body?.slug);
  if (!deal) return NextResponse.json({ error: "Unknown deal." }, { status: 404 });

  const { items, error: parseError } = parseItems(body?.questions);
  if (parseError) return NextResponse.json({ error: parseError }, { status: 400 });

  const { data: existingRows, error: loadError } = await admin
    .from("case_questions")
    .select("id, ref, status, md_synced_at")
    .eq("case_id", deal.id)
    .not("ref", "is", null);
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  const byRef = new Map((existingRows ?? []).map((r) => [r.ref as string, r]));

  const now = new Date().toISOString();
  const created: string[] = [];
  const updated: string[] = [];
  const skippedPending: string[] = [];
  const errors: { ref: string; error: string }[] = [];

  for (const it of items) {
    const answered = it.status === "answered";
    const existing = byRef.get(it.ref);

    if (!existing) {
      const { error } = await admin.from("case_questions").insert({
        case_id: deal.id,
        ref: it.ref,
        question: it.question,
        priority: it.priority,
        source: it.source,
        status: it.status,
        answer: answered ? it.answer : null,
        answered_at: answered ? now : null,
        created_by: userId,
        md_synced_at: now,
      });
      if (error) errors.push({ ref: it.ref, error: error.message });
      else created.push(it.ref);
      continue;
    }

    // A change made in the dashboard is waiting to be written into the MD: keep it.
    if (existing.md_synced_at === null) {
      skippedPending.push(it.ref);
      continue;
    }

    const patch: Record<string, unknown> = {
      question: it.question,
      priority: it.priority,
      source: it.source,
      status: it.status,
      answer: answered ? it.answer : null,
      md_synced_at: now,
    };
    if (answered && existing.status !== "answered") patch.answered_at = now;
    if (!answered) patch.answered_at = null;
    const { error } = await admin.from("case_questions").update(patch).eq("id", existing.id);
    if (error) errors.push({ ref: it.ref, error: error.message });
    else updated.push(it.ref);
  }

  return NextResponse.json({ created, updated, skipped_pending: skippedPending, errors });
}
