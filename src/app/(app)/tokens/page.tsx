"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";

interface TokenRow {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

/** Personal API tokens: let Claude on your PC sync the deal files with the dashboard. */
export default function TokensPage() {
  const [tokens, setTokens] = useState<TokenRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/tokens");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not load your tokens.");
      return;
    }
    setTokens(body.tokens);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setJustCreated(null);
    setCopied(false);
    const res = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) {
      setError(body.error ?? "Could not create the token.");
      return;
    }
    setJustCreated({ name: body.name, token: body.token });
    setName("");
    load();
  }

  async function revoke(t: TokenRow) {
    if (!confirm(`Revoke "${t.name}"? Claude will stop being able to sync with it.`)) return;
    const res = await fetch(`/api/tokens/${t.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not revoke the token.");
      return;
    }
    load();
  }

  async function copy() {
    if (!justCreated) return;
    try {
      await navigator.clipboard.writeText(justCreated.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const active = (tokens ?? []).filter((t) => !t.revoked_at);
  const revoked = (tokens ?? []).filter((t) => t.revoked_at);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">API tokens</h1>
        <p className="mt-1 text-sm text-slate-500">
          A token lets Claude on your computer sync the deal files (open questions) with this
          dashboard, as you. Keep it like a password: set it as the user environment variable{" "}
          <code className="rounded bg-slate-100 px-1">ND_DASHBOARD_TOKEN</code>, and never paste it in a
          chat, a file in the drive or an email.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={create} className="flex gap-2">
        <input
          className="input"
          placeholder="Name, e.g. My laptop"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          Create token
        </button>
      </form>

      {justCreated && (
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Token &ldquo;{justCreated.name}&rdquo; created. Copy it now: it is shown only once.
          </p>
          <code className="block break-all rounded-md bg-white px-3 py-2 text-xs text-slate-800">
            {justCreated.token}
          </code>
          <div className="flex items-center gap-3">
            <button
              onClick={copy}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => setJustCreated(null)}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              I saved it
            </button>
          </div>
        </div>
      )}

      {!tokens ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <ul className="space-y-2">
            {active.length === 0 && (
              <li className="text-sm text-slate-500">No active tokens.</li>
            )}
            {active.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-400">
                    Created {formatDate(t.created_at.slice(0, 10))} ·{" "}
                    {t.last_used_at
                      ? `last used ${formatDate(t.last_used_at.slice(0, 10))}`
                      : "never used"}
                  </p>
                </div>
                <button
                  onClick={() => revoke(t)}
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
          {revoked.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Revoked
              </h2>
              <ul className="space-y-1">
                {revoked.map((t) => (
                  <li key={t.id} className="text-sm text-slate-400">
                    {t.name} · revoked {formatDate((t.revoked_at as string).slice(0, 10))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
