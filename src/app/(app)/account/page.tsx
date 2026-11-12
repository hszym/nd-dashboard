"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/password";

/** Change your own password. Also where an account created with a temporary password is sent first. */
function AccountForm() {
  const router = useRouter();
  const forced = useSearchParams().get("forced") === "1";
  const [email, setEmail] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = validateNewPassword(next, confirm, current);
    if (problem) {
      setError(problem);
      return;
    }
    if (!email) {
      setError("You are not signed in.");
      return;
    }
    setSaving(true);
    // Check the current (or temporary) password first, so a stolen open session can't change it.
    const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (checkError) {
      setSaving(false);
      setError("The current password is incorrect.");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({
      password: next,
      data: { must_change_password: false },
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
    if (forced) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {forced ? "Choose your password" : "Account"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {forced
            ? "You signed in with a temporary password. Set your own to continue."
            : `Signed in as ${email ?? "…"}. Change your password below.`}
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {done && !forced && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Password changed.
        </p>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            {forced ? "Temporary password" : "Current password"}
          </span>
          <input
            type="password"
            autoComplete="current-password"
            className="input"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            New password
          </span>
          <input
            type="password"
            autoComplete="new-password"
            className="input"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <span className="mt-1 block text-xs text-slate-400">At least {MIN_PASSWORD_LENGTH} characters.</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Confirm new password
          </span>
          <input
            type="password"
            autoComplete="new-password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={saving || !current || !next || !confirm}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountForm />
    </Suspense>
  );
}
