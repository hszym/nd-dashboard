"use client";

import { useState } from "react";

/** Admin-only: imports a tracker workbook (.xlsx) into a named workspace. Safe to re-run. */
export default function ImportForm({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/tracker/import", { method: "POST", body: new FormData(e.currentTarget) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(body.error ?? "Import failed.");
    setMsg(`Imported ${body.inserted} to-dos (${body.skipped} already there).`);
    onDone();
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
      <p className="font-medium text-slate-800">Import a tracker workbook</p>
      <input name="workspace" required placeholder="Workspace name (e.g. Hercinia Due Diligence)" className="w-full rounded-lg border border-slate-200 px-3 py-2" />
      <input name="file" type="file" accept=".xlsx" required className="w-full text-xs" />
      <button disabled={busy} className="rounded-full bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">{busy ? "Importing…" : "Import"}</button>
      {msg && <p className="text-slate-600">{msg}</p>}
    </form>
  );
}
