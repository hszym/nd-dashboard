"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  supabase,
  Case,
  CaseDocument,
  DocumentStatus,
  DOCUMENT_TYPES,
  BrandColor,
  Stage,
  COMMON_CURRENCIES,
  isEmailDocumentType,
  EMAIL_FILES_BUCKET,
  emailStoragePath,
} from "@/lib/supabase";
import StageBadge from "@/components/StageBadge";
import DocStatusBadge from "@/components/DocStatusBadge";
import TeamCaseView from "@/components/TeamCaseView";
import { useRole } from "@/lib/useRole";
import { formatAmount, formatDate } from "@/lib/utils";

export default function CaseDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const role = useRole();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // editable draft fields
  const [draft, setDraft] = useState<Partial<Case>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data: c, error: cErr } = await supabase
      .from("cases")
      .select("*")
      .eq("slug", params.slug)
      .maybeSingle();
    if (cErr || !c) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setCaseData(c);
    setDraft(c);
    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .eq("case_id", c.id);
    const byType = new Map((docs ?? []).map((d) => [d.type, d]));
    const ordered = DOCUMENT_TYPES.map(
      (t) =>
        byType.get(t) ?? {
          id: `missing-${t}`,
          case_id: c.id,
          type: t,
          status: "Missing" as DocumentStatus,
          file_url: null,
          updated_at: c.created_at,
        }
    );
    setDocuments(ordered);
    setLoading(false);
  }, [params.slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function saveCase() {
    if (!caseData) return;
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
        claude_project_url: draft.claude_project_url || null,
        drive_folder_url: draft.drive_folder_url || null,
        logo_url: draft.logo_url || null,
        notes: draft.notes || null,
        brand_colors: draft.brand_colors ?? [],
      })
      .eq("id", caseData.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(false);
    load();
  }

  async function updateDocument(
    doc: CaseDocument,
    patch: Partial<Pick<CaseDocument, "status" | "file_url">>
  ) {
    if (!caseData) return;
    // optimistic update
    setDocuments((prev) =>
      prev.map((d) => (d.type === doc.type ? { ...d, ...patch } : d))
    );
    if (doc.id.startsWith("missing-")) {
      const { data, error } = await supabase
        .from("documents")
        .insert({
          case_id: caseData.id,
          type: doc.type,
          status: patch.status ?? "Missing",
          file_url: patch.file_url ?? null,
        })
        .select()
        .single();
      if (!error && data) {
        setDocuments((prev) =>
          prev.map((d) => (d.type === doc.type ? data : d))
        );
      }
    } else {
      await supabase.from("documents").update(patch).eq("id", doc.id);
    }
  }

  async function deleteCase() {
    if (!caseData) return;
    if (!confirm(`Delete "${caseData.name}" and all its documents? This cannot be undone.`)) return;
    await supabase.from("cases").delete().eq("id", caseData.id);
    router.push("/");
  }

  function updateColor(i: number, field: keyof BrandColor, value: string) {
    setDraft((prev) => {
      const colors = [...(prev.brand_colors ?? [])];
      colors[i] = { ...colors[i], [field]: value };
      return { ...prev, brand_colors: colors };
    });
  }

  function addColor() {
    setDraft((prev) => ({
      ...prev,
      brand_colors: [...(prev.brand_colors ?? []), { label: "", hex: "" }],
    }));
  }

  function removeColor(i: number) {
    setDraft((prev) => ({
      ...prev,
      brand_colors: (prev.brand_colors ?? []).filter((_, idx) => idx !== i),
    }));
  }

  if (loading || role === undefined)
    return <p className="text-sm text-slate-500">Loading…</p>;
  if (notFound || !caseData)
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Case not found.</p>
        <Link href="/" className="mt-2 inline-block text-sm text-slate-900 underline">
          Back to cases
        </Link>
      </div>
    );

  if (role === "team") {
    return (
      <div className="space-y-8">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
            ← All cases
          </Link>
        </div>
        <TeamCaseView caseData={caseData} documents={documents} />
      </div>
    );
  }

  const done = documents.filter((d) => d.status === "Done").length;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← All cases
        </Link>
      </div>

      {/* Header / metadata */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {!editing ? (
          <>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {caseData.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={caseData.logo_url}
                    alt=""
                    className="h-10 w-auto object-contain"
                  />
                )}
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">
                    {caseData.name}
                  </h1>
                  {(caseData.sector || caseData.sponsor) && (
                    <p className="text-sm text-slate-500">
                      {[caseData.sector, caseData.sponsor && `Sponsor: ${caseData.sponsor}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StageBadge stage={caseData.stage} />
                <button
                  onClick={() => {
                    setDraft(caseData);
                    setEditing(true);
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Info label="Target amount" value={formatAmount(caseData.amount_target, caseData.currency)} />
              <Info label="Remaining" value={formatAmount(caseData.amount_remaining, caseData.currency)} />
              <Info label="Deadline" value={formatDate(caseData.deadline)} />
              <Info label="Documents ready" value={`${done}/${DOCUMENT_TYPES.length}`} />
            </div>

            {(caseData.claude_project_url || caseData.drive_folder_url) && (
              <div className="mt-4 flex gap-4 text-sm">
                {caseData.claude_project_url && (
                  <a
                    href={caseData.claude_project_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-600 underline hover:text-slate-900"
                  >
                    Claude project ↗
                  </a>
                )}
                {caseData.drive_folder_url && (
                  <a
                    href={caseData.drive_folder_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-600 underline hover:text-slate-900"
                  >
                    Drive folder ↗
                  </a>
                )}
              </div>
            )}

            {caseData.brand_colors?.length > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  Brand
                </span>
                {caseData.brand_colors.map((c, i) => (
                  <span
                    key={i}
                    title={`${c.label} #${c.hex}`}
                    className="h-5 w-5 rounded-full border border-slate-200"
                    style={{ backgroundColor: `#${c.hex}` }}
                  />
                ))}
              </div>
            )}

            {caseData.notes && (
              <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">
                {caseData.notes}
              </p>
            )}

            <div className="mt-5 border-t border-slate-100 pt-4">
              <button
                onClick={deleteCase}
                className="text-xs text-slate-400 hover:text-red-500"
              >
                Delete case
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                  onChange={(e) =>
                    setDraft({ ...draft, stage: e.target.value as Stage })
                  }
                >
                  <option>Under Review</option>
                  <option>Raising</option>
                  <option>Completed</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
              <Field label="Claude project URL">
                <input
                  className="input"
                  value={draft.claude_project_url ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, claude_project_url: e.target.value })
                  }
                />
              </Field>
              <Field label="Drive folder URL">
                <input
                  className="input"
                  value={draft.drive_folder_url ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, drive_folder_url: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Logo URL">
              <input
                className="input"
                value={draft.logo_url ?? ""}
                onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })}
              />
            </Field>

            <Field label="Brand colors">
              <div className="space-y-2">
                {(draft.brand_colors ?? []).map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="input flex-1"
                      placeholder="Label"
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
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </Field>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={saveCase}
                disabled={saving}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-sm text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document checklist */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Document checklist
          </h2>
        </div>
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-6 py-2">Document</th>
              <th className="px-6 py-2">Status</th>
              <th className="px-6 py-2">Content</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <tr key={doc.type}>
                <td className="px-6 py-3 font-medium text-slate-800">
                  {doc.type}
                </td>
                <td className="px-6 py-3">
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                    value={doc.status}
                    onChange={(e) =>
                      updateDocument(doc, {
                        status: e.target.value as DocumentStatus,
                      })
                    }
                  >
                    <option>Missing</option>
                    <option>In Progress</option>
                    <option>Done</option>
                  </select>
                  <span className="ml-2 hidden sm:inline">
                    <DocStatusBadge status={doc.status} />
                  </span>
                </td>
                <td className="px-6 py-3">
                  {isEmailDocumentType(doc.type) ? (
                    <EmailFileUpload
                      caseId={caseData.id}
                      docType={doc.type}
                      value={doc.file_url}
                      onSave={(url) =>
                        updateDocument(doc, {
                          file_url: url,
                          status: url ? "Done" : "Missing",
                        })
                      }
                    />
                  ) : (
                    <EditableUrl
                      value={doc.file_url}
                      onSave={(url) => updateDocument(doc, { file_url: url })}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 font-medium text-slate-800">{value}</div>
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

function EditableUrl({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (url: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resync local draft when the saved value changes externally
    setDraft(value ?? "");
  }, [value]);

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          className="input py-1 text-xs"
          placeholder="https://drive.google.com/…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(draft.trim() || null);
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <button
          onClick={() => {
            onSave(draft.trim() || null);
            setEditing(false);
          }}
          className="text-xs font-medium text-slate-700 hover:text-slate-900"
        >
          Save
        </button>
      </div>
    );
  }

  return value ? (
    <div className="flex items-center gap-3">
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="max-w-[240px] truncate text-xs text-blue-600 underline"
      >
        {value}
      </a>
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-slate-400 hover:text-slate-900"
      >
        Edit
      </button>
    </div>
  ) : (
    <button
      onClick={() => setEditing(true)}
      className="text-xs text-slate-400 hover:text-slate-900"
    >
      + Add link
    </button>
  );
}

const EMAIL_EXTENSIONS = ["msg", "eml"];

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.split("/").pop() || "file");
  } catch {
    return url.split("/").pop() || url;
  }
}

