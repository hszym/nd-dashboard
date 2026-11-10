"use client";

import Link from "next/link";
import type { Case } from "@/lib/supabase";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

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
  const tint = project.brand_colors?.[0]?.hex;

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
      className="group flex aspect-[4/5] w-full flex-col items-center justify-center gap-7 rounded-[2.25rem] border border-white/20 bg-white/10 p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      <div
        className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-[2rem] bg-white/90 shadow-lg ring-1 ring-white/40"
        style={!project.logo_url && tint ? { backgroundColor: tint } : undefined}
      >
        {project.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.logo_url}
            alt=""
            draggable={false}
            className="h-full w-full object-contain p-4"
          />
        ) : (
          <span className="text-4xl font-semibold tracking-tight text-white">
            {initials(project.name)}
          </span>
        )}
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          {project.name}
        </h2>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-white/60">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              STAGE_DOT[project.stage] ?? "bg-white/50"
            }`}
          />
          {project.stage}
        </div>
      </div>
    </Link>
  );
}
