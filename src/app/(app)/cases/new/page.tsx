"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  supabase,
  DOCUMENT_TYPES,
  BrandColor,
  Stage,
  COMMON_CURRENCIES,
} from "@/lib/supabase";
import { slugify } from "@/lib/utils";

const DEFAULT_COLORS: BrandColor[] = [
  { label: "Primary", hex: "1C3D5A" },
  { label: "Secondary", hex: "C9A227" },
];

export default function NewCasePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [stage, setStage] = useState<Stage>("Under Review");
  const [amountTarget, setAmountTarget] = useState("");
  const [amountRemaining, setAmountRemaining] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [deadline, setDeadline] = useState("");
  const [claudeProjectUrl, setClaudeProjectUrl] = useState("");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [colors, setColors] = useState<BrandColor[]>(DEFAULT_COLORS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateColor(i: number, field: keyof BrandColor, value: string) {
    setColors((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c))
    );
  }

  function addColor() {
    setColors((prev) => [...prev, { label: "", hex: "" }]);
  }

  function removeColor(i: number) {
    setColors((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Case name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const slug = slugify(name);
    const cleanColors = colors.filter((c) => c.label.trim() && c.hex.trim());

    const { data: caseRow, error: caseError } = await supabase
      .from("cases")
      .insert({
        slug,
        name: name.trim(),
        sector: sector.trim() || null,
        sponsor: sponsor.trim() || null,
        stage,
        amount_target: amountTarget ? Number(amountTarget) : null,
        amount_remaining: amountRemaining ? Number(amountRemaining) : null,
        currency: currency.trim().toUpperCase() || "EUR",
        deadline: deadline || null,
        claude_project_url: claudeProjectUrl.trim() || null,
        drive_folder_url: driveFolderUrl.trim() || null,
        logo_url: logoUrl.trim() || null,
        notes: notes.trim() || null,
        brand_colors: cleanColors,
      })
      .select()
      .single();

    if (caseError || !caseRow) {
      setError(caseError?.message ?? "Could not create the case.");
      setSaving(false);
      return;
    }

    const docRows = DOCUMENT_TYPES.map((type) => ({
      case_id: caseRow.id,
      type,
      status: "Missing" as const,
    }));
    const { error: docsError } = await supabase.from("documents").insert(docRows);
    if (docsError) {
      setError(
        `Case created, but document checklist could not be initialised: ${docsError.message}`
      );
      setSaving(false);
      return;
    }

    router.push(`/cases/${slug}`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900">New case</h1>
      <p className="mt-1 text-sm text-slate-500">
        Creates the case and initialises its 7-document checklist as “Missing”.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <Field label="Case name *">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project Atlas"
          />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Sector">
            <input
              className="input"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="e.g. Renewable energy"
            />
          </Field>
          <Field label="Sponsor">
            <input
              className="input"
              value={sponsor}
              onChange={(e) => setSponsor(e.target.value)}
              placeholder="e.g. Domino Nova"
            />
          </Field>
          <Field label="Stage">
            <select
              className="input"
              value={stage}
              onChange={(e) => setStage(e.target.value as Stage)}
            >
              <option>Under Review</option>
              <option>Raising</option>
              <option>Completed</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Field label="Target amount">
            <input
              className="input"
              type="number"
              value={amountTarget}
              onChange={(e) => setAmountTarget(e.target.value)}
            />
          </Field>
          <Field label="Amount remaining">
            <input
              className="input"
              type="number"
              value={amountRemaining}
              onChange={(e) => setAmountRemaining(e.target.value)}
            />
          </Field>
          <Field label="Currency">
            <input
              className="input"
              list="currency-options"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="EUR"
            />
            <datalist id="currency-options">
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Deadline">
            <input
              className="input"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Claude project URL">
            <input
              className="input"
              value={claudeProjectUrl}
              onChange={(e) => setClaudeProjectUrl(e.target.value)}
              placeholder="https://claude.ai/project/…"
            />
          </Field>
          <Field label="Drive folder URL">
            <input
              className="input"
              value={driveFolderUrl}
              onChange={(e) => setDriveFolderUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
            />
          </Field>
        </div>

        <Field label="Logo URL">
          <input
            className="input"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…/logo.png"
          />
        </Field>

        <Field label="Brand colors">
          <div className="space-y-2">
            {colors.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  placeholder="Label (e.g. Primary)"
                  value={c.label}
                  onChange={(e) => updateColor(i, "label", e.target.value)}
                />
                <input
                  className="input w-28"
                  placeholder="1C3D5A"
                  value={c.hex}
                  onChange={(e) =>
                    updateColor(i, "hex", e.target.value.replace("#", ""))
                  }
                />
                <span
                  className="h-8 w-8 shrink-0 rounded-md border border-slate-200"
                  style={{
                    backgroundColor: /^[0-9a-fA-F]{6}$/.test(c.hex)
                      ? `#${c.hex}`
                      : "transparent",
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeColor(i)}
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addColor}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              + Add color
            </button>
          </div>
        </Field>

        <Field label="Notes">
          <textarea
            className="input min-h-24"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create case"}
          </button>
        </div>
      </form>
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
