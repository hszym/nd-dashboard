"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Case } from "@/lib/supabase";
import ProjectCard from "./ProjectCard";

export default function ProjectCarousel({
  projects,
  active,
  onActiveChange,
}: {
  projects: Case[];
  active: number;
  onActiveChange: (index: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const raf = useRef<number | null>(null);

  const scrollTo = useCallback((index: number, smooth = true) => {
    const el = slideRefs.current[index];
    el?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      inline: "center",
      block: "nearest",
    });
  }, []);

  // Work out which slide is closest to the track's center.
  const onScroll = useCallback(() => {
    if (raf.current !== null) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const track = trackRef.current;
      if (!track) return;
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      slideRefs.current.forEach((el, i) => {
        if (!el) return;
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      onActiveChange(best);
    });
  }, [onActiveChange]);

  useEffect(() => {
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowRight") scrollTo(Math.min(active + 1, projects.length - 1));
      if (e.key === "ArrowLeft") scrollTo(Math.max(active - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, projects.length, scrollTo]);

  const atStart = active <= 0;
  const atEnd = active >= projects.length - 1;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory items-center gap-5 overflow-x-auto scroll-smooth px-[calc(50%-min(39vw,180px))] py-10"
      >
        {projects.map((p, i) => (
          <div
            key={p.id}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className={`carousel-slide w-[min(78vw,360px)] shrink-0 snap-center ${
              i === active ? "is-active" : ""
            }`}
          >
            <ProjectCard
              project={p}
              active={i === active}
              onSelect={() => scrollTo(i)}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Previous project"
        onClick={() => scrollTo(active - 1)}
        disabled={atStart}
        className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-xl transition hover:bg-white/20 disabled:opacity-0 md:flex"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next project"
        onClick={() => scrollTo(active + 1)}
        disabled={atEnd}
        className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-xl transition hover:bg-white/20 disabled:opacity-0 md:flex"
      >
        ›
      </button>

      <div className="mt-2 flex items-center justify-center gap-2">
        {projects.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-label={`Go to ${p.name}`}
            onClick={() => scrollTo(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? "w-6 bg-white" : "w-1.5 bg-white/35"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
