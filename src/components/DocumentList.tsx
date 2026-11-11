"use client";

import { useEffect, useRef, useState } from "react";
import {
  supabase,
  CaseDocument,
  isDocumentReady,
  emailAttachments,
  EMAIL_ATTACHMENT_TYPES,
  CASE_FILES_BUCKET,
  CASE_FILE_MAX_BYTES,
  attachmentStoragePath,
} from "@/lib/supabase";
import IntroEmailCard from "@/components/IntroEmailPanel";
import type { IntroEmailTemplate } from "@/lib/intro-email";

const SVG_PROPS = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function FileIcon({ ready }: { ready: boolean }) {
  return (
    <svg {...SVG_PROPS}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      {ready ? <path d="m9 14 2 2 4-4" /> : <path d="M9 13h6M9 17h4" />}
    </svg>
  );
}

/**
 * The deal's documents as cards. A card with a link opens the file straight
 * away in a new tab. Admins also get a pencil to change the link, and to keep
 * a PDF of the 2-pager and the Deck in the app. The Intro Email card builds
 * the email with those PDFs attached.
 */
export default function DocumentList({
  caseId,
  caseName,
  documents,
  editable,
  folderUrl,
  introEmail,
  onUpdate,
}: {
  caseId: string;
  caseName: string;
  documents: CaseDocument[];
  editable: boolean;
  /** The deal's OneDrive folder, offered as a shortcut for admins. */
  folderUrl?: string | null;
  /** The deal's own intro email wording, if it has one. */
  introEmail?: IntroEmailTemplate | null;
  onUpdate: (
    doc: CaseDocument,
    patch: Partial<Pick<CaseDocument, "file_url" | "attachment_url">>
  ) => void;
}) {
  const [openType, setOpenType] = useState<string | null>(null);

  const isReady = (d: CaseDocument) => isDocumentReady(d, documents);
  const shown = editable ? documents : documents.filter(isReady);
  const ready = documents.filter(isReady).length;
  const attachments = emailAttachments(documents);

  if (!editable && shown.length === 0) {
    return <p className="text-sm text-slate-500">No documents available yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-900">
            {ready} of {documents.length} ready
          </span>
          {editable && folderUrl && (
            <a
              href={folderUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Open OneDrive folder ↗
            </a>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{
              width: `${documents.length ? (ready / documents.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <ul className="space-y-2">
        {shown.map((doc) => {
          // The intro email has nothing to store: its card opens the email directly.
          if (doc.type === "Intro Email") {
            return (
              <li key={doc.type}>
                <IntroEmailCard
                  caseName={caseName}
                  template={introEmail}
                  sources={attachments.map((a) => ({
                    label: a.type,
                    url: a.attachment_url!,
                  }))}
                />
              </li>
            );
          }

          const canAttach = EMAIL_ATTACHMENT_TYPES.includes(doc.type);
          const hasLink = Boolean(doc.file_url);
          const available = isReady(doc);
          const expanded = openType === doc.type && editable;

          const toggle = () => setOpenType(expanded ? null : doc.type);

          const subtitle = !hasLink && editable
            ? "No link yet"
            : canAttach && doc.attachment_url
              ? "PDF ready for the intro email"
              : null;

          const body = (
            <>
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  available
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <FileIcon ready={available} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {doc.type}
                </span>
                {subtitle && (
                  <span className="mt-0.5 block truncate text-xs text-slate-400">
                    {subtitle}
                  </span>
                )}
              </span>
              {hasLink && (
                <span className="shrink-0 text-xs font-medium text-slate-500 group-hover:text-slate-900">
                  Open ↗
                </span>
              )}
            </>
          );

          const rowClass =
            "group flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 text-left";

          return (
            <li
              key={doc.type}
              className={`rounded-2xl border bg-white transition-shadow ${
                expanded ? "border-slate-300 shadow-sm" : "border-slate-200 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center">
                {hasLink ? (
                  <a
                    href={doc.file_url!}
                    target="_blank"
                    rel="noreferrer"
                    className={`${rowClass} hover:bg-slate-50`}
                  >
                    {body}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={toggle}
                    className={`${rowClass} hover:bg-slate-50`}
                  >
                    {body}
                  </button>
                )}
                {editable && (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label={`Edit ${doc.type}`}
                    aria-expanded={expanded}
                    className={`mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 ${
                      expanded ? "bg-slate-100 text-slate-900" : ""
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                    </svg>
                  </button>
                )}
              </div>

              {expanded && (
                <div className="space-y-4 border-t border-slate-100 p-3">
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500">
                      Link (OneDrive)
                    </div>
                    <EditableUrl
                      value={doc.file_url}
                      onSave={(url) => onUpdate(doc, { file_url: url })}
                    />
                  </div>
                  {canAttach && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-slate-500">
                        PDF for the intro email
                      </div>
                      <PdfAttachmentUpload
                        caseId={caseId}
                        docType={doc.type}
                        value={doc.attachment_url}
                        onSave={(url) => onUpdate(doc, { attachment_url: url })}
                      />
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
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
          placeholder="Paste the OneDrive link…"
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

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.split("/").pop() || "file");
  } catch {
    return url.split("/").pop() || url;
  }
}

/** Upload (or replace/remove) the PDF the intro email attaches for a document. */
function PdfAttachmentUpload({
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
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files.");
      return;
    }
    if (file.size > CASE_FILE_MAX_BYTES) {
      setError("That file is over 25 MB.");
      return;
    }
    setUploading(true);
    setError(null);
    const path = attachmentStoragePath(caseId, docType);
    const { error: upErr } = await supabase.storage
      .from(CASE_FILES_BUCKET)
      .upload(path, file, { contentType: "application/pdf" });
    if (upErr) {
      setUploading(false);
      setError(upErr.message);
      return;
    }
    const { data } = supabase.storage.from(CASE_FILES_BUCKET).getPublicUrl(path);
    setUploading(false);
    onSave(data.publicUrl);
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".pdf,application/pdf"
      className="hidden"
      onChange={(e) => {
        handleFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 max-w-[220px] truncate text-xs text-slate-700 hover:underline"
        >
          📎 {fileNameFromUrl(value)}
        </a>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-slate-400 hover:text-slate-900"
        >
          {uploading ? "Uploading…" : "Replace"}
        </button>
        <button
          onClick={() => onSave(null)}
          className="text-xs text-slate-400 hover:text-red-500"
        >
          Remove
        </button>
        {input}
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
        {uploading ? "Uploading…" : "Drop the PDF here, or click"}
      </div>
      {input}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
