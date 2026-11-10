"use client";

import Link from "next/link";

export default function NewDealCard({
  active,
  onSelect,
}: {
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Link
      href="/cases/new"
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
      <div className="relative flex aspect-square w-full flex-none items-center justify-center rounded-[1.75rem] border-2 border-dashed border-white/35 transition-colors group-hover:border-white/60">
        <svg
          viewBox="0 0 24 24"
          className="h-20 w-20 text-white/80"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Add a new deal
        </h2>
      </div>

      <div
        aria-hidden
        className={`card-dim pointer-events-none absolute inset-0 bg-slate-950/45 ${
          active ? "opacity-0" : "opacity-100"
        }`}
      />
    </Link>
  );
}
