"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import TrackerApp from "./TrackerApp";

interface Linked { id: string; workspace_id: string }

const DEFAULT_STATUSES = [
  { name: "Active", color: "#2563eb", is_active: true, is_done: false },
  { name: "Next phase", color: "#9ca3af", is_active: false, is_done: false },
  { name: "On hold", color: "#d97706", is_active: false, is_done: false },
  { name: "Done", color: "#16a34a", is_active: false, is_done: true },
];

/**
 * Third page of a deal: that deal's own tracker, made of its sub-projects
 * (tracker_projects.case_id = this deal). A deal never shows another deal's to-dos.
 * Admins can start an empty tracker for a deal that has none.
 */
export default function CaseTracker({
  caseId,
  caseName,
  isAdmin,
}: {
  caseId: string;
  caseName: string;
  isAdmin: boolean;
}) {
  const [linked, setLinked] = useState<Linked | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("tracker_projects")
      .select("id,workspace_id")
      .eq("case_id", caseId)
      .order("sort")
      .limit(1);
    setLinked((data?.[0] as Linked | undefined) ?? null);
  }, [caseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset and reload when the deal changes
    setLinked(undefined);
    load();
  }, [load]);

  async function start() {
    setBusy(true);
    setError(null);
    const fail = (m: string) => { setError(m); setBusy(false); };
    const { data: ws, error: e1 } = await supabase
      .from("tracker_workspaces").insert({ name: caseName }).select("id").single();
    if (e1 || !ws) return fail(e1?.message ?? "Could not create the tracker.");
    const { error: e2 } = await supabase.from("tracker_statuses").insert(
      DEFAULT_STATUSES.map((s, i) => ({ ...s, workspace_id: ws.id, sort: i }))
    );
    if (e2) return fail(e2.message);
    const { error: e3 } = await supabase
      .from("tracker_projects").insert({ workspace_id: ws.id, name: caseName, case_id: caseId });
    if (e3) return fail(e3.message);
    setBusy(false);
    load();
  }

  if (linked === undefined) return <p className="text-sm text-slate-500">Loading…</p>;

  if (!linked) {
    return (
      <div className="space-y-3 text-sm text-slate-600">
        <p>No tracker for this deal yet.</p>
        {isAdmin && (
          <button
            onClick={start}
            disabled={busy}
            className="rounded-full bg-slate-900 px-4 py-1.5 font-medium text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Start a tracker for this deal"}
          </button>
        )}
        {error && <p className="text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <TrackerApp
      key={caseId}
      workspaceId={linked.workspace_id}
      caseId={caseId}
      openItemId={typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("item")}
    />
  );
}
