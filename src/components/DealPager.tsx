"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  supabase,
  Case,
  CaseDocument,
  DOCUMENT_TYPES,
  Nda,
} from "@/lib/supabase";
import StageBadge from "@/components/StageBadge";
import CaseLogo from "@/components/CaseLogo";
import Sheet from "@/components/Sheet";
import DocumentList from "@/components/DocumentList";
import CaseEditForm from "@/components/CaseEditForm";
import { StandingTile, StandingDetail } from "@/components/StandingSummary";
import SendNdaPanel from "@/components/SendNdaPanel";
import OpenQuestions from "@/components/OpenQuestions";
import AddInfoPanel from "@/components/AddInfoPanel";
import InboxReview from "@/components/InboxReview";
import CaseTrack from "@/components/CaseTrack";
import { formatAmount, formatDate } from "@/lib/utils";

type SheetKey = "standing" | "documents" | "nda" | "add" | null;

const PAGES = ["Overview", "Details"] as const;

/**
 * Deal page: two swipeable pages (Overview, Investors) in the same dark glass
 * style as the home carousel. Light sheets host the forms and lists.
 */
export default function DealPager({
  caseData,
  documents,
  role,
  onUpdateDocument,
  onReload,
  onDeleted,
}: {
  caseData: Case;
  documents: CaseDocument[];
  role: "admin" | "team";
  onUpdateDocument: (
    doc: CaseDocument,
    patch: Partial<Pick<CaseDocument, "status" | "file_url">>
  ) => void;
  onReload: () => void;
  onDeleted: () => void;
}) {
  const isAdmin = role === "admin";
  const trackRef = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);
  const pageRef = useRef(0);
  const [page, setPage] = useState(0);
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [editing, setEditing] = useState(false);
  const [inboxKey, setInboxKey] = useState(0);
  const [lps, setLps] = useState<Nda[] | null>(null);

  const loadLps = useCallback(async () => {
    const { data } = await supabase
      .from("ndas")
      .select("*")
      .eq("case_id", caseData.id)
      .order("created_at", { ascending: false });
    setLps((data as Nda[]) ?? []);
  }, [caseData.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadLps();
  }, [loadLps]);

  // Deep link: the Add LP flow redirects to ?tab=track, which is page 2.
  useEffect(() => {
    const track = trackRef.current;
    if (track && new URLSearchParams(window.location.search).get("tab") === "track") {
      track.scrollLeft = track.clientWidth;
    }
  }, []);

  const onScroll = useCallback(() => {
    if (raf.current !== null) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const track = trackRef.current;
      if (!track || !track.clientWidth) return;
      const next = Math.round(track.scrollLeft / track.clientWidth);
      if (next === pageRef.current) return;
      pageRef.current = next;
      setPage(next);
      // Coming back to the overview: refresh the LP/NDA counts.
      if (next === 0) loadLps();
    });
  }, [loadLps]);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    []
  );

  function goTo(i: number) {
    const track = trackRef.current;
    track?.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }

  function open(key: Exclude<SheetKey, null>) {
    if (key === "standing" || key === "nda") loadLps();
    setEditing(false);
    setSheet(key);
  }

  const done = documents.filter((d) => d.status === "Done").length;
  const subline = [
    caseData.sector,
    caseData.sponsor && `Sponsor: ${caseData.sponsor}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="text-slate-900">
      {/* Page switcher */}
      <div className="mb-5 flex justify-center">
        <div className="glass flex rounded-full p-1 text-sm">
          {PAGES.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => goTo(i)}
              className={`rounded-full px-5 py-1.5 font-medium transition-colors ${
                page === i ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory items-start overflow-x-auto"
      >
        {/* Page 1: Overview */}
        <section className="w-full shrink-0 snap-center px-5">
          <div className="mx-auto max-w-md space-y-4">
            <div className="flex flex-col items-center text-center">
              <CaseLogo
                project={caseData}
                className="h-28 w-28 rounded-[1.75rem] shadow-xl"
                monogramClassName="text-4xl"
              />
              <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                {caseData.name}
              </h1>
              {subline && <p className="mt-1 text-sm text-slate-500">{subline}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <StageBadge stage={caseData.stage} />
                {caseData.website_url && (
                  <a
                    href={websiteHref(caseData.website_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-white/60 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                  >
                    {websiteLabel(caseData.website_url)}
                    <span aria-hidden>↗</span>
                  </a>
                )}
              </div>
            </div>

            <Tile onClick={() => open("standing")} title="Where do we stand?">
              <StandingTile
                caseData={caseData}
                documents={documents}
                lps={lps}
                showMoney={isAdmin}
              />
            </Tile>

            <Tile
              onClick={() => open("documents")}
              title="Documents"
              subtitle={`${done}/${DOCUMENT_TYPES.length} ready`}
            />
            <Tile
              onClick={() => open("nda")}
              title="Send NDA"
              subtitle="Pick an LP, then draft the email"
            />
            <DropTile onClick={() => open("add")} label="Drop files or a note for review" />

            <p className="pt-2 text-center text-xs text-slate-400">
              Swipe left for details →
            </p>
          </div>
        </section>

        {/* Page 2: Details */}
        <section className="w-full shrink-0 snap-center px-5">
          <div className="mx-auto max-w-3xl space-y-4">
            <h2 className="text-center text-2xl font-semibold tracking-tight">
              Information
            </h2>
            <div className="rounded-[1.75rem] bg-white p-5 text-slate-900 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.3)]">
              {editing && isAdmin ? (
                <CaseEditForm
                  caseData={caseData}
                  onSaved={() => {
                    setEditing(false);
                    onReload();
                  }}
                  onCancel={() => setEditing(false)}
                  onDeleted={onDeleted}
                />
              ) : (
                <InfoView
                  caseData={caseData}
                  isAdmin={isAdmin}
                  onEdit={() => setEditing(true)}
                />
              )}
            </div>

            <h2 className="pt-2 text-center text-2xl font-semibold tracking-tight">
              Investors
            </h2>
            <div className="overflow-x-auto rounded-[1.75rem] bg-white p-5 text-slate-900 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.3)]">
              <CaseTrack caseData={caseData} role={role} />
            </div>

            <h2 className="pt-2 text-center text-2xl font-semibold tracking-tight">
              Open questions
            </h2>
            <div className="rounded-[1.75rem] bg-white p-5 text-slate-900 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.3)]">
              <OpenQuestions caseId={caseData.id} isAdmin={isAdmin} />
            </div>

            {isAdmin && (
              <>
                <h2 className="pt-2 text-center text-2xl font-semibold tracking-tight">
                  To review
                </h2>
                <div className="rounded-[1.75rem] bg-white p-5 text-slate-900 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.3)]">
                  <InboxReview caseData={caseData} refreshKey={inboxKey} />
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <Sheet
        open={sheet === "standing"}
        onClose={() => setSheet(null)}
        title="Where do we stand?"
      >
        <StandingDetail
          caseData={caseData}
          documents={documents}
          lps={lps}
          showMoney={isAdmin}
        />
      </Sheet>

      <Sheet open={sheet === "documents"} onClose={() => setSheet(null)} title="Documents">
        <DocumentList
          caseId={caseData.id}
          documents={documents}
          editable={isAdmin}
          onUpdate={onUpdateDocument}
        />
      </Sheet>

      <Sheet open={sheet === "nda"} onClose={() => setSheet(null)} title="Send NDA">
        <SendNdaPanel caseData={caseData} lps={lps} isAdmin={isAdmin} />
      </Sheet>

      <Sheet
        open={sheet === "add"}
        onClose={() => setSheet(null)}
        title="Drop files or a note for review"
      >
        <AddInfoPanel
          caseData={caseData}
          onSubmitted={() => setInboxKey((k) => k + 1)}
          onClose={() => setSheet(null)}
        />
      </Sheet>
    </div>
  );
}

function websiteHref(url: string): string {
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function websiteLabel(url: string): string {
  try {
    return new URL(websiteHref(url)).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** The "drop files or a note" entry point: a round plus badge and one line of text. */
function DropTile({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass group flex w-full items-center gap-4 rounded-[1.75rem] p-4 text-left shadow-[0_20px_50px_-25px_rgba(15,23,42,0.35)] transition-colors hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      <span
        aria-hidden
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_10px_20px_-8px_rgba(15,23,42,0.6)] transition-transform group-hover:scale-105"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <span className="text-base font-semibold tracking-tight">{label}</span>
    </button>
  );
}

function Tile({
  title,
  subtitle,
  onClick,
  children,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass block w-full rounded-[1.75rem] p-5 text-left shadow-[0_20px_50px_-25px_rgba(15,23,42,0.35)] transition-colors hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold tracking-tight">{title}</div>
          {subtitle && (
            <div className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</div>
          )}
        </div>
        <span aria-hidden className="text-xl text-slate-400">
          ›
        </span>
      </div>
      {children}
    </button>
  );
}

function InfoView({
  caseData,
  isAdmin,
  onEdit,
}: {
  caseData: Case;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="space-y-5 text-sm">
      <dl className="space-y-3">
        <Row label="Sponsor" value={caseData.sponsor ?? "—"} />
        <Row label="Sector" value={caseData.sector ?? "—"} />
        {isAdmin && (
          <>
            <Row
              label="Target"
              value={formatAmount(caseData.amount_target, caseData.currency)}
            />
            <Row
              label="Remaining"
              value={formatAmount(caseData.amount_remaining, caseData.currency)}
            />
            <Row label="Deadline" value={formatDate(caseData.deadline)} />
          </>
        )}
      </dl>

      {isAdmin && (caseData.claude_project_url || caseData.drive_folder_url) && (
        <div className="flex gap-4">
          {caseData.claude_project_url && (
            <a
              href={caseData.claude_project_url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              Claude project ↗
            </a>
          )}
          {caseData.drive_folder_url && (
            <a
              href={caseData.drive_folder_url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              Drive folder ↗
            </a>
          )}
        </div>
      )}

      {isAdmin && caseData.brand_colors?.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Brand</span>
          {caseData.brand_colors.map((c, i) => (
            <span
              key={i}
              title={`${c.label} #${c.hex}`}
              className="h-5 w-5 rounded-full border border-slate-200"
              style={{ backgroundColor: `#${c.hex.replace("#", "")}` }}
            />
          ))}
        </div>
      )}

      {isAdmin && caseData.notes && (
        <p className="whitespace-pre-wrap text-slate-600">{caseData.notes}</p>
      )}

      {isAdmin && (
        <button
          onClick={onEdit}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Edit deal
        </button>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
