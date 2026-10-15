"use client";

import { useEffect, useState } from "react";

export type CaseTab = "marketing" | "track";

const TABS: { id: CaseTab; label: string }[] = [
  { id: "marketing", label: "Marketing" },
  { id: "track", label: "Track" },
];

/** Tab bar for the project page. `?tab=track` deep-links to the Track tab. */
export default function CaseTabs({
  marketing,
  track,
}: {
  marketing: React.ReactNode;
  track: React.ReactNode;
}) {
  const [tab, setTab] = useState<CaseTab>("marketing");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "track") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read the deep-link once on mount
      setTab("track");
    }
  }, []);

  return (
    <div className="space-y-6">
      <div role="tablist" className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "marketing" ? marketing : track}
    </div>
  );
}
