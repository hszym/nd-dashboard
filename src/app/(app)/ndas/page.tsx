"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  supabase,
  Nda,
  NdaStatus,
  Case,
  ndaCounterpartyName,
} from "@/lib/supabase";
import NdaStatusBadge from "@/components/NdaStatusBadge";
import NdaSignedFileUpload from "@/components/NdaSignedFileUpload";
import NdaTemplateUpload from "@/components/NdaTemplateUpload";
import { useRole } from "@/lib/useRole";
import { formatDate } from "@/lib/utils";
import { ndaMailtoLink } from "@/lib/nda-email";

type NdaCase = Pick<
  Case,
  "id" | "name" | "slug" | "nda_template_company_url" | "nda_template_individual_url"
>;
type NdaWithCase = Nda & { cases: NdaCase | null };

export default function NdasPage() {
  const role = useRole();
  const [ndas, setNdas] = useState<NdaWithCase[] | null>(null);
  const [cases, setCases] = useState<NdaCase[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [ndasRes, casesRes] = await Promise.all([
      supabase
        .from("ndas")
        .select(
          "*, cases(id, name, slug, nda_template_company_url, nda_template_individual_url)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("cases")
        .select("id, name, slug, nda_template_company_url, nda_template_individual_url")
        .order("name"),
    ]);
    if (ndasRes.error) {
      setError(ndasRes.error.message);
      return;
    }
    setNdas((ndasRes.data as NdaWithCase[]) ?? []);
    setCases((casesRes.data as NdaCase[]) ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  function caseForNda(nda: NdaWithCase): NdaCase | null {
    return nda.cases ?? cases.find((c) => c.id === nda.case_id) ?? null;
  }

  async function updateCaseTemplate(
    caseId: string,
    field: "nda_template_company_url" | "nda_template_individual_url",
    url: string | null
  ) {
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, [field]: url } : c))
    );
    setNdas((prev) =>
      prev
        ? prev.map((n) =>
            n.cases?.id === caseId
              ? { ...n, cases: { ...n.cases, [field]: url } }
              : n
          )
        : prev
    );
    await supabase.from("cases").update({ [field]: url }).eq("id", caseId);
  }

  const stats = useMemo(() => {
    if (!ndas) return null;
    return {
      total: ndas.length,
      draft: ndas.filter((n) => n.status === "Draft").length,
      sent: ndas.filter((n) => n.status === "Sent").length,
      signed: ndas.filter((n) => n.status === "Signed").length,
    };
  }, [ndas]);

  async function updateNda(nda: NdaWithCase, patch: Partial<Nda>) {
    setNdas((prev) =>
      prev ? prev.map((n) => (n.id === nda.id ? { ...n, ...patch } : n)) : prev
    );
    await supabase.from("ndas").update(patch).eq("id", nda.id);
  }

  async function deleteNda(nda: NdaWithCase) {
    if (!confirm(`Delete the NDA for ${ndaCounterpartyName(nda)}? This cannot be undone.`))
      return;
    setNdas((prev) => (prev ? prev.filter((n) => n.id !== nda.id) : prev));
    await supabase.from("ndas").delete().eq("id", nda.id);
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load NDAs: {error}
      </div>
    );
  }

  if (!ndas || role === undefined) {
    return <p className="text-sm text-slate-500">Loading NDAs…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">NDAs</h1>
        <div className="flex items-center gap-2">
          {role === "admin" && (
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {showTemplates ? "Hide project templates" : "Project templates"}
            </button>
          )}
          {role === "admin" && (
            <Link
              href="/ndas/new"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              + New NDA
            </Link>
          )}
        </div>
      </div>

      {role === "admin" && showTemplates && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Project NDA templates
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Drop each project&apos;s own .docx NDA template here. Once uploaded,
              NDAs generated for that project use it instead of the shared
              default — company template only, until a project uploads its own.
            </p>
          </div>
          {cases.length === 0 ? (
            <p className="px-6 py-4 text-sm text-slate-500">No projects yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-2">Project</th>
                  <th className="px-6 py-2">Company template</th>
                  <th className="px-6 py-2">Individual template</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td className="px-6 py-3 font-medium text-slate-800">
                      {c.name}
                    </td>
                    <td className="px-6 py-3">
                      <NdaTemplateUpload
                        caseId={c.id}
                        counterpartyType="company"
                        value={c.nda_template_company_url}
                        onSave={(url) =>
                          updateCaseTemplate(c.id, "nda_template_company_url", url)
                        }
                      />
                    </td>
                    <td className="px-6 py-3">
                      <NdaTemplateUpload
                        caseId={c.id}
                        counterpartyType="individual"
                        value={c.nda_template_individual_url}
                        onSave={(url) =>
                          updateCaseTemplate(c.id, "nda_template_individual_url", url)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total NDAs" value={stats.total} />
          <StatCard label="Draft" value={stats.draft} />
          <StatCard label="Sent" value={stats.sent} />
          <StatCard label="Signed" value={stats.signed} />
        </div>
      )}

      {ndas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No NDAs yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create one to start tracking it through signature.
          </p>
          {role === "admin" && (
            <Link
              href="/ndas/new"
              className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              + New NDA
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Counterparty</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">NDA</th>
                <th className="px-4 py-3">Signed NDA</th>
                {role === "admin" && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ndas.map((nda) => {
                const ndaCase = caseForNda(nda);
                const hasTemplate =
                  nda.counterparty_type === "company"
                    ? true // falls back to the shared default template
                    : Boolean(ndaCase?.nda_template_individual_url);
                return (
                <tr key={nda.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {ndaCounterpartyName(nda)}
                    {nda.email && (
                      <div className="text-xs text-slate-400">{nda.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {nda.cases ? (
                      <Link
                        href={`/cases/${nda.cases.slug}`}
                        className="text-slate-600 hover:underline"
                      >
                        {nda.cases.name}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {role === "admin" ? (
                      <select
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                        value={nda.status}
                        onChange={(e) =>
                          updateNda(nda, { status: e.target.value as NdaStatus })
                        }
                      >
                        <option>Draft</option>
                        <option>Sent</option>
                        <option>Signed</option>
                      </select>
                    ) : (
                      <NdaStatusBadge status={nda.status} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDate(nda.signing_date)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 text-xs">
                      {hasTemplate ? (
                        <a
                          href={`/api/ndas/generate?id=${nda.id}`}
                          className="text-blue-600 underline"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-slate-400">
                          No template for this project
                        </span>
                      )}
                      {nda.cases && (
                        <a
                          href={ndaMailtoLink(nda, nda.cases.name)}
                          className="text-slate-500 hover:text-slate-900"
                        >
                          Draft email
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <NdaSignedFileUpload
                      ndaId={nda.id}
                      value={nda.signed_file_url}
                      onSave={(url) =>
                        updateNda(nda, {
                          signed_file_url: url,
                          status: url ? "Signed" : nda.status,
                        })
                      }
                    />
                  </td>
                  {role === "admin" && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteNda(nda)}
                        className="text-xs text-slate-400 hover:text-red-500"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
