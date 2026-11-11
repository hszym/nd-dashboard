"use client";

import { useEffect, useState } from "react";
import {
  buildIntroEml,
  introEmailContent,
  attachmentFileName,
  type EmailAttachment,
} from "@/lib/intro-email";

export interface IntroAttachmentSource {
  /** Short name used in the email text and file name, e.g. "2-pager". */
  label: string;
  url: string;
}

type Loaded = { label: string; file: File };

/**
 * Prepares the intro email with the 2-pager and the deck already attached: the
 * device's share sheet where available (phones, tablets), otherwise an unsent
 * .eml for Outlook. Same idea as the NDA email. The PDFs are downloaded as soon
 * as the panel opens, because browsers only allow sharing files shortly after a
 * tap, so a slow download at that moment would make it fail.
 */
export default function IntroEmailPanel({
  caseName,
  sources,
}: {
  caseName: string;
  sources: IntroAttachmentSource[];
}) {
  const [to, setTo] = useState("");
  const [files, setFiles] = useState<Loaded[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const key = sources.map((s) => `${s.label}|${s.url}`).join("\n");

  useEffect(() => {
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
  }, [key, caseName, attempt]);

  async function prepare(loaded: Loaded[]) {
    setNotice(null);
    const recipient = to.trim();
    const { subject, body } = introEmailContent(
      caseName,
      loaded.map((l) => l.label.toLowerCase())
    );
    const shareFiles = loaded.map((l) => l.file);

    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: shareFiles })) {
      // The share sheet can't set a recipient, so put the address on the
      // clipboard first (started in the same tap) ready to paste into "To".
      const copied = recipient
        ? (navigator.clipboard
            ?.writeText(recipient)
            .then(() => true)
            .catch(() => false) ?? Promise.resolve(false))
        : Promise.resolve(false);
      try {
        await navigator.share({ files: shareFiles, title: subject, text: body });
        setNotice(
          (await copied)
            ? `Choose Mail or Outlook, then paste ${recipient} into the To field. It's already copied.`
            : "Opened your share sheet. Choose Mail or Outlook, then send it."
        );
        return;
      } catch (err) {
        // The person closed the share sheet: nothing more to do.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Anything else: fall through to the .eml download.
      }
    }

    const attachments: EmailAttachment[] = await Promise.all(
      loaded.map(async (l) => ({
        name: l.file.name,
        bytes: new Uint8Array(await l.file.arrayBuffer()),
      }))
    );
    const eml = buildIntroEml(recipient, subject, body, attachments);
    const url = URL.createObjectURL(new Blob([eml], { type: "message/rfc822" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${caseName} - Intro email.eml`.replace(/[\\/:*?"<>|]+/g, "-");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setNotice(
      "Downloaded an email with the PDFs attached. Open it in Outlook, check it, and send."
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          To (optional)
        </span>
        <input
          className="input"
          type="email"
          inputMode="email"
          placeholder="name@example.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>

      <ul className="flex flex-wrap gap-2">
        {sources.map((s) => (
          <li
            key={s.label}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
          >
            <span aria-hidden>📎</span>
            {s.label}.pdf
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={!files}
        onClick={() => files && prepare(files)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {files ? "Prepare email" : error ? "Prepare email" : "Preparing the PDFs…"}
      </button>

      {error && (
        <div className="space-y-1 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="text-xs font-medium underline"
          >
            Try again
          </button>
        </div>
      )}

      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
    </div>
  );
}
