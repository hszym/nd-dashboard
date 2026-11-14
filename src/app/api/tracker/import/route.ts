import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth-server";

// Admin-only, idempotent import of a to-do tracker workbook (.xlsx) into the
// generic tracker tables. Expects a sheet named "Tracker" whose header row has
// columns: Project, Topic, Details, Status, Priority, Urgency, Responsibility,
// Last feedback, Result of last feedback, Pending with, Timeline for delivery, Flag.
// Re-running on the same workspace only adds rows not already present
// (matched on project + details).

export const runtime = "nodejs";

const DEFAULT_STATUSES = [
  { name: "Active", color: "#2563eb", is_active: true, is_done: false },
  { name: "Next phase", color: "#9ca3af", is_active: false, is_done: false },
  { name: "On hold", color: "#d97706", is_active: false, is_done: false },
  { name: "Done", color: "#16a34a", is_active: false, is_done: true },
];

function text(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString();
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v && v.result != null) return String(v.result);
    return "";
  }
  return String(v).trim();
}

function dateOnly(v: ExcelJS.CellValue): string | null {
  const raw = v && typeof v === "object" && "result" in v ? v.result : v;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return null;
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { supabase, user } = admin;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const workspaceName = String(form?.get("workspace") ?? "").trim();
  if (!(file instanceof File) || !workspaceName) {
    return NextResponse.json({ error: "Provide a workspace name and an .xlsx file." }, { status: 400 });
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Could not read the workbook." }, { status: 400 });
  }
  const ws = wb.getWorksheet("Tracker");
  if (!ws) return NextResponse.json({ error: 'No "Tracker" sheet found.' }, { status: 400 });

  // Locate the header row.
  let headerRow = 0;
  ws.eachRow((row, n) => {
    if (!headerRow && text(row.getCell(1).value) === "Project") headerRow = n;
  });
  if (!headerRow) return NextResponse.json({ error: 'No header row starting with "Project".' }, { status: 400 });

  type Row = {
    project: string; topic: string; details: string; status: string; priority: string;
    urgency: number | null; responsible: string; lastFeedback: string; result: string;
    pendingWith: string; due: string | null; flag: boolean | null;
  };
  const rows: Row[] = [];
  for (let n = headerRow + 1; n <= ws.rowCount; n++) {
    const r = ws.getRow(n);
    const project = text(r.getCell(1).value);
    const details = text(r.getCell(3).value);
    if (!project || !details) continue;
    const urg = Number(text(r.getCell(6).value));
    const flagTxt = text(r.getCell(12).value).toLowerCase();
    rows.push({
      project,
      topic: text(r.getCell(2).value),
      details,
      status: text(r.getCell(4).value),
      priority: text(r.getCell(5).value),
      urgency: Number.isInteger(urg) && urg >= 1 && urg <= 5 ? urg : null,
      responsible: text(r.getCell(7).value),
      lastFeedback: text(r.getCell(8).value),
      result: text(r.getCell(9).value),
      pendingWith: text(r.getCell(10).value),
      due: dateOnly(r.getCell(11).value),
      flag: flagTxt === "yes" ? true : flagTxt === "no" ? false : null,
    });
  }
  if (!rows.length) return NextResponse.json({ error: "No to-do rows found." }, { status: 400 });

  // Workspace (find or create).
  let { data: ws0 } = await supabase.from("tracker_workspaces").select("id").eq("name", workspaceName).maybeSingle();
  if (!ws0) {
    const { data, error } = await supabase.from("tracker_workspaces").insert({ name: workspaceName }).select("id").single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Workspace creation failed." }, { status: 500 });
    ws0 = data;
  }
  const workspaceId = ws0.id as string;

  // Reference lists: upsert by (workspace, name).
  const statusNames = [...new Set([...DEFAULT_STATUSES.map((s) => s.name), ...rows.map((r) => r.status).filter(Boolean)])];
  const statusDefs = statusNames.map((name, i) => {
    const d = DEFAULT_STATUSES.find((s) => s.name === name);
    return { workspace_id: workspaceId, name, color: d?.color ?? null, is_active: d?.is_active ?? false, is_done: d?.is_done ?? false, sort: i };
  });
  const topicNames = [...new Set(rows.map((r) => r.topic).filter(Boolean))];
  const projectNames = [...new Set(rows.map((r) => r.project))];

  const [st, tp, pj] = await Promise.all([
    supabase.from("tracker_statuses").upsert(statusDefs, { onConflict: "workspace_id,name", ignoreDuplicates: true }),
    supabase.from("tracker_topics").upsert(topicNames.map((name, i) => ({ workspace_id: workspaceId, name, sort: i })), { onConflict: "workspace_id,name", ignoreDuplicates: true }),
    (async () => {
      const { data: existing } = await supabase.from("tracker_projects").select("name").eq("workspace_id", workspaceId);
      const have = new Set((existing ?? []).map((p) => p.name));
      const missing = projectNames.filter((n) => !have.has(n)).map((name) => ({ workspace_id: workspaceId, name, sort: projectNames.indexOf(name) }));
      return missing.length ? supabase.from("tracker_projects").insert(missing) : { error: null };
    })(),
  ]);
  const refErr = st.error ?? tp.error ?? pj.error;
  if (refErr) return NextResponse.json({ error: refErr.message }, { status: 500 });

  const [statuses, topics, projects, existingItems] = await Promise.all([
    supabase.from("tracker_statuses").select("id,name").eq("workspace_id", workspaceId),
    supabase.from("tracker_topics").select("id,name").eq("workspace_id", workspaceId),
    supabase.from("tracker_projects").select("id,name").eq("workspace_id", workspaceId),
    supabase.from("tracker_items").select("project_id,details, tracker_projects!inner(workspace_id)").eq("tracker_projects.workspace_id", workspaceId),
  ]);
  const byName = (d: { id: string; name: string }[] | null) => new Map((d ?? []).map((x) => [x.name, x.id]));
  const statusId = byName(statuses.data), topicId = byName(topics.data), projectId = byName(projects.data);
  const seen = new Set((existingItems.data ?? []).map((i) => `${i.project_id}|${i.details}`));

  const toInsert = rows
    .map((r, i) => ({ r, i, pid: projectId.get(r.project) as string }))
    .filter(({ r, pid }) => !seen.has(`${pid}|${r.details}`))
    .map(({ r, i, pid }) => ({
      project_id: pid,
      topic_id: topicId.get(r.topic) ?? null,
      status_id: statusId.get(r.status) ?? null,
      details: r.details,
      priority: ["High", "Medium", "Low"].includes(r.priority) ? r.priority : null,
      urgency: r.urgency,
      responsible: r.responsible || null,
      last_feedback: r.lastFeedback || null,
      feedback_result: r.result || null,
      pending_with: r.pendingWith || null,
      due_date: r.due,
      flag: r.flag,
      sort: i,
    }));

  let inserted = 0;
  if (toInsert.length) {
    const { data, error } = await supabase.from("tracker_items").insert(toInsert).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    inserted = data?.length ?? 0;
    if (data?.length) {
      await supabase.from("tracker_events").insert(
        data.map((d) => ({ item_id: d.id, user_id: user.id, source: "import", changes: {}, note: "Imported from workbook" }))
      );
    }
  }

  return NextResponse.json({ workspace_id: workspaceId, found: rows.length, inserted, skipped: rows.length - inserted });
}
