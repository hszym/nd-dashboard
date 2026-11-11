"use client";

import Link from "next/link";
import type { Case } from "@/lib/supabase";
import CaseLogo from "@/components/CaseLogo";

const STAGE_DOT: Record<string, string> = {
  "Under Review": "bg-amber-400",
  Raising: "bg-sky-400",
  Completed: "bg-emerald-400",
};

export default function ProjectCard({
  project,
  active,
  onSelect,
}: {
  project: Case;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Link
      href={`/cases/${project.slug}`}
      // Side cards only center themselves first; the focused card navigates.
      onClick={(e) => {
        if (!active) {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={active ? 0 : -1}
      draggable={false}
      className="glass group relative flex aspect-[4/5] w-full flex-col overflow-hidden rounded-[2.25rem] p-5 shadow-[0_30px_70px_-25px_rgba(15,23,42,0.35)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      {/* Logo fills the whole tile (or sits padded if it's not square). */}
      <CaseLogo
        project={project}
        className="aspect-square w-full flex-none rounded-[1.75rem] shadow-lg"
        monogramClassName="text-6xl"
      />

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="line-clamp-2 text-2xl font-semibold tracking-tight text-slate-900">
          {project.name}
        </h2>
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              STAGE_DOT[project.stage] ?? "bg-slate-400"
            }`}
          />
          {project.stage}
        </div>
      </div>

      {/* Fades inactive cards without putting opacity on an ancestor of the glass. */}
      <div
        aria-hidden
        className={`card-dim pointer-events-none absolute inset-0 bg-[#e9ecf0]/60 ${
          active ? "opacity-0" : "opacity-100"
        }`}
      />
    </Link>
  );
}
