"use client";

import { useEffect, useState } from "react";
import {
  buildIntroEml,
  introEmailContent,
  attachmentFileName,
  type EmailAttachment,
  type IntroEmailTemplate,
} from "@/lib/intro-email";

export interface IntroAttachmentSource {
  /** Short name used in the email text and file name, e.g. "2-pager". */
  label: string;
  url: string;
}

type Loaded = { label: string; file: File };

/**
 * The "Open intro email" card, with two options. On my phone: the share sheet,
 * with the 2-pager and the deck attached (plain text). On my computer: an unsent
 * .eml for Outlook (HTML when the deal has it). The PDFs are downloaded as
 * soon as the card shows, because browsers only allow sharing files shortly
 * after a tap, so a slow download at that moment would make it fail.
 */
export default function IntroEmailCard({
  caseName,
  sources,
  template,
}: {
  caseName: string;
  sources: IntroAttachmentSource[];
  /** This deal's own wording, if it has one (otherwise the default text is used). */
  template?: IntroEmailTemplate | null;
}) {
  const [files, setFiles] = useState<Loaded[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const key = sources.map((s) => `${s.label}|${s.url}`).join("\n");
  const enabled = sources.length > 0;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset while the PDFs are (re)loading
    setFiles(null);
    setError(null);
    Promise.all(
      sources.map(async (s) => {
        const res = await fetch(s.url);
        if (!res.ok) throw new Error(`Could not download the ${s.label}.`);
        const buf = await res.arrayBuffer();
        return {
          label: s.label,
          file: new File([buf], attachmentFileName(caseName, s.label), {
            type: "application/pdf",
          }),
        };
      })
    )
      .then((loaded) => active && setFiles(loaded))
      .catch(
        (err) =>
          active &&
          setError(err instanceof Error ? err.message : "Could not download the PDFs.")
      );
    return () => {
      active = false;
    };
    // `key` stands for `sources`, which is a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, caseName, attempt, enabled]);

  /** Download an unsent .eml (HTML + plain text) with the PDFs attached: for Outlook on a computer. */
  async function downloadEml(
    loaded: Loaded[],
    content: { subject: string; body: string; html: string | null }
  ) {
    const attachments: EmailAttachment[] = await Promise.all(
      loaded.map(async (l) => ({
        name: l.file.name,
        bytes: new Uint8Array(await l.file.arrayBuffer()),
      }))
    );
    const eml = buildIntroEml("", content.subject, content.body, attachments, content.html);
    const url = URL.createObjectURL(new Blob([eml], { type: "message/rfc822" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${caseName} - Intro email.eml`.replace(/[\\/:*?"<>|]+/g, "-");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function open(loaded: Loaded[], mode: "phone" | "computer") {
    setNotice(null);
    const content = introEmailContent(
      caseName,
      loaded.map((l) => l.label.toLowerCase()),
      template
    );
    const shareFiles = loaded.map((l) => l.file);

    if (mode === "phone") {
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: shareFiles })) {
        // Mail and Outlook on a phone often ignore the subject given to the share
        // sheet, so put it on the clipboard (started in the same tap) to paste.
        const copied = navigator.clipboard
          ? navigator.clipboard
              .writeText(content.subject)
              .then(() => true)
              .catch(() => false)
          : Promise.resolve(false);
        try {
          await navigator.share({
            files: shareFiles,
            title: content.subject,
            text: content.body,
          });
          setNotice(
            (await copied)
              ? "Choose Mail or Outlook, add the recipient and paste the subject. It's already copied."
              : "Choose Mail or Outlook, add the recipient and the subject, then send it."
          );
          return;
        } catch (err) {
          // The person closed the share sheet: nothing more to do.
          if (err instanceof DOMException && err.name === "AbortError") return;
          // Anything else: fall through to the .eml download.
        }
      }
      await downloadEml(loaded, content);
      setNotice(
        "This device can't open the share sheet, so the email was downloaded instead. Open it in your mail app."
      );
      return;
    }

    await downloadEml(loaded, content);
    setNotice("Open the downloaded email in Outlook, add the recipient and send it.");
  }

  const ready = enabled && files !== null;
  const hint = !enabled
    ? "Upload the 2-pager or Deck PDF to enable it"
    : `With the ${sources.map((s) => s.label.toLowerCase()).join(" and the ")} attached`;

  return (
    <div
      className={`rounded-2xl border p-3 transition-shadow ${
        enabled
          ? "border-indigo-200 bg-indigo-50/60 hover:shadow-sm"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            enabled ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-sm font-semibold ${
              enabled ? "text-indigo-900" : "text-slate-900"
            }`}
          >
            {enabled ? "Open intro email" : "Intro Email"}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {error ? error : enabled && !files ? "Preparing the PDFs…" : hint}
          </span>
        </span>
      </div>

      {enabled && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              ["phone", "On my phone"],
              ["computer", "On my computer"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              disabled={!ready}
              onClick={() => files && open(files, mode)}
              className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {(error || notice) && (
        <div className="mt-2 space-y-1 text-xs">
          {error && (
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="font-medium text-red-700 underline"
            >
              Try again
            </button>
          )}
          {notice && <p className="text-emerald-700">{notice}</p>}
        </div>
      )}
    </div>
  );
}
