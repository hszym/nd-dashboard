"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { supabase, Case, Nda, ndaCounterpartyName } from "@/lib/supabase";
import NdaStatusBadge from "@/components/NdaStatusBadge";
import {
  buildNdaEml,
  ndaEmailContent,
  ndaMailtoLink,
  ndaPdfFileName,
} from "@/lib/nda-email";

type PdfState =
  | { id: string; status: "loading" }
  | { id: string; status: "ready"; file: File }
  | { id: string; status: "error"; message: string };

function ChoiceCard({
  href,
  onClick,
  icon,
  title,
  description,
}: {
  href?: string;
  onClick?: () => void;
  icon: string;
  title: string;
  description: string;
}) {
  const className =
    "flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md";
  const inner = (
    <>
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-lg text-white"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
      </span>
      <span aria-hidden className="text-slate-300">
        ›
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

/**
 * Create an LP or pick an existing one, then prepare the NDA email with the PDF already attached: the
 * device's share sheet where available (phones, tablets), otherwise an unsent
 * .eml for Outlook. Admins can then mark the NDA as Sent in one tap.
 */
export default function SendNdaPanel({
  caseData,
  lps,
  isAdmin,
  onLpUpdated,
}: {
  caseData: Case;
  lps: Nda[] | null;
  isAdmin: boolean;
  onLpUpdated?: (id: string, patch: Partial<Nda>) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pdf, setPdf] = useState<PdfState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);
  const latestId = useRef<string | null>(null);
  const [mode, setMode] = useState<"choose" | "existing">("choose");
  const [query, setQuery] = useState("");

  // The PDF is fetched as soon as an LP is picked, so "Prepare email" can open
  // the share sheet straight away (browsers only allow sharing files shortly
  // after a tap, so a slow download at that moment would make it fail).
  async function select(lp: Nda) {
    setSelectedId(lp.id);
    setNotice(null);
    setCopied(false);
    latestId.current = lp.id;
    setPdf({ id: lp.id, status: "loading" });
    try {
      const res = await fetch(`/api/ndas/generate?id=${lp.id}&format=pdf`);
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.includes("pdf")) {
        let message = "Could not get the NDA PDF.";
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.error) message = data.error;
        }
        throw new Error(message);
      }
      const buf = await res.arrayBuffer();
      const file = new File([buf], ndaPdfFileName(lp), { type: "application/pdf" });
      if (latestId.current === lp.id) setPdf({ id: lp.id, status: "ready", file });
    } catch (err) {
      if (latestId.current === lp.id) {
        setPdf({
          id: lp.id,
          status: "error",
          message: err instanceof Error ? err.message : "Could not get the NDA PDF.",
        });
      }
    }
  }

  async function prepare(lp: Nda, file: File) {
    setNotice(null);
    const { subject, body } = ndaEmailContent(lp, caseData.name);

    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
      // The share sheet can't set a recipient, so put the LP's address on the
      // clipboard first (started in the same tap) ready to paste into "To".
      const copiedAddress = lp.email
        ? navigator.clipboard
            ?.writeText(lp.email)
            .then(() => true)
            .catch(() => false) ?? Promise.resolve(false)
        : Promise.resolve(false);
      try {
        await navigator.share({ files: [file], title: subject, text: body });
        setNotice(
          (await copiedAddress)
            ? `Choose Mail or Outlook, then paste ${lp.email} into the To field. It's already copied.`
            : "Opened your share sheet. Choose Mail or Outlook, then send it."
        );
        return;
      } catch (err) {
        // The person closed the share sheet: nothing more to do.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Anything else: fall through to the .eml download.
      }
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const eml = buildNdaEml(lp, caseData.name, bytes, file.name);
    const url = URL.createObjectURL(new Blob([eml], { type: "message/rfc822" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(/\.pdf$/i, "") + ".eml";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setNotice(
      "Downloaded an email with the PDF attached. Open it in Outlook, check it, and send."
    );
  }

  async function copyAddress(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the address is visible on screen to copy by hand.
    }
  }

  async function markSent(lp: Nda) {
    setMarking(true);
    const { error } = await supabase
      .from("ndas")
      .update({ status: "Sent" })
      .eq("id", lp.id);
    setMarking(false);
    if (error) {
      setNotice(`Could not update the status: ${error.message}`);
      return;
    }
    onLpUpdated?.(lp.id, { status: "Sent" });
  }

  if (!lps) return <p className="text-sm text-slate-500">Loading LPs…</p>;

  const createHref = `/cases/${caseData.slug}/track/new`;

  // First step: create a new LP, or send to one that already exists. With no
  // LPs yet there is nothing to pick, so only "create" is offered; people who
  // can't add LPs go straight to the list.
  if (mode === "choose" && (lps.length === 0 || isAdmin)) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Who is this NDA for? It&apos;s generated from the LP&apos;s details.
        </p>
        {isAdmin && (
          <ChoiceCard
            href={createHref}
            icon="＋"
            title="Create a new LP"
            description="Send them a link to fill in their details, or enter them yourself."
          />
        )}
        {lps.length > 0 ? (
          <ChoiceCard
            onClick={() => setMode("existing")}
            icon="✉"
            title="Send to an existing LP"
            description={`Pick from ${lps.length} LP${lps.length === 1 ? "" : "s"} already on this deal.`}
          />
        ) : (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {isAdmin
              ? "No LPs on this deal yet, so start by creating one."
              : "No LPs on this deal yet."}
          </p>
        )}
      </div>
    );
  }

  const selected = lps.find((l) => l.id === selectedId) ?? null;
  const pdfState = selected && pdf?.id === selected.id ? pdf : null;
  const q = query.trim().toLowerCase();
  const visible = q
    ? lps.filter((l) =>
        `${ndaCounterpartyName(l)} ${l.email ?? ""}`.toLowerCase().includes(q)
      )
    : lps;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <button
          type="button"
          onClick={() => {
            setMode("choose");
            setSelectedId(null);
            setQuery("");
          }}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back
        </button>
      )}
      <p className="text-sm text-slate-500">Pick an LP to send the NDA to.</p>
      {lps.length > 5 && (
        <input
          className="input"
          type="search"
          placeholder="Search by name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {visible.map((lp) => (
          <li key={lp.id}>
            <button
              type="button"
              onClick={() => select(lp)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                lp.id === selectedId ? "bg-slate-50" : ""
              }`}
            >
              <span
                aria-hidden
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  lp.id === selectedId
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {ndaCounterpartyName(lp).charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {ndaCounterpartyName(lp)}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {lp.email ?? "No email on file"}
                </span>
              </span>
              <NdaStatusBadge status={lp.status} />
            </button>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">
            No LP matches &ldquo;{query}&rdquo;.
          </li>
        )}
      </ul>

      {selected && (
        <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium text-slate-900">
              {ndaCounterpartyName(selected)}
            </p>
            {selected.email && (
              <button
                type="button"
                onClick={() => copyAddress(selected.email!)}
                className="shrink-0 text-xs text-slate-500 hover:text-slate-900"
              >
                {copied ? "Copied" : "Copy address"}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pdfState?.status !== "ready"}
              onClick={() =>
                pdfState?.status === "ready" && prepare(selected, pdfState.file)
              }
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {pdfState?.status === "loading" ? "Preparing the PDF…" : "Prepare email"}
            </button>
            <a
              href={`/api/ndas/generate?id=${selected.id}&format=pdf`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Open NDA PDF
            </a>
          </div>

          {pdfState?.status === "error" && (
            <div className="space-y-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{pdfState.message}</p>
              <div className="flex gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => select(selected)}
                  className="font-medium underline"
                >
                  Try again
                </button>
                <a href={ndaMailtoLink(selected, caseData.name)} className="underline">
                  Draft email without the PDF
                </a>
              </div>
            </div>
          )}

          {notice && <p className="text-sm text-emerald-700">{notice}</p>}

          {isAdmin && selected.status === "Draft" && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <p className="text-xs text-slate-500">
                Once it&apos;s sent, mark it so the tracker stays up to date.
              </p>
              <button
                type="button"
                onClick={() => markSent(selected)}
                disabled={marking}
                className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {marking ? "Saving…" : "Mark as Sent"}
              </button>
            </div>
          )}

          {!selected.email && (
            <p className="text-xs text-slate-500">
              No email address on file, so the To field will be empty: add it when
              you send.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
