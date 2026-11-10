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
      draggable={false}
      className="glass group relative flex aspect-[4/5] w-full flex-col overflow-hidden rounded-[2.25rem] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      {/* Logo fills the whole tile; the tile's rounding clips the image. */}
      <div
        className="relative aspect-square w-full flex-none overflow-hidden rounded-[1.75rem] bg-white/10 shadow-lg"
        style={!project.logo_url && tint ? { backgroundColor: tint } : undefined}
      >
        {project.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.logo_url}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-6xl font-semibold tracking-tight text-white">
            {initials(project.name)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="line-clamp-2 text-2xl font-semibold tracking-tight text-white">
          {project.name}
        </h2>
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-white/60">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              STAGE_DOT[project.stage] ?? "bg-white/50"
            }`}
          />
          {project.stage}
        </div>
      </div>

      {/* Dims inactive cards without putting opacity on an ancestor of the glass. */}
      <div
        aria-hidden
        className={`card-dim pointer-events-none absolute inset-0 bg-slate-950/45 ${
          active ? "opacity-0" : "opacity-100"
        }`}
      />
    </Link>
  );
}
