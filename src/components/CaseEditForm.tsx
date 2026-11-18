"use client";

import { useState } from "react";
import {
  supabase,
  Case,
  CaseRound,
  DdStage,
  DD_STAGES,
  Stage,
  COMMON_CURRENCIES,
} from "@/lib/supabase";
import { createRound, deleteRound, updateRound } from "@/lib/rounds";

/** Edit form for a deal's information (moved from the old case page). */
export default function CaseEditForm({
  caseData,
  rounds,
  onRoundsChanged,
  onSaved,
  onCancel,
  onDeleted,
}: {
  caseData: Case;
  rounds: CaseRound[];
  /** Called after a round was added, saved or deleted, so the deal page reloads. */
  onRoundsChanged: () => void;
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
        dd_stage: draft.dd_stage ?? "Not started",
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
        <Field label="Due Diligence Stage">
          <select
            className="input"
            value={draft.dd_stage ?? "Not started"}
            onChange={(e) => setDraft({ ...draft, dd_stage: e.target.value as DdStage })}
          >
            {DD_STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>

      <RoundsEditor caseId={caseData.id} rounds={rounds} onChanged={onRoundsChanged} />

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

/**
 * The deal's funding rounds: each has its own target, remaining amount, currency,
 * deadline and status. Saved round by round (independently of the rest of the form).
 */
function RoundsEditor({
  caseId,
  rounds,
  onChanged,
}: {
  caseId: string;
  rounds: CaseRound[];
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    const { error: err } = await createRound(caseId, rounds, name, rounds[rounds.length - 1]?.currency ?? "EUR");
    if (err) {
      setError(err);
      return;
    }
    setNewName("");
    onChanged();
  }

  return (
    <div className="space-y-3">
      <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
        Funding rounds
      </span>
      {rounds.map((r) => (
        <RoundForm key={r.id} round={r} canDelete={rounds.length > 1} onChanged={onChanged} onError={setError} />
      ))}
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="New round (e.g. Series A)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!newName.trim()}
          className="shrink-0 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          + Round
        </button>
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function RoundForm({
  round,
  canDelete,
  onChanged,
  onError,
}: {
  round: CaseRound;
  canDelete: boolean;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [draft, setDraft] = useState(round);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(round);
  const num = (v: string) => (v ? Number(v) : null);

  async function save() {
    setSaving(true);
    onError(null);
    const err = await updateRound(round.id, {
      name: draft.name.trim() || round.name,
      status: draft.status,
      currency: draft.currency.trim().toUpperCase() || "EUR",
      amount_target: draft.amount_target,
      amount_remaining: draft.amount_remaining,
      deadline: draft.deadline || null,
    });
    setSaving(false);
    if (err) return onError(err);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Delete "${round.name}" with its Term Sheet, 2-pager and Case Review? This cannot be undone.`)) return;
    onError(null);
    const err = await deleteRound(round.id);
    if (err) return onError(err);
    onChanged();
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Name">
          <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Status">
          <select
            className="input"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as CaseRound["status"] })}
          >
            <option value="raising">Raising</option>
            <option value="closed">Closed</option>
          </select>
        </Field>
        <Field label="Currency">
          <input
            className="input"
            list={`currency-${round.id}`}
            value={draft.currency}
            onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
            placeholder="EUR"
          />
          <datalist id={`currency-${round.id}`}>
            {COMMON_CURRENCIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Deadline">
          <input
            className="input"
            type="date"
            value={draft.deadline ?? ""}
            onChange={(e) => setDraft({ ...draft, deadline: e.target.value || null })}
          />
        </Field>
        <Field label="Target amount">
          <input
            className="input"
            type="number"
            value={draft.amount_target ?? ""}
            onChange={(e) => setDraft({ ...draft, amount_target: num(e.target.value) })}
          />
        </Field>
        <Field label="Amount remaining">
          <input
            className="input"
            type="number"
            value={draft.amount_remaining ?? ""}
            onChange={(e) => setDraft({ ...draft, amount_remaining: num(e.target.value) })}
          />
        </Field>
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save round"}
        </button>
        {canDelete && (
          <button type="button" onClick={remove} className="text-xs text-slate-400 hover:text-red-500">
            Delete round
          </button>
        )}
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
