"use client";

import {
  Case,
  CaseDocument,
  CaseRound,
  CurrencyTotal,
  Nda,
  LP_STATUSES,
  activeDocuments,
  currentRound,
  isDocumentReady,
  roundTotals,
} from "@/lib/supabase";
import { formatAmount, formatDate, daysUntil } from "@/lib/utils";

function compute(documents: CaseDocument[], rounds: CaseRound[], lps: Nda[] | null) {
  // The documents that count right now: the shared ones and the current round's.
  const active = activeDocuments(documents, rounds);
  const done = active.filter((d) => isDocumentReady(d, active)).length;
  const totals = roundTotals(rounds).map((t) => ({
    ...t,
    pct: t.target > 0 ? Math.min((t.raised / t.target) * 100, 100) : null,
  }));
  // Next deadline among the rounds still raising.
  const upcoming = rounds
    .filter((r) => r.status === "raising" && r.deadline)
    .map((r) => r.deadline as string)
    .sort()[0] ?? null;
  const list = lps ?? [];
  return {
    done,
    total: active.length,
    totals,
    deadline: upcoming,
    dleft: daysUntil(upcoming),
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
  documents,
  rounds,
  lps,
  showMoney,
}: {
  caseData: Case;
  documents: CaseDocument[];
  rounds: CaseRound[];
  lps: Nda[] | null;
  showMoney: boolean;
}) {
  const s = compute(documents, rounds, lps);
  const signed = s.byNda[2].n;
  const withBar = s.totals.filter((t) => t.pct !== null);
  return (
    <div className="mt-4 space-y-4">
      {showMoney && withBar.length > 0 && (
        <div className="space-y-3">
          {rounds.length > 1 && (
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              All {rounds.length} rounds
            </p>
          )}
          {withBar.map((t) => (
            <div key={t.currency}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-900">{formatAmount(t.raised, t.currency)}</span>
                <span className="text-xs text-slate-500">of {formatAmount(t.target, t.currency)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900/10">
                <div className="h-full rounded-full bg-slate-900" style={{ width: `${t.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 text-center">
        <Mini label="Documents" value={`${s.done}/${s.total}`} />
        <Mini label="LPs" value={s.loading ? "…" : String(s.lpCount)} />
        <Mini label="NDAs signed" value={s.loading ? "…" : String(signed)} />
      </div>
      {showMoney && s.deadline && (
        <p className="text-center text-xs text-slate-500">
          Deadline {formatDate(s.deadline)} · {deadlineText(s.dleft)}
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
  rounds,
  lps,
  showMoney,
}: {
  caseData: Case;
  documents: CaseDocument[];
  rounds: CaseRound[];
  lps: Nda[] | null;
  showMoney: boolean;
}) {
  const s = compute(documents, rounds, lps);
  const cur = currentRound(rounds);
  const multi = rounds.length > 1;
  return (
    <div className="space-y-6 text-sm">
      <Row label="Stage" value={caseData.stage} />

      {showMoney && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fundraising{multi ? " · all rounds" : ""}
          </h3>
          {s.totals.length === 0 && <p className="text-slate-500">No target set yet.</p>}
          {s.totals.map((t) => (
            <Totals key={t.currency} t={t} pct={t.pct} />
          ))}
          {s.deadline && (
            <Row
              label={multi ? "Next deadline" : "Deadline"}
              value={`${formatDate(s.deadline)} · ${deadlineText(s.dleft)}`}
            />
          )}

          {multi && (
            <ul className="space-y-3 border-t border-slate-100 pt-3">
              {rounds.map((r) => (
                <RoundRow key={r.id} round={r} current={r.id === cur?.id} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Documents · {s.done}/{s.total} ready{multi && cur ? ` (${cur.name})` : ""}
        </h3>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900"
            style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%` }}
          />
        </div>
        <ul className="space-y-1">
          {activeDocuments(documents, rounds).map((d) => (
            <li key={d.id} className="flex justify-between text-slate-700">
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

function Totals({ t, pct }: { t: CurrencyTotal; pct: number | null }) {
  return (
    <div className="space-y-2">
      {pct !== null && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-slate-900" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{Math.round(pct)}% raised</p>
        </div>
      )}
      <Row label="Target" value={formatAmount(t.target, t.currency)} />
      <Row label="Raised" value={formatAmount(t.raised, t.currency)} />
      <Row label="Remaining" value={formatAmount(t.remaining, t.currency)} />
    </div>
  );
}

function RoundRow({ round, current }: { round: CaseRound; current: boolean }) {
  const target = round.amount_target;
  const remaining = round.amount_remaining ?? target;
  const raised = target !== null && remaining !== null ? Math.max(target - remaining, 0) : null;
  const pct = target && raised !== null ? Math.min((raised / target) * 100, 100) : null;
  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-900">
          {round.name}
          {current && <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white">Current</span>}
        </span>
        <span className={`text-xs ${round.status === "closed" ? "text-emerald-600" : "text-slate-500"}`}>
          {round.status === "closed" ? "Closed" : "Raising"}
        </span>
      </div>
      {pct !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-slate-700" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="text-xs text-slate-500">
        {target !== null ? `${formatAmount(raised, round.currency)} of ${formatAmount(target, round.currency)}` : "No target yet"}
        {round.deadline ? ` · ${formatDate(round.deadline)}` : ""}
      </p>
    </li>
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