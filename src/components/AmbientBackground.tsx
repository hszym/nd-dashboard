"use client";

import { useEffect } from "react";
import type { CSSProperties } from "react";

const DEFAULT_COLORS = ["#4f46e5", "#0ea5e9"];
const BASE = "#e9ecf0";

function normalize(hex: string | undefined, fallback: string) {
  return hex && /^#?[0-9a-f]{3,8}$/i.test(hex.trim())
    ? hex.trim().startsWith("#")
      ? hex.trim()
      : `#${hex.trim()}`
    : fallback;
}

/**
 * Full-screen backdrop tinted by the focused project's brand colors. One
 * element, two big radial gradients painted straight onto it (no separate
 * blob shapes, so there is nothing that can read as a square on a phone).
 * The colors are registered custom properties so they cross-fade.
 */
export default function AmbientBackground({ colors }: { colors: string[] }) {
  const a = normalize(colors[0], DEFAULT_COLORS[0]);
  const b = normalize(colors[1] ?? colors[0], DEFAULT_COLORS[1]);

  // Phones paint the page background (and status bar) behind the fixed layer,
  // so make both dark while this page is shown, then restore.
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const prevBg = root.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    root.style.backgroundColor = BASE;
    // Once <html> has its own background, <body>'s white one stops propagating
    // to the canvas and would paint over the fixed -z-10 gradient layer.
    body.style.backgroundColor = "transparent";

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const created = !meta;
    const prevTheme = meta?.content ?? "";
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = BASE;

    return () => {
      root.style.backgroundColor = prevBg;
      body.style.backgroundColor = prevBodyBg;
      if (created) meta?.remove();
      else if (meta) meta.content = prevTheme;
    };
  }, []);

  return (
    <div
      aria-hidden
      className="ambient pointer-events-none fixed inset-0 -z-10"
      style={{ "--ambient-a": a, "--ambient-b": b } as CSSProperties}
    />
  );
}
