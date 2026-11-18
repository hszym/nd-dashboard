"use client";

import {
  Case,
  CaseRound,
  CurrencyTotal,
  Nda,
  LP_STATUSES,
  currentRound,
  roundTotals,
} from "@/lib/supabase";
import type { TeamMember } from "@/lib/tasks";
import { formatAmount, formatDate, daysUntil } from "@/lib/utils";

function compute(rounds: CaseRound[], lps: Nda[] | null) {
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
  const count = (s: (typeof LP_STATUSES)[number]) => list.filter((l) => l.lp_status === s).length;
  return {
    totals,
    deadline: upcoming,
    dleft: daysUntil(upcoming),
    lpCount: list.length,
    ndaSigned: count("NDA signed"),
    invested: count("Invested"),
    list,
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
  rounds,
  lps,
  showMoney,
}: {
  caseData: Case;
  rounds: CaseRound[];
  lps: Nda[] | null;
  showMoney: boolean;
}) {
  const s = compute(rounds, lps);
  const withBar = s.totals.filter((t) => t.pct !== null);
  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs text-slate-500">
        Due Diligence · <span className="font-medium text-slate-900">{caseData.dd_stage}</span>
      </p>
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
        <Mini label="Investors" value={s.loading ? "…" : String(s.lpCount)} />
        <Mini label="NDA signed" value={s.loading ? "…" : String(s.ndaSigned)} />
        <Mini label="Invested" value={s.loading ? "…" : String(s.invested)} />
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
  rounds,
  lps,
  sales,
  showMoney,
}: {
  caseData: Case;
  rounds: CaseRound[];
  lps: Nda[] | null;
  /** The people who can sell: one column each in the investors table. */
  sales: TeamMember[];
  showMoney: boolean;
}) {
  const s = compute(rounds, lps);
  const cur = currentRound(rounds);
  const multi = rounds.length > 1;

  // Investors by status (rows) and by salesperson (columns); anyone without a listed salesperson goes to "Unassigned".
  const salesIds = new Set(sales.map((m) => m.id));
  const unassigned = s.list.filter((l) => !l.sales_id || !salesIds.has(l.sales_id));
  const columns = [
    ...sales.map((m) => ({ key: m.id, label: m.name, test: (l: Nda) => l.sales_id === m.id })),
    ...(unassigned.length > 0
      ? [{ key: "unassigned", label: "Unassigned", test: (l: Nda) => !l.sales_id || !salesIds.has(l.sales_id) }]
      : []),
  ];

  return (
    <div className="space-y-6 text-sm">
      <Row label="Due Diligence Stage" value={caseData.dd_stage} />

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

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Investors · {s.loading ? "…" : s.lpCount}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Status</th>
                {columns.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-2 py-1.5 text-right font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="pl-2 py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {LP_STATUSES.map((status) => {
                const rows = s.list.filter((l) => l.lp_status === status);
                return (
                  <tr key={status}>
                    <td className="py-1.5 pr-3 text-slate-500">{status}</td>
                    {columns.map((c) => (
                      <td key={c.key} className="px-2 py-1.5 text-right text-slate-700">
                        {rows.filter(c.test).length || "–"}
                      </td>
                    ))}
                    <td className="pl-2 py-1.5 text-right font-medium text-slate-900">{rows.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sales.length === 0 && (
          <p className="text-xs text-slate-400">
            No salesperson yet: an admin ticks “Can sell” for each of them in Users.
          </p>
        )}
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