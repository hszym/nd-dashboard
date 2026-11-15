"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate, daysUntil } from "@/lib/utils";
import {
  Item, TrackerData, Workspace, createItem, isOverdue, loadWorkspace, loadWorkspaces, saveItem,
} from "@/lib/tracker";
import ItemPanel from "./ItemPanel";
import ImportForm from "./ImportForm";

type View = "table" | "kanban" | "week";

const chip = "rounded-full px-2.5 py-0.5 text-[11px] font-medium";
const input = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none";

/**
 * The tracker UI. With `fixedWorkspaceId` + `fixedProjectId` it is locked to one
 * project (used on a deal page); without them it shows every workspace and project.
 */
export default function TrackerApp({
  fixedWorkspaceId,
  fixedProjectId,
}: {
  fixedWorkspaceId?: string;
  fixedProjectId?: string;
} = {}) {
  const fixed = !!fixedWorkspaceId && !!fixedProjectId;
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(
    fixed ? [{ id: fixedWorkspaceId!, name: "" }] : null
  );
  const [workspaceId, setWorkspaceId] = useState<string | null>(fixedWorkspaceId ?? null);
  const [data, setData] = useState<TrackerData | null>(null);
  const [view, setView] = useState<View>("table");
  const [project, setProject] = useState(fixedProjectId ?? "");
  const [status, setStatus] = useState("");
  const [responsible, setResponsible] = useState("");
  const [query, setQuery] = useState("");
  const [openItem, setOpenItem] = useState<Item | null>(null);
  const [newText, setNewText] = useState("");

  useEffect(() => {
    if (fixed) return;
    loadWorkspaces().then((w) => {
      setWorkspaces(w);
      setWorkspaceId((cur) => cur ?? w[0]?.id ?? null);
    });
  }, [fixed]);

  useEffect(() => {
    if (!workspaceId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload when the workspace changes
    setData(null);
    loadWorkspace(workspaceId).then(setData);
  }, [workspaceId]);

  const replaceItem = useCallback((it: Item) => {
    setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === it.id ? it : x)) } : d));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.items.filter(
      (i) =>
        (!project || i.project_id === project) &&
        (!status || i.status_id === status) &&
        (!responsible || (i.responsible ?? "").includes(responsible)) &&
        (!q || `${i.details} ${i.last_feedback ?? ""} ${i.pending_with ?? ""}`.toLowerCase().includes(q))
    );
  }, [data, project, status, responsible, query]);

  if (workspaces && workspaces.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-500">No tracker yet. An admin can import a workbook below.</p>
        <ImportForm onDone={() => loadWorkspaces().then((w) => { setWorkspaces(w); setWorkspaceId(w[0]?.id ?? null); })} />
      </div>
    );
  }
  if (!data || !workspaces) return <p className="text-sm text-slate-500">Loading…</p>;

  const statusOf = (id: string | null) => data.statuses.find((s) => s.id === id);
  const projectOf = (id: string) => data.projects.find((p) => p.id === id)?.name ?? "";
  const topicOf = (id: string | null) => data.topics.find((t) => t.id === id)?.name ?? "";
  const people = [...new Set(data.items.flatMap((i) => (i.responsible ?? "").split("/").map((s) => s.trim()).filter(Boolean)))].sort();

  // Overview counters (per project when one is selected).
  const scope = data.items.filter((i) => !project || i.project_id === project);
  const active = scope.filter((i) => statusOf(i.status_id)?.is_active);
  const counters = [
    ["To-dos", scope.length],
    ["Active", active.length],
    ["High priority, active", active.filter((i) => i.priority === "High").length],
    ["Urgency 1, active", active.filter((i) => i.urgency === 1).length],
    ["Overdue", scope.filter((i) => isOverdue(i, data.statuses)).length],
  ] as const;

  async function move(item: Item, statusId: string) {
    const saved = await saveItem(item, { status_id: statusId });
    if (saved) replaceItem(saved);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const projectId = project || data!.projects[0]?.id;
    const first = data!.statuses.find((s) => s.is_active) ?? data!.statuses[0];
    if (!newText.trim() || !projectId) return;
    const created = await createItem(projectId, newText.trim(), first?.id ?? null);
    if (created) {
      setData((d) => (d ? { ...d, items: [...d.items, created] } : d));
      setNewText("");
      setOpenItem(created);
    }
  }

  const rowTone = (i: Item) => {
    const st = statusOf(i.status_id);
    return [
      i.flag === true ? "bg-emerald-50" : i.flag === false ? "bg-red-50" : "",
      st && !st.is_active && !st.is_done ? "italic text-slate-400" : "",
    ].join(" ");
  };

  const Dot = ({ id }: { id: string | null }) => {
    const st = statusOf(id);
    return st ? <span className={chip} style={{ background: `${st.color ?? "#94a3b8"}22`, color: st.color ?? "#475569" }}>{st.name}</span> : null;
  };

  const DueCell = ({ i }: { i: Item }) => (
    <span className={isOverdue(i, data.statuses) ? "font-medium text-red-600" : ""}>{formatDate(i.due_date)}</span>
  );

  // "This week": overdue + due within 7 days, not done, grouped by responsible.
  const week = filtered
    .filter((i) => {
      if (!i.due_date || statusOf(i.status_id)?.is_done) return false;
      return (daysUntil(i.due_date) ?? 99) <= 7;
    })
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const weekGroups = week.reduce<Record<string, Item[]>>((acc, i) => {
    (acc[i.responsible || "Unassigned"] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!fixed && <h1 className="text-xl font-semibold tracking-tight text-slate-900">Tracker</h1>}
          {!fixed && workspaces.length > 1 && (
            <select className={input} value={workspaceId ?? ""} onChange={(e) => { setWorkspaceId(e.target.value); setProject(""); }}>
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
          {!fixed && workspaces.length === 1 && <span className="text-sm text-slate-500">{workspaces[0].name}</span>}
        </div>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-sm">
          {([["table", "Table"], ["kanban", "Board"], ["week", "This week"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-full px-3 py-1 ${view === v ? "bg-white font-medium shadow-sm" : "text-slate-500"}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Project cards double as the overview and as a quick filter. */}
      <div className={`flex gap-2 overflow-x-auto pb-1 ${fixed ? "hidden" : ""}`}>
        <button onClick={() => setProject("")} className={`${chip} whitespace-nowrap border ${!project ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}>All projects</button>
        {data.projects.map((p) => (
          <button key={p.id} onClick={() => setProject(p.id)} className={`${chip} whitespace-nowrap border ${project === p.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{p.name}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {counters.map(([l, n]) => (
          <div key={l} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className={`text-2xl font-semibold ${l === "Overdue" && n > 0 ? "text-red-600" : "text-slate-900"}`}>{n}</div>
            <div className="text-xs text-slate-500">{l}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className={`${input} w-full sm:w-56`} placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {data.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={input} value={responsible} onChange={(e) => setResponsible(e.target.value)}>
          <option value="">Everyone</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <form onSubmit={addItem} className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <input className={`${input} min-w-0 flex-1 sm:w-64 sm:flex-none`} placeholder="Quick add a to-do…" value={newText} onChange={(e) => setNewText(e.target.value)} />
          <button className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700">Add</button>
        </form>
      </div>

      {view === "table" && (
        <>
        {/* Phone: cards, so nothing scrolls sideways inside the swipeable deal pages. */}
        <ul className="space-y-2 md:hidden">
          {filtered.map((i) => (
            <li
              key={i.id}
              onClick={() => setOpenItem(i)}
              className={`cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-sm ${rowTone(i)}`}
            >
              <p className="text-slate-800">{i.details}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <Dot id={i.status_id} />
                {!fixed && <span>{projectOf(i.project_id)}</span>}
                {topicOf(i.topic_id) && <span>{topicOf(i.topic_id)}</span>}
                {i.priority && <span>{i.priority}</span>}
                {i.responsible && <span>{i.responsible}</span>}
                {i.due_date && <DueCell i={i} />}
              </div>
            </li>
          ))}
          {!filtered.length && <li className="py-6 text-center text-sm text-slate-400">No to-dos match.</li>}
        </ul>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {["Project", "Topic", "Details", "Status", "Priority", "Urg.", "Responsibility", "Due"]
                  .filter((h) => !(fixed && h === "Project"))
                  .map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} onClick={() => setOpenItem(i)} className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${rowTone(i)}`}>
                  {!fixed && <td className="whitespace-nowrap px-3 py-2">{projectOf(i.project_id)}</td>}
                  <td className="px-3 py-2">{topicOf(i.topic_id)}</td>
                  <td className="min-w-[16rem] px-3 py-2">{i.details}</td>
                  <td className="px-3 py-2"><Dot id={i.status_id} /></td>
                  <td className="px-3 py-2">{i.priority ?? "—"}</td>
                  <td className="px-3 py-2">{i.urgency ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{i.responsible ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2"><DueCell i={i} /></td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={fixed ? 7 : 8} className="px-3 py-6 text-center text-slate-400">No to-dos match.</td></tr>}
            </tbody>
          </table>
        </div>
        </>
      )}

      {view === "kanban" && (
        <div className="grid gap-3 md:grid-cols-4">
          {data.statuses.map((s) => (
            <div
              key={s.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const item = data.items.find((x) => x.id === e.dataTransfer.getData("text/plain"));
                if (item && item.status_id !== s.id) move(item, s.id);
              }}
              className="min-h-40 rounded-2xl bg-slate-100/70 p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1 text-xs font-medium text-slate-600">
                <span>{s.name}</span>
                <span className="text-slate-400">{filtered.filter((i) => i.status_id === s.id).length}</span>
              </div>
              <div className="space-y-2">
                {filtered.filter((i) => i.status_id === s.id).map((i) => (
                  <div
                    key={i.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}
                    onClick={() => setOpenItem(i)}
                    className={`cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm ${i.flag === true ? "border-l-4 border-l-emerald-500" : i.flag === false ? "border-l-4 border-l-red-500" : ""}`}
                  >
                    <p className="line-clamp-3 text-slate-800">{i.details}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{projectOf(i.project_id)} · {topicOf(i.topic_id)}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{i.responsible ?? "Unassigned"}</span>
                      <DueCell i={i} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "week" && (
        <div className="space-y-4">
          {!week.length && <p className="text-sm text-slate-400">Nothing due in the next 7 days, and nothing overdue.</p>}
          {Object.entries(weekGroups).map(([who, list]) => (
            <div key={who} className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium text-slate-700">{who} <span className="text-slate-400">· {list.length}</span></div>
              <ul>
                {list.map((i) => (
                  <li key={i.id} onClick={() => setOpenItem(i)} className="flex cursor-pointer items-start justify-between gap-3 border-t border-slate-100 px-4 py-2 text-sm first:border-t-0 hover:bg-slate-50">
                    <span>{i.details}<span className="ml-2 text-[11px] text-slate-400">{projectOf(i.project_id)}</span></span>
                    <span className="whitespace-nowrap text-xs"><DueCell i={i} /></span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <ItemPanel item={openItem} data={data} onClose={() => setOpenItem(null)} onSaved={replaceItem} />
    </div>
  );
}
