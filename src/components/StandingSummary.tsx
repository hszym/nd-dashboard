"use client";

import {
  Case,
  CaseDocument,
  Nda,
  DOCUMENT_TYPES,
  LP_STATUSES,
  isDocumentReady,
} from "@/lib/supabase";
import { formatAmount, formatDate, daysUntil } from "@/lib/utils";

function compute(caseData: Case, documents: CaseDocument[], lps: Nda[] | null) {
  const done = documents.filter(isDocumentReady).length;
  const target = caseData.amount_target;
  const remaining = caseData.amount_remaining;
  const raised =
    target !== null && remaining !== null ? Math.max(target - remaining, 0) : null;
  const pct = target && raised !== null ? Math.min((raised / target) * 100, 100) : null;
  const dleft = daysUntil(caseData.deadline);
  const list = lps ?? [];
  return {
    done,
    total: DOCUMENT_TYPES.length,
    raised,
    target,
    remaining,
    pct,
    dleft,
    lpCount: list.length,
    byLp: LP_STATUSES.map((s) => ({
      label: s,
      n: list.filter((l) => l.lp_status === s).length,
    })),
    byNda: (["Draft", "Sent", "Signed"] as const).map((s) => ({
      label: s,
      n: list.filter((l) => l.status === s).length,
    })),
    loading: lps === null,
  };
}

function deadlineText(dleft: number | null) {
  if (dleft === null) return "—";
  return dleft < 0 ? `${Math.abs(dleft)}d overdue` : `${dleft}d left`;
}

/** Compact dark-glass snapshot shown inside the "Where do we stand?" tile. */
export function StandingTile({
  caseData,
  documents,
  lps,
  showMoney,
}: {
  caseData: Case;
  documents: CaseDocument[];
  lps: Nda[] | null;
  showMoney: boolean;
}) {
  const s = compute(caseData, documents, lps);
  const signed = s.byNda[2].n;
  return (
    <div className="mt-4 space-y-4">
      {showMoney && s.pct !== null && (
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-slate-900">
              {formatAmount(s.raised, caseData.currency)}
            </span>
            <span className="text-xs text-slate-500">
              of {formatAmount(s.target, caseData.currency)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900/10">
            <div
              className="h-full rounded-full bg-slate-900"
              style={{ width: `${s.pct}%` }}
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 text-center">
        <Mini label="Documents" value={`${s.done}/${s.total}`} />
        <Mini label="LPs" value={s.loading ? "…" : String(s.lpCount)} />
        <Mini label="NDAs signed" value={s.loading ? "…" : String(signed)} />
      </div>
      {showMoney && caseData.deadline && (
        <p className="text-center text-xs text-slate-500">
          Deadline {formatDate(caseData.deadline)} · {deadlineText(s.dleft)}
        </p>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/60 px-2 py-3">
      <div className="text-lg font-semibold text-slate-900">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}

/** Full breakdown, shown in the light sheet after tapping the tile. */
export function StandingDetail({
  caseData,
  documents,
  lps,
  showMoney,
}: {
  caseData: Case;
  documents: CaseDocument[];
  lps: Nda[] | null;
  showMoney: boolean;
}) {
  const s = compute(caseData, documents, lps);
  return (
    <div className="space-y-6 text-sm">
      <Row label="Stage" value={caseData.stage} />

      {showMoney && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fundraising
          </h3>
          {s.pct !== null && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900"
                  style={{ width: `${s.pct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">{Math.round(s.pct)}% raised</p>
            </div>
          )}
          <Row label="Target" value={formatAmount(s.target, caseData.currency)} />
          <Row label="Raised" value={formatAmount(s.raised, caseData.currency)} />
          <Row label="Remaining" value={formatAmount(s.remaining, caseData.currency)} />
          <Row
            label="Deadline"
            value={
              caseData.deadline
                ? `${formatDate(caseData.deadline)} · ${deadlineText(s.dleft)}`
                : "—"
            }
          />
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Documents · {s.done}/{s.total} ready
        </h3>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900"
            style={{ width: `${(s.done / s.total) * 100}%` }}
          />
        </div>
        <ul className="space-y-1">
          {documents.map((d) => (
            <li key={d.type} className="flex justify-between text-slate-700">
              <span>{d.type}</span>
              <span className="text-slate-500">{d.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Investors · {s.loading ? "…" : s.lpCount}
        </h3>
        {s.byLp.map((x) => (
          <Row key={x.label} label={x.label} value={String(x.n)} />
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          NDAs
        </h3>
        {s.byNda.map((x) => (
          <Row key={x.label} label={x.label} value={String(x.n)} />
        ))}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
