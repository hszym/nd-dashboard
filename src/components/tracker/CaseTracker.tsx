"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import TrackerApp from "./TrackerApp";

interface Linked { id: string; workspace_id: string }
interface Candidate { id: string; name: string }

/**
 * Third page of a deal: the to-dos of the tracker project linked to this deal.
 * Admins can link one (tracker_projects.case_id) when none is linked yet.
 */
export default function CaseTracker({ caseId, isAdmin }: { caseId: string; isAdmin: boolean }) {
  const [linked, setLinked] = useState<Linked | null | undefined>(undefined);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("tracker_projects")
      .select("id,workspace_id")
      .eq("case_id", caseId)
      .order("sort")
      .limit(1);
    const row = (data?.[0] as Linked | undefined) ?? null;
    setLinked(row);
    if (!row && isAdmin) {
      const { data: free } = await supabase
        .from("tracker_projects")
        .select("id,name")
        .is("case_id", null)
        .order("name");
      setCandidates((free as Candidate[]) ?? []);
    }
  }, [caseId, isAdmin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function link() {
    if (!pick) return;
    setError(null);
    const { error } = await supabase.from("tracker_projects").update({ case_id: caseId }).eq("id", pick);
    if (error) return setError(error.message);
    load();
  }

  if (linked === undefined) return <p className="text-sm text-slate-500">Loading…</p>;

  if (!linked) {
    return (
      <div className="space-y-3 text-sm text-slate-600">
        <p>No tracker is linked to this deal yet.</p>
        {isAdmin && candidates.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5">
              <option value="">Choose a tracker project…</option>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={link} disabled={!pick} className="rounded-full bg-slate-900 px-4 py-1.5 font-medium text-white disabled:opacity-50">
              Link
            </button>
          </div>
        )}
        {isAdmin && candidates.length === 0 && <p className="text-slate-400">No unlinked tracker project available. Import a workbook first.</p>}
        {error && <p className="text-red-600">{error}</p>}
      </div>
    );
  }

  return <TrackerApp fixedWorkspaceId={linked.workspace_id} fixedProjectId={linked.id} />;
}
