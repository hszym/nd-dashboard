"use client";

import { useState } from "react";
import type { Case } from "@/lib/supabase";

function hexColor(hex: string | undefined | null): string | null {
  if (!hex) return null;
  const h = hex.trim().replace("#", "");
  return /^[0-9a-fA-F]{3,8}$/.test(h) ? `#${h}` : null;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/** A brand color labelled "Logo background" sets the tile color behind the logo. */
function logoBackground(project: Pick<Case, "brand_colors">): string | null {
  const match = project.brand_colors?.find((c) => /logo/i.test(c.label));
  return hexColor(match?.hex);
}

/**
 * A deal's logo tile. Roughly square logos fill the whole tile edge to edge;
 * wide or tall ones (e.g. a transparent wordmark) are shown whole with padding
 * so nothing gets cropped, on the deal's "Logo background" color if it has one.
 * Pass size and rounding through `className`.
 */
export default function CaseLogo({
  project,
  className = "",
  monogramClassName = "text-5xl",
}: {
  project: Case;
  className?: string;
  monogramClassName?: string;
}) {
  const [shape, setShape] = useState<"unknown" | "square" | "odd">("unknown");

  const measure = (img: HTMLImageElement | null) => {
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    const next = Math.abs(ratio - 1) > 0.12 ? "odd" : "square";
    setShape((prev) => (prev === next ? prev : next));
  };

  const primary = hexColor(project.brand_colors?.[0]?.hex);
  const logoBg = logoBackground(project);

  let background: string | undefined;
  if (!project.logo_url) background = primary ?? undefined;
  else if (shape === "odd") background = logoBg ?? "#ffffff";

  return (
    <div
      className={`relative isolate transform-gpu overflow-hidden bg-white/60 ${className}`}
      style={background ? { backgroundColor: background } : undefined}
    >
      {project.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={measure}
          src={project.logo_url}
          alt=""
          draggable={false}
          onLoad={(e) => measure(e.currentTarget)}
          className={`absolute transition-opacity duration-200 ${
            shape === "unknown" ? "opacity-0" : "opacity-100"
          } ${
            shape === "odd"
              ? "inset-[14%] h-[72%] w-[72%] object-contain"
              : "inset-0 h-full w-full object-cover"
          }`}
        />
      ) : (
        <span
          className={`absolute inset-0 flex items-center justify-center font-semibold tracking-tight ${
            primary ? "text-white" : "text-slate-700"
          } ${monogramClassName}`}
        >
          {initials(project.name)}
        </span>
      )}
    </div>
  );
}
