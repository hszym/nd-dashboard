"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, Case, CaseDocument, DOCUMENT_TYPES } from "@/lib/supabase";
import StageBadge from "@/components/StageBadge";
import { useRole } from "@/lib/useRole";
import { formatAmount, formatDate, daysUntil } from "@/lib/utils";

type CaseWithDocs = Case & { documents: CaseDocument[] };

export default function HomePage() {
  const router = useRouter();
  const role = useRole();
  const [cases, setCases] = useState<CaseWithDocs[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("cases")
        .select("*, documents(*)")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      setCases((data as CaseWithDocs[]) ?? []);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    if (!cases) return null;
    return {
      total: cases.length,
      raising: cases.filter((c) => c.stage === "Raising").length,
      underReview: cases.filter((c) => c.stage === "Under Review").length,
      completed: cases.filter((c) => c.stage === "Completed").length,
    };
  }, [cases]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load cases: {error}
      </div>
    );
  }

  if (!cases) {
    return <p className="text-sm text-slate-500">Loading cases…</p>;
  }

  if (cases.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No cases yet</h2>
        <p className="mt-1 text-sm text-slate-500">
          Create your first case to start tracking its documents.
        </p>
        {role !== "team" && (
          <Link
            href="/cases/new"
            className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            + New case
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total cases" value={stats.total} />
          <StatCard label="Under Review" value={stats.underReview} />
          <StatCard label="Raising" value={stats.raising} />
          <StatCard label="Completed" value={stats.completed} />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Documents</th>
              {role !== "team" && (
                <th className="px-4 py-3">Amount remaining</th>
              )}
              <th className="px-4 py-3">Deadline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.map((c) => {
              const done = c.documents.filter((d) => d.status === "Done").length;
              const total = DOCUMENT_TYPES.length;
              const dleft = daysUntil(c.deadline);
              return (
                <tr
                  key={c.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => router.push(`/cases/${c.slug}`)}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/cases/${c.slug}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {c.name}
                    </Link>
                    {(c.sector || c.sponsor) && (
                      <div className="text-xs text-slate-500">
                        {[c.sector, c.sponsor && `Sponsor: ${c.sponsor}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge stage={c.stage} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-900"
                          style={{ width: `${(done / total) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">
                        {done}/{total}
                      </span>
                    </div>
                  </td>
                  {role !== "team" && (
                    <td className="px-4 py-3 text-slate-700">
                      {formatAmount(c.amount_remaining, c.currency)}
                      {c.amount_target ? (
                        <span className="text-xs text-slate-400">
                          {" "}
                          / {formatAmount(c.amount_target, c.currency)}
                        </span>
                      ) : null}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className="text-slate-700">{formatDate(c.deadline)}</span>
                    {dleft !== null && (
                      <div
                        className={`text-xs ${
                          dleft < 0
                            ? "text-red-500"
                            : dleft <= 14
                            ? "text-amber-600"
                            : "text-slate-400"
                        }`}
                      >
                        {dleft < 0 ? `${Math.abs(dleft)}d overdue` : `${dleft}d left`}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
