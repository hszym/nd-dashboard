"use client";

import { useState } from "react";
import { supabase, Case, BrandColor } from "@/lib/supabase";
import LogoUpload from "@/components/LogoUpload";

const HEX = /^[0-9a-fA-F]{6}$/;

function websiteHref(url: string): string {
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

/**
 * The deal's brand in one place: logo (an uploaded image), colors and website.
 * Everyone can see it; admins can change it. The logo saves as soon as it is
 * uploaded; colors and website save with the Save button.
 */
export default function BrandKit({
  caseData,
  isAdmin,
  onSaved,
}: {
  caseData: Case;
  isAdmin: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [colors, setColors] = useState<BrandColor[]>(caseData.brand_colors ?? []);
  const [website, setWebsite] = useState(caseData.website_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function saveLogo(url: string | null) {
    setError(null);
    const { error } = await supabase
      .from("cases")
      .update({ logo_url: url })
      .eq("id", caseData.id);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  async function saveDetails() {
    setSaving(true);
    setError(null);
    // Only rows left completely blank are dropped; a label is optional.
    const cleaned = colors
      .map((c) => ({ label: c.label.trim(), hex: c.hex.trim().replace("#", "") }))
      .filter((c) => c.label || c.hex);
    const bad = cleaned.find((c) => !HEX.test(c.hex));
    if (bad) {
      setSaving(false);
      setError(
        `${bad.label ? `"${bad.label}"` : "A color"} needs a 6-digit hex code, like 1C3D5A.`
      );
      return;
    }
    const { error } = await supabase
      .from("cases")
      .update({ brand_colors: cleaned, website_url: website.trim() || null })
      .eq("id", caseData.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(false);
    onSaved();
  }

  function startEditing() {
    setColors(caseData.brand_colors ?? []);
    setWebsite(caseData.website_url ?? "");
    setError(null);
    setEditing(true);
  }

  async function copyHex(hex: string) {
    try {
      await navigator.clipboard.writeText(`#${hex.toUpperCase()}`);
      setCopied(hex);
      setTimeout(() => setCopied((c) => (c === hex ? null : c)), 1500);
    } catch {
      // Clipboard blocked: the hex is on screen to copy by hand.
    }
  }

  const savedColors = caseData.brand_colors ?? [];

  return (
    <div className="space-y-5 text-sm">
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Logo
        </div>
        {isAdmin ? (
          <LogoUpload
            value={caseData.logo_url}
            storageKey={caseData.slug}
            onChange={saveLogo}
          />
        ) : caseData.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={caseData.logo_url}
            alt={`${caseData.name} logo`}
            className="h-24 w-24 rounded-2xl border border-slate-200 bg-slate-50 object-contain p-1"
          />
        ) : (
          <p className="text-slate-400">No logo yet.</p>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Colors
            </div>
            <div className="space-y-2">
              {colors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Label (e.g. Primary)"
                    value={c.label}
                    onChange={(e) =>
                      setColors((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))
                      )
                    }
                  />
                  <input
                    className="input w-28"
                    placeholder="1C3D5A"
                    value={c.hex}
                    onChange={(e) =>
                      setColors((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, hex: e.target.value.replace("#", "") } : x
                        )
                      )
                    }
                  />
                  <span
                    className="h-8 w-8 shrink-0 rounded-md border border-slate-200"
                    style={{ backgroundColor: HEX.test(c.hex) ? `#${c.hex}` : "transparent" }}
                  />
                  <button
                    type="button"
                    onClick={() => setColors((prev) => prev.filter((_, j) => j !== i))}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setColors((prev) => [...prev, { label: "", hex: "" }])}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                + Add color
              </button>
              <p className="text-xs text-slate-400">
                The first color tints the page. A color labelled &ldquo;Logo
                background&rdquo; sits behind wide or transparent logos.
              </p>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Website
            </span>
            <input
              className="input"
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveDetails}
              disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Colors
            </div>
            {savedColors.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {savedColors.map((c, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => copyHex(c.hex)}
                      title="Copy hex"
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-2 text-left hover:bg-slate-50"
                    >
                      <span
                        className="h-9 w-9 shrink-0 rounded-lg border border-slate-200"
                        style={{ backgroundColor: `#${c.hex.replace("#", "")}` }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {c.label || `Color ${i + 1}`}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {copied === c.hex ? "Copied" : `#${c.hex.replace("#", "").toUpperCase()}`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400">No colors yet.</p>
            )}
          </div>

          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Website
            </div>
            {caseData.website_url ? (
              <a
                href={websiteHref(caseData.website_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                {caseData.website_url} ↗
              </a>
            ) : (
              <p className="text-slate-400">No website yet.</p>
            )}
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit colors &amp; website
            </button>
          )}
        </>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
