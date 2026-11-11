"use client";

import { useRef, useState } from "react";
import { supabase, CASE_LOGOS_BUCKET, CASE_LOGO_MAX_BYTES } from "@/lib/supabase";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

/**
 * Upload a logo image to the logos bucket. `storageKey` groups a deal's files
 * in one folder; each upload gets a fresh filename, so a replaced logo never
 * shows a stale cached copy. Reports the public URL (or null on remove).
 */
export default function LogoUpload({
  value,
  storageKey,
  onChange,
  disabled,
}: {
  value: string | null;
  storageKey: string;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined | null) {
    if (!file || disabled) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Use a PNG, JPG, WebP, GIF or SVG image.");
      return;
    }
    if (file.size > CASE_LOGO_MAX_BYTES) {
      setError("That image is over 5 MB.");
      return;
    }
    setUploading(true);
    setError(null);
    const ext = file.type === "image/svg+xml" ? "svg" : (file.type.split("/")[1] ?? "png");
    const path = `${storageKey}/${Date.now()}.${ext === "jpeg" ? "jpg" : ext}`;
    const { error: upErr } = await supabase.storage
      .from(CASE_LOGOS_BUCKET)
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setUploading(false);
      setError(upErr.message);
      return;
    }
    const { data } = supabase.storage.from(CASE_LOGOS_BUCKET).getPublicUrl(path);
    setUploading(false);
    onChange(data.publicUrl);
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed text-center text-[11px] leading-tight ${
            dragOver
              ? "border-slate-900 bg-slate-50 text-slate-700"
              : "border-slate-300 bg-slate-50 text-slate-400 hover:text-slate-600"
          }`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Logo" className="h-full w-full object-contain p-1" />
          ) : uploading ? (
            "Uploading…"
          ) : (
            "Drop image or click"
          )}
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex gap-3">
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
              className="font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : value ? "Replace" : "Upload logo"}
            </button>
            {value && (
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => onChange(null)}
                className="text-slate-400 hover:text-red-500 disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-slate-400">PNG, JPG, WebP, GIF or SVG · up to 5 MB</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
