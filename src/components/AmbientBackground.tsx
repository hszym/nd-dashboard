"use client";

const DEFAULT_COLORS = ["#4f46e5", "#0ea5e9"];

function normalize(hex: string | undefined, fallback: string) {
  return hex && /^#?[0-9a-f]{3,8}$/i.test(hex.trim())
    ? hex.trim().startsWith("#")
      ? hex.trim()
      : `#${hex.trim()}`
    : fallback;
}

/**
 * Full-screen backdrop that tints to the focused project's brand colors.
 * The glow is a radial gradient (no CSS blur filter, which mobile browsers
 * drop on very large elements); `color` is transitioned so tints cross-fade.
 */
export default function AmbientBackground({ colors }: { colors: string[] }) {
  const a = normalize(colors[0], DEFAULT_COLORS[0]);
  const b = normalize(colors[1] ?? colors[0], DEFAULT_COLORS[1]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-950"
    >
      <div
        className="ambient-blob absolute -left-1/4 -top-1/4 h-[90vmax] w-[90vmax] rounded-full opacity-70"
        style={{ color: a }}
      />
      <div
        className="ambient-blob absolute -bottom-1/3 -right-1/4 h-[80vmax] w-[80vmax] rounded-full opacity-60"
        style={{ color: b }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-transparent to-slate-950/60" />
    </div>
  );
}
