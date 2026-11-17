"use client";

import { useEffect, useRef, useState } from "react";
import {
  supabase,
  CaseDocument,
  CaseRound,
  REQUIRED_REVIEWS,
  activeDocuments,
  currentRound,
  isDocumentReady,
  isUnreviewed,
  needsReview,
  emailAttachments,
  EMAIL_ATTACHMENT_TYPES,
  CASE_FILES_BUCKET,
  CASE_FILE_MAX_BYTES,
  attachmentStoragePath,
} from "@/lib/supabase";
import IntroEmailCard from "@/components/IntroEmailPanel";
import type { IntroEmailTemplate } from "@/lib/intro-email";
import AssigneeSelect from "@/components/AssigneeSelect";
import { markReviewed, unmarkReviewed } from "@/lib/documents";
import {
  TeamMember,
  assignDocument,
  currentUserId,
  isOverdue,
  loadTeam,
} from "@/lib/tasks";

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
  rounds,
  editable,
  folderUrl,
  introEmail,
  onUpdate,
  onAssigned,
}: {
  /** Called after a document was assigned, so the page reloads the (possibly new) row. */
  onAssigned: () => void;
  caseId: string;
  caseName: string;
  documents: CaseDocument[];
  /** The deal's funding rounds: the Term Sheet, 2-pager and Case Review exist once per round. */
  rounds: CaseRound[];
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
  // Which round's documents are on show (the current one until another is picked).
  const [pickedRound, setPickedRound] = useState<string | null>(null);
  const viewRound = rounds.find((r) => r.id === pickedRound) ?? currentRound(rounds);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    loadTeam().then(setTeam);
    currentUserId().then(setMe);
  }, []);

  async function assign(doc: CaseDocument, assignee: string | null, due: string | null) {
    setAssignError(null);
    const { error } = await assignDocument(caseId, doc.type, assignee, due, doc.round_id ?? null);
    if (error) {
      setAssignError(error.message);
      return;
    }
    onAssigned();
  }

  // The shared documents, plus the round documents of the round on show.
  const inView = documents.filter((d) => d.round_id == null || d.round_id === viewRound?.id);
  // The intro email goes out with the current round's PDFs.
  const attach = activeDocuments(documents, rounds);
  async function review(doc: CaseDocument, undo: boolean) {
    if (!me) return;
    setAssignError(null);
    const err = undo ? await unmarkReviewed(doc.id, me) : await markReviewed(doc.id, me);
    if (err) {
      setAssignError(err);
      return;
    }
    onAssigned();
  }

  const isReady = (d: CaseDocument) => isDocumentReady(d, attach);
  // Members see what is ready, plus what is waiting for them to provide.
  const shown = editable
    ? inView
    : inView.filter((d) => isReady(d) || (me !== null && d.assignee_id === me));
  const ready = inView.filter(isReady).length;
  const attachments = emailAttachments(attach);

  if (!editable && shown.length === 0) {
    return <p className="text-sm text-slate-500">No documents available yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-900">
            {ready} of {inView.length} ready
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
              width: `${inView.length ? (ready / inView.length) * 100 : 0}%`,
            }}
          />
        </div>
        {rounds.length > 1 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] text-slate-400">
              Term Sheet, 2-pager and Case Review belong to a funding round.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rounds.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={r.id === viewRound?.id}
                  onClick={() => setPickedRound(r.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    r.id === viewRound?.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {assignError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{assignError}</p>
      )}

      <ul className="space-y-2">
        {shown.map((doc) => {
          // The intro email has nothing to store: its card opens the email directly.
          if (doc.type === "Intro Email") {
            return (
              <li key={doc.id}>
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
          // The Case Review is for the investment committee only: it looks different so nobody sends it out.
          const isInternal = doc.type === "Case Review";
          // The copy kept in the app opens for the whole team; the OneDrive link is the fallback.
          const hasMirror = Boolean(doc.mirror_path);
          const hasLink = hasMirror || Boolean(doc.file_url);
          const href = hasMirror ? `/api/documents/${doc.id}/open` : doc.file_url!;
          const available = isReady(doc);
          const expanded = openType === doc.id && editable;

          const toggle = () => setOpenType(expanded ? null : doc.id);

          // Reviews: red until REQUIRED_REVIEWS different people have reviewed this version.
          const reviewable = needsReview(doc);
          const reviewers = doc.reviewer_ids ?? [];
          const unreviewed = isUnreviewed(doc);
          const reviewedByMe = me !== null && reviewers.includes(me);
          const reviewerNames = reviewers
            .map((id) => team.find((m) => m.id === id)?.name ?? "Someone")
            .join(", ");

          const updated =
            hasMirror && doc.mirror_synced_at
              ? `Updated ${new Date(doc.mirror_synced_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
              : null;
          const subtitle = !hasLink && editable
            ? "No link yet"
            : canAttach && doc.attachment_url
              ? ["PDF ready for the intro email", updated].filter(Boolean).join(" · ")
              : updated;

          const subtitleText = isInternal
            ? [subtitle, "Internal, do not send out"].filter(Boolean).join(" · ")
            : subtitle;

          const body = (
            <>
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  available
                    ? isInternal
                      ? "bg-rose-100 text-rose-600"
                      : "bg-emerald-50 text-emerald-600"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <FileIcon ready={available} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">
                    {doc.type}
                  </span>
                  {isInternal && (
                    <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                      Internal
                    </span>
                  )}
                  {reviewable && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        unreviewed ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {unreviewed ? "Unreviewed" : "Reviewed"} · {Math.min(reviewers.length, REQUIRED_REVIEWS)}/{REQUIRED_REVIEWS}
                    </span>
                  )}
                </span>
                {subtitleText && (
                  <span
                    className={`mt-0.5 block truncate text-xs ${
                      isInternal ? "text-rose-500" : "text-slate-400"
                    }`}
                  >
                    {subtitleText}
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
              key={doc.id}
              className={`rounded-2xl border transition-shadow ${
                isInternal ? "bg-rose-50/60" : unreviewed ? "bg-red-50/40" : "bg-white"
              } ${
                unreviewed
                  ? "border-red-300 hover:shadow-sm"
                  : expanded
                    ? isInternal
                      ? "border-rose-300 shadow-sm"
                      : "border-slate-300 shadow-sm"
                    : isInternal
                      ? "border-rose-200 hover:shadow-sm"
                      : "border-slate-200 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center">
                {hasLink ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className={`${rowClass} ${isInternal ? "hover:bg-rose-50" : "hover:bg-slate-50"}`}
                  >
                    {body}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={toggle}
                    className={`${rowClass} ${isInternal ? "hover:bg-rose-50" : "hover:bg-slate-50"}`}
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

              {reviewable && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                  <span className="min-w-0 flex-1">
                    {reviewers.length > 0 ? `Reviewed by ${reviewerNames}` : "Nobody has reviewed this version yet"}
                  </span>
                  {me && (
                    <button
                      type="button"
                      onClick={() => review(doc, reviewedByMe)}
                      className={`shrink-0 rounded-full px-3 py-1 font-medium ${
                        reviewedByMe
                          ? "text-slate-400 hover:text-slate-900"
                          : "bg-slate-900 text-white hover:bg-slate-700"
                      }`}
                    >
                      {reviewedByMe ? "Undo my review" : "Mark as reviewed"}
                    </button>
                  )}
                </div>
              )}

              {!isReady(doc) && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                  To provide
                  <AssigneeSelect
                    team={team}
                    value={doc.assignee_id}
                    onChange={(id) => assign(doc, id, id ? (doc.due_date ?? null) : null)}
                  />
                  {doc.assignee_id && (
                    <input
                      type="date"
                      aria-label="Due date"
                      value={doc.due_date ?? ""}
                      onChange={(e) => assign(doc, doc.assignee_id ?? null, e.target.value || null)}
                      className={`rounded-md border border-slate-200 bg-white px-2 py-1 text-xs ${
                        isOverdue(doc.due_date ?? null) ? "text-red-600" : "text-slate-700"
                      }`}
                    />
                  )}
                </div>
              )}

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