function EmailFileUpload({
  caseId,
  docType,
  value,
  onSave,
}: {
  caseId: string;
  docType: CaseDocument["type"];
  value: string | null;
  onSave: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!EMAIL_EXTENSIONS.includes(ext)) {
      setError("Only .msg or .eml files.");
      return;
    }
    setUploading(true);
    setError(null);
    const path = emailStoragePath(caseId, docType, ext);
    const { error: upErr } = await supabase.storage
      .from(EMAIL_FILES_BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType:
          ext === "msg" ? "application/vnd.ms-outlook" : "message/rfc822",
      });
    if (upErr) {
      setUploading(false);
      setError(upErr.message);
      return;
    }
    const { data } = supabase.storage.from(EMAIL_FILES_BUCKET).getPublicUrl(path);
    setUploading(false);
    onSave(`${data.publicUrl}?download=${encodeURIComponent(file.name)}`);
  }

  if (value) {
    return (
      <div className="flex items-center gap-3">
        <span className="max-w-[220px] truncate text-xs text-slate-700">
          📎 {fileNameFromUrl(value)}
        </span>
        <button
          onClick={() => inputRef.current?.click()}
          className="text-xs text-slate-400 hover:text-slate-900"
        >
          Replace
        </button>
        <button
          onClick={() => onSave(null)}
          className="text-xs text-slate-400 hover:text-red-500"
        >
          Remove
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".msg,.eml"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`w-64 cursor-pointer rounded-md border border-dashed px-3 py-2 text-xs ${
          dragOver
            ? "border-slate-900 bg-slate-50 text-slate-700"
            : "border-slate-300 text-slate-400 hover:text-slate-600"
        }`}
      >
        {uploading ? "Uploading…" : "Drop .msg / .eml here, or click"}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".msg,.eml"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
