"use client";

import { useEffect, useState } from "react";
import Sheet from "@/components/Sheet";
import { formatDate } from "@/lib/utils";
import { Item, TrackerData, TrackerEvent, loadEvents, saveItem } from "@/lib/tracker";

const field = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none";
const label = "mb-1 block text-xs font-medium text-slate-500";

/** Side sheet to edit one to-do; every save is logged in the item's history. */
export default function ItemPanel({
  item,
  data,
  onClose,
  onSaved,
}: {
  item: Item | null;
  data: TrackerData;
  onClose: () => void;
  onSaved: (item: Item) => void;
}) {
  const [draft, setDraft] = useState<Item | null>(item);
  const [feedback, setFeedback] = useState("");
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the form when another item opens
    setDraft(item);
    setFeedback("");
    setError(null);
    if (item) loadEvents(item.id).then(setEvents);
  }, [item]);

  if (!item || !draft) return null;

  const set = <K extends keyof Item>(k: K, v: Item[K]) => setDraft({ ...draft, [k]: v });

  async function save() {
    if (!item || !draft) return;
    setSaving(true);
    setError(null);
    // A new "last feedback" is stamped with today's date, like the manual convention in the spreadsheet.
    const stamped = feedback.trim()
      ? `${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${feedback.trim()}`
      : null;
    const patch: Partial<Item> = { ...draft };
    if (stamped) patch.last_feedback = stamped;
    const saved = await saveItem(item, patch);
    setSaving(false);
    if (!saved) {
      setError("Could not save. Try again.");
      return;
    }
    onSaved(saved);
    onClose();
  }

  const names = (id: string | null, list: { id: string; name: string }[]) => list.find((x) => x.id === id)?.name ?? "—";

  return (
    <Sheet open onClose={onClose} title="To-do">
      <div className="space-y-4">
        <div>
          <label className={label}>Details</label>
          <textarea className={field} rows={3} value={draft.details} onChange={(e) => set("details", e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Status</label>
            <select className={field} value={draft.status_id ?? ""} onChange={(e) => set("status_id", e.target.value || null)}>
              <option value="">—</option>
              {data.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Topic</label>
            <select className={field} value={draft.topic_id ?? ""} onChange={(e) => set("topic_id", e.target.value || null)}>
              <option value="">—</option>
              {data.topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Priority</label>
            <select className={field} value={draft.priority ?? ""} onChange={(e) => set("priority", (e.target.value || null) as Item["priority"])}>
              <option value="">—</option>
              <option>High</option><option>Medium</option><option>Low</option>
            </select>
          </div>
          <div>
            <label className={label}>Urgency (1 = most urgent)</label>
            <select className={field} value={draft.urgency ?? ""} onChange={(e) => set("urgency", e.target.value ? Number(e.target.value) : null)}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Responsibility</label>
            <input className={field} value={draft.responsible ?? ""} onChange={(e) => set("responsible", e.target.value || null)} />
          </div>
          <div>
            <label className={label}>Pending with</label>
            <input className={field} value={draft.pending_with ?? ""} onChange={(e) => set("pending_with", e.target.value || null)} />
          </div>
          <div>
            <label className={label}>Start date</label>
            <input type="date" className={field} value={draft.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} />
          </div>
          <div>
            <label className={label}>Due date</label>
            <input type="date" className={field} value={draft.due_date ?? ""} onChange={(e) => set("due_date", e.target.value || null)} />
          </div>
          <div>
            <label className={label}>Flag</label>
            <select
              className={field}
              value={draft.flag === null ? "" : draft.flag ? "yes" : "no"}
              onChange={(e) => set("flag", e.target.value === "" ? null : e.target.value === "yes")}
            >
              <option value="">None</option><option value="yes">Yes (green)</option><option value="no">No (red)</option>
            </select>
          </div>
          <div>
            <label className={label}>Result of last feedback</label>
            <input className={field} value={draft.feedback_result ?? ""} onChange={(e) => set("feedback_result", e.target.value || null)} />
          </div>
        </div>

        <div>
          <label className={label}>Last feedback</label>
          {draft.last_feedback && <p className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{draft.last_feedback}</p>}
          <textarea
            className={field}
            rows={2}
            placeholder="Add a new update (today's date is added automatically)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600 hover:bg-slate-200">Cancel</button>
          <button type="button" onClick={save} disabled={saving || !draft.details.trim()} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {events.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">History</h3>
            <ul className="space-y-2 text-xs text-slate-600">
              {events.map((ev) => (
                <li key={ev.id}>
                  <span className="text-slate-400">{formatDate(ev.created_at.slice(0, 10))} ·{ev.source}</span>{" "}
                  {ev.note ?? Object.entries(ev.changes).map(([k, c]) => {
                    const show = (v: unknown) =>
                      k === "status_id" ? names(v as string, data.statuses)
                      : k === "topic_id" ? names(v as string, data.topics)
                      : String(v ?? "—");
                    return `${k.replace(/_/g, " ")}: ${show(c.from)} → ${show(c.to)}`;
                  }).join("; ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}
