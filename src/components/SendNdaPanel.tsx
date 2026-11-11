"use client";

import { useState } from "react";
import Link from "next/link";
import { Case, Nda, ndaCounterpartyName } from "@/lib/supabase";
import NdaStatusBadge from "@/components/NdaStatusBadge";
import { ndaMailtoLink } from "@/lib/nda-email";

/** Pick an LP, then open their NDA PDF and a pre-filled email draft. */
export default function SendNdaPanel({
  caseData,
  lps,
  isAdmin,
}: {
  caseData: Case;
  lps: Nda[] | null;
  isAdmin: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!lps) return <p className="text-sm text-slate-500">Loading LPs…</p>;

  if (lps.length === 0) {
    return (
      <div className="space-y-3 text-sm text-slate-600">
        <p>No LPs yet. Add one on the Investors page to generate an NDA.</p>
        {isAdmin && (
          <Link
            href={`/cases/${caseData.slug}/track/new`}
            className="inline-block rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            + Add LP
          </Link>
        )}
      </div>
    );
  }

  const selected = lps.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Pick an LP to send the NDA to.</p>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
        {lps.map((lp) => (
          <li key={lp.id}>
            <button
              type="button"
              onClick={() => setSelectedId(lp.id)}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 ${
                lp.id === selectedId ? "bg-slate-50" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {ndaCounterpartyName(lp)}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {lp.email ?? "No email on file"}
                </span>
              </span>
              <NdaStatusBadge status={lp.status} />
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-900">
            {ndaCounterpartyName(selected)}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/ndas/generate?id=${selected.id}&format=pdf`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Open NDA PDF
            </a>
            <a
              href={ndaMailtoLink(selected, caseData.name)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Draft email
            </a>
          </div>
          <p className="text-xs text-slate-500">
            Attach the PDF to the email yourself — a draft link can&apos;t carry
            attachments. Set the NDA status to Sent on the Investors page once it
            goes out.
          </p>
        </div>
      )}
    </div>
  );
}
