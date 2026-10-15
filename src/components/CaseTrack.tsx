"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  supabase,
  Case,
  Nda,
  NdaStatus,
  LpStatus,
  Tier,
  LP_STATUSES,
  TIERS,
  tierInfo,
  ndaCounterpartyName,
} from "@/lib/supabase";
import NdaStatusBadge from "@/components/NdaStatusBadge";
import LpStatusBadge from "@/components/LpStatusBadge";
import NdaSignedFileUpload from "@/components/NdaSignedFileUpload";
import NdaTemplateUpload from "@/components/NdaTemplateUpload";
import { ndaMailtoLink } from "@/lib/nda-email";
import { formatDate } from "@/lib/utils";

type TemplateField = "nda_template_company_url" | "nda_template_individual_url";

export default function CaseTrack({
  caseData,
  role,
}: {
  caseData: Case;
  role: "admin" | "team";
}) {
  const isAdmin = role === "admin";
  const [lps, setLps] = useState<Nda[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState({
    nda_template_company_url: caseData.nda_template_company_url,
    nda_template_individual_url: caseData.nda_template_individual_url,
  });

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("ndas")
      .select("*")
      .eq("case_id", caseData.id)
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      return;
    }
    setLps((data as Nda[]) ?? []);
  }, [caseData.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function updateLp(lp: Nda, patch: Partial<Nda>) {
    setLps((prev) =>
      prev ? prev.map((n) => (n.id === lp.id ? { ...n, ...patch } : n)) : prev
    );
    await supabase.from("ndas").update(patch).eq("id", lp.id);
  }

  async function deleteLp(lp: Nda) {
    if (
      !confirm(
        `Delete ${ndaCounterpartyName(lp)} and their NDA? This cannot be undone.`
      )
    )
      return;
    setLps((prev) => (prev ? prev.filter((n) => n.id !== lp.id) : prev));
    await supabase.from("ndas").delete().eq("id", lp.id);
  }

  async function updateTemplate(field: TemplateField, url: string | null) {
    setTemplates((prev) => ({ ...prev, [field]: url }));
    await supabase.from("cases").update({ [field]: url }).eq("id", caseData.id);
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load LPs: {error}
      </div>
    );
  }
  if (!lps) return <p className="text-sm text-slate-500">Loading LPs…</p>;

  const addHref = `/cases/${caseData.slug}/track/new`;
  const signed = lps.filter((l) => l.status === "Signed").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {lps.length} LP{lps.length === 1 ? "" : "s"} · {signed} NDA
          {signed === 1 ? "" : "s"} signed
        </p>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {showTemplates ? "Hide NDA templates" : "NDA templates"}
            </button>
            <Link
              href={addHref}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              + Add LP
            </Link>
          </div>
        )}
      </div>

      {isAdmin && showTemplates && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">
            NDA templates for this project
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Upload this project&apos;s own .docx template. NDAs generated for it use
            it instead of the shared default — company template only, until an
            individual template is uploaded.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Company
              </div>
              <NdaTemplateUpload
                caseId={caseData.id}
                counterpartyType="company"
                value={templates.nda_template_company_url}
                onSave={(url) => updateTemplate("nda_template_company_url", url)}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Individual
              </div>
              <NdaTemplateUpload
                caseId={caseData.id}
                counterpartyType="individual"
                value={templates.nda_template_individual_url}
                onSave={(url) =>
                  updateTemplate("nda_template_individual_url", url)
                }
              />
            </div>
          </div>
        </div>
      )}

      {lps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-slate-900">No LPs yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Add an LP to start tracking them through to a signed NDA.
          </p>
          {isAdmin && (
            <Link
              href={addHref}
              className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              + Add LP
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">LP Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">NDA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lps.map((lp) => {
                const open = expanded === lp.id;
                const info = tierInfo(lp.tier);
                const hasTemplate =
                  lp.counterparty_type === "company"
                    ? true // falls back to the shared default template
                    : Boolean(templates.nda_template_individual_url);
                return (
                  <Fragment key={lp.id}>
                    <tr>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {ndaCounterpartyName(lp)}
                        {lp.email && (
                          <div className="text-xs font-normal text-slate-400">
                            {lp.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <select
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                            value={lp.lp_status}
                            onChange={(e) =>
                              updateLp(lp, {
                                lp_status: e.target.value as LpStatus,
                              })
                            }
                          >
                            {LP_STATUSES.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        ) : (
                          <LpStatusBadge status={lp.lp_status} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <select
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                            title={info?.description}
                            value={lp.tier ?? ""}
                            onChange={(e) =>
                              updateLp(lp, {
                                tier: e.target.value
                                  ? (Number(e.target.value) as Tier)
                                  : null,
                              })
                            }
                          >
                            <option value="">Set tier…</option>
                            {TIERS.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        ) : info ? (
                          <span
                            title={info.description}
                            className="cursor-help text-slate-700"
                          >
                            {info.label}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpanded(open ? null : lp.id)}
                          aria-expanded={open}
                          title="Show NDA actions"
                          className="inline-flex items-center gap-1.5"
                        >
                          <span aria-hidden>📄</span>
                          <NdaStatusBadge status={lp.status} />
                          {lp.signed_file_url && (
                            <span title="Signed file uploaded" aria-hidden>
                              📎
                            </span>
                          )}
                          <span className="text-xs text-slate-400" aria-hidden>
                            {open ? "▴" : "▾"}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={4} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
                            <div className="text-slate-500">
                              Signing date: {formatDate(lp.signing_date)}
                            </div>

                            {isAdmin && (
                              <label className="flex items-center gap-2 text-slate-500">
                                NDA status
                                <select
                                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                                  value={lp.status}
                                  onChange={(e) =>
                                    updateLp(lp, {
                                      status: e.target.value as NdaStatus,
                                    })
                                  }
                                >
                                  <option>Draft</option>
                                  <option>Sent</option>
                                  <option>Signed</option>
                                </select>
                              </label>
                            )}

                            <div className="flex items-center gap-2">
                              {hasTemplate ? (
                                isAdmin ? (
                                  <>
                                    <a
                                      href={`/api/ndas/generate?id=${lp.id}`}
                                      className="text-blue-600 underline"
                                    >
                                      Download (.docx)
                                    </a>
                                    <a
                                      href={`/api/ndas/generate?id=${lp.id}&format=pdf`}
                                      className="text-blue-600 underline"
                                    >
                                      (.pdf)
                                    </a>
                                  </>
                                ) : (
                                  <a
                                    href={`/api/ndas/generate?id=${lp.id}`}
                                    className="text-blue-600 underline"
                                  >
                                    Download (.pdf)
                                  </a>
                                )
                              ) : (
                                <span className="text-slate-400">
                                  No template for this project
                                </span>
                              )}
                            </div>

                            <a
                              href={ndaMailtoLink(lp, caseData.name)}
                              className="text-slate-500 hover:text-slate-900"
                            >
                              Draft email
                            </a>

                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">Signed NDA</span>
                              <NdaSignedFileUpload
                                ndaId={lp.id}
                                value={lp.signed_file_url}
                                onSave={(url) =>
                                  updateLp(lp, {
                                    signed_file_url: url,
                                    status: url ? "Signed" : lp.status,
                                  })
                                }
                              />
                            </div>

                            {isAdmin && (
                              <button
                                onClick={() => deleteLp(lp)}
                                className="ml-auto text-slate-400 hover:text-red-500"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
