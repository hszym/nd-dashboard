"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/password";

/** Opened from the reset email: turns the link's code into a session, then asks for the new password. */
function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      const code = params.get("code");
      if (params.get("error") || params.get("error_description")) {
        if (!cancelled) setState("invalid");
        return;
      }
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled) setState(exchangeError ? "invalid" : "ready");
        return;
      }
      // A link opened in an already signed-in browser, or one that carried its tokens in the address.
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setState(data.session ? "ready" : "invalid");
    }
    start();
    return () => {
      cancelled = true;
    };
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = validateNewPassword(next, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: next,
      data: { must_change_password: false },
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8">
        <h1 className="mb-1 text-base font-semibold tracking-tight text-slate-900">Choose a new password</h1>
        {state === "checking" && <p className="text-sm text-slate-500">Checking your link…</p>}
        {state === "invalid" && (
          <div className="space-y-3">
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              This link is invalid or has expired. Links work once.
            </p>
            <Link href="/forgot-password" className="block text-sm font-medium text-slate-700 hover:text-slate-900">
              Send a new link
            </Link>
          </div>
        )}
        {state === "ready" && (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">New password</span>
              <input
                type="password"
                autoFocus
                autoComplete="new-password"
                className="input"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <span className="mt-1 block text-xs text-slate-400">At least {MIN_PASSWORD_LENGTH} characters.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Confirm</span>
              <input
                type="password"
                autoComplete="new-password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving || !next || !confirm}
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save and sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
