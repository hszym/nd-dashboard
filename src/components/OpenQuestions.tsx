"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, CaseQuestion } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";

/**
 * Shared list of open questions for a deal. Claude writes questions into the deal's
 * 00_README.md and syncs them here; answers given here are written back into the file
 * at the next sync. Every change made here clears `md_synced_at`, which is what marks
 * it as "waiting for the file".
 */
export default function OpenQuestions({
  caseId,
  isAdmin,
}: {
  caseId: string;
  isAdmin: boolean;
}) {
  const [items, setItems] = useState<CaseQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("case_questions")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      return;
    }
    setItems((data as CaseQuestion[]) ?? []);
  }, [caseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function add() {
    const question = text.trim();
    if (!question) return;
    setAdding(true);
    const { error: err } = await supabase
      .from("case_questions")
      .insert({ case_id: caseId, question, priority: blocking ? "blocking" : "normal" });
    setAdding(false);
    if (err) {
      setError(err.message);
      return;
    }
    setText("");
    setBlocking(false);
    load();
  }

  async function answer(q: CaseQuestion) {
    const a = answerText.trim();
    const { error: err } = await supabase
      .from("case_questions")
      .update({
        answer: a || null,
        status: "answered",
        answered_at: new Date().toISOString(),
        md_synced_at: null,
      })
      .eq("id", q.id);
    if (err) {
      setError(err.message);
      return;
    }
    setAnsweringId(null);
    setAnswerText("");
    load();
  }

  async function reopen(q: CaseQuestion) {
    await supabase
      .from("case_questions")
      .update({ status: "open", answered_at: null, md_synced_at: null })
      .eq("id", q.id);
    load();
  }

  async function togglePriority(q: CaseQuestion) {
    const next = q.priority === "blocking" ? "normal" : "blocking";
    setItems((prev) =>
      prev ? prev.map((i) => (i.id === q.id ? { ...i, priority: next } : i)) : prev
    );
    await supabase
      .from("case_questions")
      .update({ priority: next, md_synced_at: null })
      .eq("id", q.id);
    load();
  }

  async function remove(q: CaseQuestion) {
    if (!confirm("Delete this question?")) return;
    setItems((prev) => (prev ? prev.filter((i) => i.id !== q.id) : prev));
    await supabase.from("case_questions").delete().eq("id", q.id);
  }

  if (error) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        Open questions aren&apos;t available: {error}
      </p>
    );
  }
  if (!items) return <p className="text-sm text-slate-500">Loading…</p>;

  // Blocking questions first, then the newest.
  const open = items
    .filter((i) => i.status === "open")
    .sort(
      (a, b) =>
        Number(b.priority === "blocking") - Number(a.priority === "blocking") ||
        b.created_at.localeCompare(a.created_at)
    );
  const answered = items.filter((i) => i.status === "answered");
  const blockingCount = open.filter((i) => i.priority === "blocking").length;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Add an open question…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <button
            onClick={add}
            disabled={adding || !text.trim()}
            className="rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={blocking}
            onChange={(e) => setBlocking(e.target.checked)}
          />
          Blocking (the deal can&apos;t move forward without an answer)
        </label>
      </div>

      {open.length > 0 && (
        <p className="text-xs text-slate-500">
          {open.length} open
          {blockingCount > 0 && (
            <>
              {" · "}
              <span className="font-medium text-red-600">{blockingCount} blocking</span>
            </>
          )}
        </p>
      )}

      {items.length === 0 && (
        <p className="text-sm text-slate-500">No questions yet.</p>
      )}

      <ul className="space-y-3">
        {open.map((q) => {
          const isBlocking = q.priority === "blocking";
          return (
            <li
              key={q.id}
              className={`rounded-2xl border p-4 ${
                isBlocking ? "border-red-200 bg-red-50/40" : "border-slate-200"
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                {q.ref && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {q.ref}
                  </span>
                )}
                {isBlocking && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                    Blocking
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-900">{q.question}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Asked {formatDate(q.created_at.slice(0, 10))}
                {q.source && <> · Source: {q.source}</>}
                {!q.ref && <> · Will be added to the deal file at the next sync</>}
              </p>
              {answeringId === q.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    autoFocus
                    className="input min-h-20"
                    placeholder="Answer (optional)"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => answer(q)}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                    >
                      Mark answered
                    </button>
                    <button
                      onClick={() => setAnsweringId(null)}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-4">
                  <button
                    onClick={() => {
                      setAnsweringId(q.id);
                      setAnswerText("");
                    }}
                    className="text-xs font-medium text-slate-700 hover:text-slate-900"
                  >
                    Answer
                  </button>
                  <button
                    onClick={() => togglePriority(q)}
                    className="text-xs text-slate-400 hover:text-slate-900"
                  >
                    {isBlocking ? "Not blocking" : "Mark blocking"}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => remove(q)}
                      className="text-xs text-slate-400 hover:text-red-500"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {answered.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Answered
          </h3>
          <ul className="space-y-2">
            {answered.map((q) => (
              <li key={q.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  {q.ref && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                      {q.ref}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700">{q.question}</p>
                {q.answer && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">
                    {q.answer}
                  </p>
                )}
                <div className="mt-2 flex gap-4">
                  <button
                    onClick={() => reopen(q)}
                    className="text-xs text-slate-400 hover:text-slate-900"
                  >
                    Reopen
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => remove(q)}
                      className="text-xs text-slate-400 hover:text-red-500"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
