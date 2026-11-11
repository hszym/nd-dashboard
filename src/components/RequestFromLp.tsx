"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, Case, LpRequest } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * "Request from LP": makes a private single-use link to a public form the LP
 * fills in themselves, and copies it. Pending links can be copied again or revoked.
 */
export default function RequestFromLp({ caseData }: { caseData: Case }) {
  const [pending, setPending] = useState<LpRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  const linkFor = (token: string) => `${window.location.origin}/lp-request/${token}`;

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("lp_requests")
      .select("*")
      .eq("case_id", caseData.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      return;
    }
    const now = Date.now();
    setPending(
      ((data as LpRequest[]) ?? []).filter((r) => new Date(r.expires_at).getTime() > now)
    );
  }, [caseData.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function copy(token: string) {
    const link = linkFor(token);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(token);
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 2500);
    } catch {
      // Clipboard blocked: leave the link selected so it can be copied by hand.
      setLastLink(link);
      setTimeout(() => linkRef.current?.select(), 50);
    }
  }

  async function create() {
    setBusy(true);
    setError(null);
    const token = newToken();
    const { error: err } = await supabase
      .from("lp_requests")
      .insert({ case_id: caseData.id, token });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setLastLink(linkFor(token));
    await copy(token);
    load();
  }

  async function revoke(r: LpRequest) {
    setPending((prev) => prev.filter((p) => p.id !== r.id));
    if (lastLink === linkFor(r.token)) setLastLink(null);
    await supabase.from("lp_requests").update({ status: "revoked" }).eq("id", r.id);
  }

  return (
    <section className="rounded-[1.75rem] bg-white p-5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.3)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            Let the LP fill it in
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Creates a private link for one LP. They enter their own details and
            they appear in your tracker.
          </p>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Request from LP"}
        </button>
      </div>

      {lastLink && (
        <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-medium text-emerald-700">
            {copied ? "Link copied. Send it to the LP." : "Copy this link and send it to the LP."}
          </p>
          <input
            ref={linkRef}
            readOnly
            value={lastLink}
            onFocus={(e) => e.currentTarget.select()}
            className="input text-xs"
          />
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {pending.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-medium text-slate-500">
            Waiting for the LP ({pending.length})
          </h3>
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm text-slate-700">
                  Created {formatDate(r.created_at.slice(0, 10))}
                  <span className="text-xs text-slate-400">
                    {" "}
                    · expires {formatDate(r.expires_at.slice(0, 10))}
                  </span>
                </span>
                <span className="flex shrink-0 gap-4">
                  <button
                    type="button"
                    onClick={() => copy(r.token)}
                    className="text-xs font-medium text-slate-700 hover:text-slate-900"
                  >
                    {copied === r.token ? "Copied" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => revoke(r)}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    Revoke
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
