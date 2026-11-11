"use client";

import { useCallback, useEffect, useState } from "react";
import {
  supabase,
  Case,
  CaseInboxItem,
  CASE_INBOX_BUCKET,
} from "@/lib/supabase";
import { formatDate } from "@/lib/utils";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Admin list of documents/notes dropped on a deal, to be reviewed. */
export default function InboxReview({
  caseData,
  refreshKey,
}: {
  caseData: Case;
  refreshKey: number;
}) {
  const [items, setItems] = useState<CaseInboxItem[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("case_inbox_items")
      .select("*")
      .eq("case_id", caseData.id)
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      return;
    }
    const rows = (data as CaseInboxItem[]) ?? [];
    setItems(rows);

    const paths = rows.flatMap((r) => r.files.map((f) => f.path));
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from(CASE_INBOX_BUCKET)
        .createSignedUrls(paths, 60 * 60);
      const map: Record<string, string> = {};
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
      }
      setUrls(map);
    } else {
      setUrls({});
    }
  }, [caseData.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and when a new submission arrives
    load();
  }, [load, refreshKey]);

  async function setStatus(item: CaseInboxItem, status: CaseInboxItem["status"]) {
    setItems((prev) =>
      prev ? prev.map((i) => (i.id === item.id ? { ...i, status } : i)) : prev
    );
    await supabase
      .from("case_inbox_items")
      .update({
        status,
        reviewed_at: status === "reviewed" ? new Date().toISOString() : null,
      })
      .eq("id", item.id);
  }

  async function remove(item: CaseInboxItem) {
    if (!confirm("Delete this submission and its files? This cannot be undone.")) return;
    setItems((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev));
    if (item.files.length) {
      await supabase.storage
        .from(CASE_INBOX_BUCKET)
        .remove(item.files.map((f) => f.path));
    }
    await supabase.from("case_inbox_items").delete().eq("id", item.id);
  }

  if (error) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        The review list isn&apos;t available: {error}
      </p>
    );
  }
  if (!items) return <p className="text-sm text-slate-500">Loading…</p>;
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Nothing waiting for review.</p>;
  }

  const pending = items.filter((i) => i.status === "to_review");
  const reviewed = items.filter((i) => i.status === "reviewed");

  const renderItem = (item: CaseInboxItem) => (
    <li
      key={item.id}
      className={`rounded-2xl p-4 ${
        item.status === "to_review" ? "border border-slate-200" : "bg-slate-50"
      }`}
    >
      <p className="text-xs text-slate-400">
        {formatDate(item.created_at.slice(0, 10))}
      </p>
      {item.note && (
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{item.note}</p>
      )}
      {item.files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {item.files.map((f) => {
            const url = urls[f.path];
            return (
              <li key={f.path} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-slate-700">
                  📎 {f.name}{" "}
                  <span className="text-xs text-slate-400">{formatSize(f.size)}</span>
                </span>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs text-blue-600 underline"
                  >
                    Open ↗
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">…</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex gap-4">
        {item.status === "to_review" ? (
          <button
            onClick={() => setStatus(item, "reviewed")}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
          >
            Mark reviewed
          </button>
        ) : (
          <button
            onClick={() => setStatus(item, "to_review")}
            className="text-xs text-slate-400 hover:text-slate-900"
          >
            Move back to review
          </button>
        )}
        <button
          onClick={() => remove(item)}
          className="text-xs text-slate-400 hover:text-red-500"
        >
          Delete
        </button>
      </div>
    </li>
  );

  return (
    <div className="space-y-4">
      {pending.length > 0 ? (
        <ul className="space-y-3">{pending.map(renderItem)}</ul>
      ) : (
        <p className="text-sm text-slate-500">Nothing waiting for review.</p>
      )}
      {reviewed.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Reviewed
          </h3>
          <ul className="space-y-2">{reviewed.map(renderItem)}</ul>
        </div>
      )}
    </div>
  );
}
