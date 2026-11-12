"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

/** Asks for an email and sends a reset link. The answer never says whether the email has an account. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    // Rate-limit errors are worth showing; anything else looks like success to the visitor.
    if (err && /rate|limit|too many/i.test(err.message)) {
      setError("Too many requests. Please wait a few minutes and try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8">
        <h1 className="mb-1 text-base font-semibold tracking-tight text-slate-900">Forgot your password?</h1>
        <p className="mb-5 text-sm text-slate-500">
          Enter your email. If it has an account, we send you a link to choose a new password.
        </p>
        {sent ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            If this email has an account, a link is on its way. It can take a few minutes. Check your spam folder too.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <input
              type="email"
              autoFocus
              required
              className="input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={sending || !email}
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send the link"}
            </button>
          </form>
        )}
        <Link href="/login" className="mt-5 block text-center text-xs text-slate-500 hover:text-slate-900">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
