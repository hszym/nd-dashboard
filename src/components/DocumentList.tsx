"use client";

import { useEffect, useRef, useState } from "react";
import {
  supabase,
  CaseDocument,
  DocumentStatus,
  isEmailDocumentType,
  EMAIL_FILES_BUCKET,
  emailStoragePath,
} from "@/lib/supabase";
import DocStatusBadge from "@/components/DocStatusBadge";

/**
 * The 7 deal documents. Admins edit status/links/email files in place; team
 * members only see documents that are Done and have a file/link.
 */
export default function DocumentList({
  caseId,
  documents,
  editable,
  onUpdate,
}: {
  caseId: string;
  documents: CaseDocument[];
  editable: boolean;
  onUpdate: (
    doc: CaseDocument,
    patch: Partial<Pick<CaseDocument, "status" | "file_url">>
  ) => void;
}) {
  if (!editable) {
    const available = documents.filter((d) => d.status === "Done" && d.file_url);
    if (available.length === 0) {
      return <p className="text-sm text-slate-500">No documents available yet.</p>;
    }
    return (
      <ul className="divide-y divide-slate-100">
        {available.map((doc) => (
          <li key={doc.type} className="flex items-center justify-between py-3">
            <span className="text-sm font-medium text-slate-800">{doc.type}</span>
            <a
              href={doc.file_url!}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 underline"
            >
              {isEmailDocumentType(doc.type) ? "Download ↓" : "Open ↗"}
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {documents.map((doc) => (
        <li key={doc.type} className="space-y-2 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-800">{doc.type}</span>
            <div className="flex items-center gap-2">
              <DocStatusBadge status={doc.status} />
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                value={doc.status}
                onChange={(e) =>
                  onUpdate(doc, { status: e.target.value as DocumentStatus })
                }
              >
                <option>Missing</option>
                <option>In Progress</option>
                <option>Done</option>
              </select>
            </div>
          </div>
          {isEmailDocumentType(doc.type) ? (
            <EmailFileUpload
              caseId={caseId}
              docType={doc.type}
              value={doc.file_url}
              onSave={(url) =>
                onUpdate(doc, {
                  file_url: url,
                  status: url ? "Done" : "Missing",
                })
              }
            />
          ) : (
            <EditableUrl
              value={doc.file_url}
              onSave={(url) => onUpdate(doc, { file_url: url })}
            />
          )}
        </li>
      ))}
    </ul>
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
        className="min-w-0 max-w-[240px] truncate text-xs text-blue-600 underline"
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
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 max-w-[220px] truncate text-xs text-slate-700">
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
        className={`w-full max-w-xs cursor-pointer rounded-md border border-dashed px-3 py-2 text-xs ${
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
