"use client";

import { useState } from "react";
import {
  supabase,
  Case,
  Stage,
  COMMON_CURRENCIES,
} from "@/lib/supabase";

/** Edit form for a deal's information (moved from the old case page). */
export default function CaseEditForm({
  caseData,
  onSaved,
  onCancel,
  onDeleted,
}: {
  caseData: Case;
  onSaved: () => void;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState<Partial<Case>>(caseData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveCase() {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("cases")
      .update({
        name: draft.name,
        sector: draft.sector || null,
        sponsor: draft.sponsor || null,
        stage: draft.stage,
        amount_target: draft.amount_target ?? null,
        amount_remaining: draft.amount_remaining ?? null,
        currency: draft.currency?.trim().toUpperCase() || "EUR",
        deadline: draft.deadline || null,
        onedrive_url: draft.onedrive_url?.trim() || null,
        notes: draft.notes || null,
      })
      .eq("id", caseData.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  async function deleteCase() {
    if (
      !confirm(
        `Delete "${caseData.name}" and all its documents? This cannot be undone.`
      )
    )
      return;
    await supabase.from("cases").delete().eq("id", caseData.id);
    onDeleted();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            className="input"
            value={draft.name ?? ""}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="Sector">
          <input
            className="input"
            value={draft.sector ?? ""}
            onChange={(e) => setDraft({ ...draft, sector: e.target.value })}
          />
        </Field>
        <Field label="Sponsor">
          <input
            className="input"
            value={draft.sponsor ?? ""}
            onChange={(e) => setDraft({ ...draft, sponsor: e.target.value })}
          />
        </Field>
        <Field label="Stage">
          <select
            className="input"
            value={draft.stage ?? "Under Review"}
            onChange={(e) => setDraft({ ...draft, stage: e.target.value as Stage })}
          >
            <option>Under Review</option>
            <option>Raising</option>
            <option>Completed</option>
          </select>
        </Field>
        <Field label="Deadline">
          <input
            className="input"
            type="date"
            value={draft.deadline ?? ""}
            onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
          />
        </Field>
        <Field label="Currency">
          <input
            className="input"
            list="currency-options"
            value={draft.currency ?? "EUR"}
            onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
            placeholder="EUR"
          />
          <datalist id="currency-options">
            {COMMON_CURRENCIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Target amount">
          <input
            className="input"
            type="number"
            value={draft.amount_target ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                amount_target: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </Field>
        <Field label="Amount remaining">
          <input
            className="input"
            type="number"
            value={draft.amount_remaining ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                amount_remaining: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </Field>
      </div>

      <Field label="OneDrive folder">
        <input
          className="input"
          placeholder="https://…sharepoint.com/…"
          value={draft.onedrive_url ?? ""}
          onChange={(e) => setDraft({ ...draft, onedrive_url: e.target.value })}
        />
        <span className="mt-1 block text-xs normal-case tracking-normal text-slate-400">
          Claude Code works inside this folder; its .md files hold the deal details.
        </span>
      </Field>

      <Field label="Notes">
        <textarea
          className="input min-h-24"
          value={draft.notes ?? ""}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </Field>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-3">
          <button
            onClick={saveCase}
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onCancel}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Cancel
          </button>
        </div>
        <button
          onClick={deleteCase}
          className="text-xs text-slate-400 hover:text-red-500"
        >
          Delete deal
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
