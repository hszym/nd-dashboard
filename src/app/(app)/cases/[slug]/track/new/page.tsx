"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, Case, LP_STATUSES, LpStatus, Tier, TIERS } from "@/lib/supabase";
import { emptyLpValues, LpValues, lpValuesToRow, validateLp } from "@/lib/lp";
import LpFields, { LpField, LpSection } from "@/components/LpFields";
import RequestFromLp from "@/components/RequestFromLp";

export default function AddLpPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [values, setValues] = useState<LpValues>(emptyLpValues);
  const [lpStatus, setLpStatus] = useState<LpStatus>("Contacted");
  const [tier, setTier] = useState<Tier | "">("");
  const [signingPlace, setSigningPlace] = useState("Luxembourg");
  const [signingDate, setSigningDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("cases")
      .select("*")
      .eq("slug", params.slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) setCaseData(data as Case);
        else setNotFound(true);
      });
    return () => {
      active = false;
    };
  }, [params.slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!caseData) return;
    const problem = validateLp(values, false);
    if (problem) {
      setError(problem);
      return;
    }
    if (tier === "") {
      setError("Pick a tier.");
      return;
    }

    setSaving(true);
    setError(null);

    const { data: inserted, error: insertError } = await supabase
      .from("ndas")
      .insert({
        case_id: caseData.id,
        ...lpValuesToRow(values),
        lp_status: lpStatus,
        tier,
        signing_place: signingPlace.trim() || "Luxembourg",
        signing_date: signingDate,
        status: "Draft",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      setSaving(false);
      setError(insertError?.message ?? "Could not add the LP.");
      return;
    }

    // Render and cache the PDF non-admins will download. Best-effort: a
    // failure here doesn't block creation — the download route falls back
    // to generating it on first request instead.
    try {
      await fetch("/api/ndas/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inserted.id }),
      });
    } catch {
      // Ignored — see comment above.
    }

    setSaving(false);
    router.push(`/cases/${caseData.slug}?tab=track`);
  }

  if (notFound) {
    return (
      <div className="rounded-[1.75rem] bg-white p-8 text-center shadow-sm">
        <p className="text-slate-600">Deal not found.</p>
        <Link href="/" className="mt-2 inline-block text-sm text-slate-900 underline">
          Back to deals
        </Link>
      </div>
    );
  }
  if (!caseData) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/cases/${caseData.slug}?tab=track`}
        className="text-sm text-slate-500 hover:text-slate-900"
      >
        ← {caseData.name}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
        Add an LP
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Adds an LP to {caseData.name} and creates their NDA.
      </p>

      <div className="mt-6 space-y-4">
        <RequestFromLp caseData={caseData} />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or enter the details yourself
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <LpFields values={values} onChange={setValues} strict={false} />

        <LpSection title="Pipeline">
          <div className="grid gap-4 sm:grid-cols-2">
            <LpField label="Tier" required>
              <select
                className="input"
                value={tier}
                onChange={(e) =>
                  setTier(e.target.value ? (Number(e.target.value) as Tier) : "")
                }
              >
                <option value="">Select a tier…</option>
                {TIERS.map((t) => (
                  <option key={t.value} value={t.value} title={t.description}>
                    {t.label}
                  </option>
                ))}
              </select>
            </LpField>
            <LpField label="Status">
              <select
                className="input"
                value={lpStatus}
                onChange={(e) => setLpStatus(e.target.value as LpStatus)}
              >
                {LP_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </LpField>
          </div>
        </LpSection>

        <LpSection title="NDA details">
          <div className="grid gap-4 sm:grid-cols-2">
            <LpField label="Signing place">
              <input
                className="input"
                value={signingPlace}
                onChange={(e) => setSigningPlace(e.target.value)}
              />
            </LpField>
            <LpField label="Signing date">
              <input
                className="input"
                type="date"
                value={signingDate}
                onChange={(e) => setSigningDate(e.target.value)}
              />
            </LpField>
          </div>
        </LpSection>

        <div className="sticky bottom-4 z-10 space-y-2 pt-2">
          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700 shadow-sm">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 rounded-full bg-white/90 p-2 pl-5 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] backdrop-blur-xl">
            <Link
              href={`/cases/${caseData.slug}?tab=track`}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add LP"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
