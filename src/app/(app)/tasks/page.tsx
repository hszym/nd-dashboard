"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import {
  Task,
  TASK_KIND_LABEL,
  assignQuestion,
  currentUserId,
  isOverdue,
  loadTasks,
} from "@/lib/tasks";

interface DealRef {
  id: string;
  slug: string;
  name: string;
}

const KIND_STYLE: Record<Task["kind"], string> = {
  question: "bg-sky-50 text-sky-700",
  document: "bg-emerald-50 text-emerald-700",
  todo: "bg-violet-50 text-violet-700",
};

/** "My tasks": what is waiting for the signed-in person, grouped by deal, plus the questions nobody has taken yet. */
export default function TasksPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [mine, setMine] = useState<Task[] | null>(null);
  const [toTake, setToTake] = useState<Task[]>([]);
  const [deals, setDeals] = useState<Record<string, DealRef>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = await currentUserId();
    if (!id) return;
    setUserId(id);
    const [tasks, cases] = await Promise.all([
      loadTasks(id),
      supabase.from("cases").select("id, slug, name"),
    ]);
    setDeals(Object.fromEntries((cases.data ?? []).map((c) => [c.id, c as DealRef])));
    setMine(tasks.mine);
    setToTake(tasks.toTake);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function take(t: Task) {
    if (!userId) return;
    setError(null);
    const { error: err } = await assignQuestion(t.id, userId);
    if (err) {
      setError(err.message);
      return;
    }
    load();
  }

  if (!mine) return <p className="text-sm text-slate-500">Loading…</p>;

  const groups = groupByDeal(mine, deals);
  const toTakeGroups = groupByDeal(toTake, deals);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My tasks</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mine.length === 0
            ? "Nothing is waiting for you."
            : `${mine.length} open ${mine.length === 1 ? "task" : "tasks"} assigned to you.`}
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {groups.map((g) => (
        <section key={g.key}>
          <DealTitle deal={g.deal} count={g.tasks.length} />
          <ul className="space-y-2">
            {g.tasks.map((t) => (
              <TaskRow key={`${t.kind}-${t.id}`} task={t} />
            ))}
          </ul>
        </section>
      ))}

      {toTake.length > 0 && (
        <div className="space-y-5 border-t border-slate-200 pt-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">To take</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Open questions nobody is in charge of yet.
            </p>
          </div>
          {toTakeGroups.map((g) => (
            <section key={g.key}>
              <DealTitle deal={g.deal} count={g.tasks.length} />
              <ul className="space-y-2">
                {g.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} onTake={() => take(t)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDeal(tasks: Task[], deals: Record<string, DealRef>) {
  const map = new Map<string, { key: string; deal: DealRef | null; tasks: Task[] }>();
  for (const t of tasks) {
    const key = t.case_id ?? "none";
    if (!map.has(key)) map.set(key, { key, deal: t.case_id ? (deals[t.case_id] ?? null) : null, tasks: [] });
    map.get(key)!.tasks.push(t);
  }
  return [...map.values()].sort((a, b) => (a.deal?.name ?? "~").localeCompare(b.deal?.name ?? "~"));
}

function DealTitle({ deal, count }: { deal: DealRef | null; count: number }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
      {deal ? (
        <Link href={`/cases/${deal.slug}`} className="hover:underline">
          {deal.name}
        </Link>
      ) : (
        "No deal"
      )}
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
        {count}
      </span>
    </h2>
  );
}

function TaskRow({ task, onTake }: { task: Task; onTake?: () => void }) {
  const late = isOverdue(task.due_date);
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <span
        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${KIND_STYLE[task.kind]}`}
      >
        {TASK_KIND_LABEL[task.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-900">{task.title}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          {task.priority === "blocking" && (
            <span className="font-medium text-red-600">Blocking · </span>
          )}
          {task.due_date ? (
            <span className={late ? "font-medium text-red-600" : ""}>
              {late ? "Overdue · " : "Due "}
              {formatDate(task.due_date)}
            </span>
          ) : (
            "No due date"
          )}
        </p>
      </div>
      {onTake && (
        <button
          onClick={onTake}
          className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
        >
          Take
        </button>
      )}
    </li>
  );
}
