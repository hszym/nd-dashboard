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
      className="glass group relative flex aspect-[4/5] w-full flex-col overflow-hidden rounded-[2.25rem] p-5 shadow-[0_30px_70px_-25px_rgba(15,23,42,0.35)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      <div className="relative flex aspect-square w-full flex-none items-center justify-center rounded-[1.75rem] bg-white/50 transition-colors group-hover:bg-white/80">
        <svg
          viewBox="0 0 24 24"
          className="h-20 w-20 text-slate-600"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Add a new deal
        </h2>
      </div>

      <div
        aria-hidden
        className={`card-dim pointer-events-none absolute inset-0 bg-[#e9ecf0]/60 ${
          active ? "opacity-0" : "opacity-100"
        }`}
      />
    </Link>
  );
}
