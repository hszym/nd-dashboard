"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LpFields from "@/components/LpFields";
import { emptyLpValues, LpValues, validateLp } from "@/lib/lp";

type View =
  | { kind: "loading" }
  | { kind: "closed"; message: string }
  | { kind: "open"; dealName: string | null }
  | { kind: "done" };

const CLOSED_MESSAGES: Record<string, string> = {
  used: "These details were already sent. Thank you!",
  expired: "This link has expired. Please ask ND Group for a new one.",
  revoked: "This link is no longer active. Please ask ND Group for a new one.",
  invalid: "We couldn't find this link. Please check it or ask ND Group for a new one.",
};

/** Public form an LP opens from a private link to fill in their own details. */
export default function LpRequestPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [view, setView] = useState<View>({ kind: "loading" });
  const [values, setValues] = useState<LpValues>(emptyLpValues);
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/lp-requests/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.state === "open") {
          setView({ kind: "open", dealName: data.dealName ?? null });
        } else {
          setView({
            kind: "closed",
            message:
              CLOSED_MESSAGES[data.state as string] ??
              "This form is temporarily unavailable. Please try again later.",
          });
        }
      })
      .catch(() => {
        if (active)
          setView({
            kind: "closed",
            message: "We couldn't load this form. Please check your connection and try again.",
          });
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateLp(values, true);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lp-requests/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      setView({ kind: "done" });
    } catch {
      setError("We couldn't send your details. Please check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-16 pt-10">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white">
          ND
        </span>
        <span className="text-base font-semibold tracking-tight">ND Group</span>
      </div>

      {view.kind === "loading" && (
        <p className="mt-16 text-center text-sm text-slate-500">Loading…</p>
      )}

      {view.kind === "closed" && (
        <div className="mt-10 rounded-[1.75rem] bg-white p-8 text-center text-slate-700 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.3)]">
          {view.message}
        </div>
      )}

      {view.kind === "done" && (
        <div className="mt-10 rounded-[1.75rem] bg-white p-8 text-center shadow-[0_12px_32px_-20px_rgba(15,23,42,0.3)]">
          <h1 className="text-xl font-semibold tracking-tight">Thank you</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your details were sent to ND Group. We&apos;ll be in touch shortly with
            the next steps. You can close this page.
          </p>
        </div>
      )}

      {view.kind === "open" && (
        <>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">
            Your details{view.dealName ? ` for ${view.dealName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Please fill in the details below so we can prepare the NDA. It takes about
            two minutes. Fields marked * are required.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <LpFields values={values} onChange={setValues} strict />

            {/* Honeypot: hidden from people, tempting to bots. */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>

            {error && (
              <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send my details"}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
