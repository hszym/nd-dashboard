"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, Case } from "@/lib/supabase";
import { useRole } from "@/lib/useRole";
import AmbientBackground from "@/components/AmbientBackground";
import ProjectCarousel from "@/components/ProjectCarousel";

export default function HomePage() {
  const role = useRole();
  const [cases, setCases] = useState<Case[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      setCases((data as Case[]) ?? []);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const current = cases?.[Math.min(active, (cases?.length ?? 1) - 1)];
  const colors = (current?.brand_colors ?? []).map((c) => c.hex);

  return (
    <>
      <AmbientBackground colors={colors} />

      {error ? (
        <Notice tone="error">Could not load cases: {error}</Notice>
      ) : !cases ? (
        <p className="py-24 text-center text-sm text-white/60">Loading…</p>
      ) : cases.length === 0 ? (
        <Notice>
          <h2 className="text-lg font-semibold text-white">No cases yet</h2>
          <p className="mt-1 text-sm text-white/60">
            Create your first case to get started.
          </p>
          {role !== "team" && (
            <Link
              href="/cases/new"
              className="mt-5 inline-block rounded-full bg-white px-5 py-2 text-sm font-medium text-slate-900 hover:bg-white/90"
            >
              + New case
            </Link>
          )}
        </Notice>
      ) : (
        <div className="relative left-1/2 w-screen -translate-x-1/2">
          <ProjectCarousel
            projects={cases}
            active={active}
            onActiveChange={setActive}
          />
          {current && (
            <p className="mt-5 text-center text-sm text-white/55">
              {[current.sector, current.sponsor && `Sponsor: ${current.sponsor}`]
                .filter(Boolean)
                .join(" · ") || " "}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Notice({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "error";
}) {
  return (
    <div
      className={`mx-auto mt-16 max-w-md rounded-[2rem] border p-10 text-center backdrop-blur-2xl ${
        tone === "error"
          ? "border-red-300/30 bg-red-500/10 text-sm text-red-100"
          : "border-white/20 bg-white/10"
      }`}
    >
      {children}
    </div>
  );
}
