"use client";

import { useRef, useState } from "react";
import {
  supabase,
  Case,
  InboxFile,
  CASE_INBOX_BUCKET,
  CASE_INBOX_MAX_FILE_BYTES,
  inboxStoragePath,
} from "@/lib/supabase";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drop documents and/or a note received on a deal. They go to a private
 * "to review" inbox for that deal, which admins review.
 */
export default function AddInfoPanel({
  caseData,
  onSubmitted,
  onClose,
}: {
  caseData: Case;
  onSubmitted: () => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: File[] = [];
    for (const f of Array.from(list)) {
      if (f.size > CASE_INBOX_MAX_FILE_BYTES) {
        setError(`${f.name} is larger than 50 MB.`);
        continue;
      }
      next.push(f);
    }
    if (next.length) {
      setError(null);
      setFiles((prev) => [...prev, ...next]);
    }
  }

  async function submit() {
    const trimmed = note.trim();
    if (files.length === 0 && !trimmed) {
      setError("Add at least a file or a note.");
      return;
    }
    setBusy(true);
    setError(null);

    const itemId = crypto.randomUUID();
    const uploaded: InboxFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = inboxStoragePath(caseData.slug, itemId, i, f.name);
      const { error: upErr } = await supabase.storage
        .from(CASE_INBOX_BUCKET)
        .upload(path, f, {
          contentType: f.type || "application/octet-stream",
        });
      if (upErr) {
        // Roll back anything already uploaded for this submission.
        if (uploaded.length) {
          await supabase.storage
            .from(CASE_INBOX_BUCKET)
            .remove(uploaded.map((u) => u.path));
        }
        setBusy(false);
        setError(`Could not upload ${f.name}: ${upErr.message}`);
        return;
      }
      uploaded.push({
        name: f.name,
        path,
        size: f.size,
        type: f.type || "application/octet-stream",
      });
    }

    const { error: insErr } = await supabase.from("case_inbox_items").insert({
      id: itemId,
      case_id: caseData.id,
      note: trimmed || null,
      files: uploaded,
    });
    if (insErr) {
      if (uploaded.length) {
        await supabase.storage
          .from(CASE_INBOX_BUCKET)
          .remove(uploaded.map((u) => u.path));
      }
      setBusy(false);
      setError(insErr.message);
      return;
    }

    setBusy(false);
    setSent(true);
    setFiles([]);
    setNote("");
    onSubmitted();
  }

  if (sent) {
    return (
      <div className="space-y-4 text-sm">
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800">
          Sent for review. Thank you.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setSent(false)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Add more
          </button>
          <button
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Drop documents you received on {caseData.name}, add a note, or both.
        They&apos;ll be kept for this deal until someone reviews them.
      </p>

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
          addFiles(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-8 text-center text-sm ${
          dragOver
            ? "border-slate-900 bg-slate-50 text-slate-700"
            : "border-slate-300 text-slate-500 hover:border-slate-400"
        }`}
      >
        Drop files here, or tap to choose
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-sm text-slate-800">{f.name}</span>
                <span className="block text-xs text-slate-400">{formatSize(f.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-xs text-slate-400 hover:text-red-500"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Note (optional if you add files)
        </span>
        <textarea
          className="input min-h-24"
          placeholder="From whom, what is it, anything we should know…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send for review"}
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
