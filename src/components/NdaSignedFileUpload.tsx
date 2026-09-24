"use client";

import { useRef, useState } from "react";
import { supabase, NDA_SIGNED_FILES_BUCKET, ndaSignedFilePath } from "@/lib/supabase";

const SIGNED_EXTENSIONS = ["pdf", "docx", "doc"];

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.split("/").pop() || "file");
  } catch {
    return url.split("/").pop() || url;
  }
}

export default function NdaSignedFileUpload({
  ndaId,
  value,
  onSave,
}: {
  ndaId: string;
  value: string | null;
  onSave: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!SIGNED_EXTENSIONS.includes(ext)) {
      setError("Only .pdf, .docx or .doc files.");
      return;
    }
    setUploading(true);
    setError(null);
    const path = ndaSignedFilePath(ndaId, ext);
    const { error: upErr } = await supabase.storage
      .from(NDA_SIGNED_FILES_BUCKET)
      .upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      setError(upErr.message);
      return;
    }
    const { data } = supabase.storage
      .from(NDA_SIGNED_FILES_BUCKET)
      .getPublicUrl(path);
    setUploading(false);
    onSave(`${data.publicUrl}?download=${encodeURIComponent(file.name)}`);
  }

  if (value) {
    return (
      <div className="flex items-center gap-3">
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="max-w-[200px] truncate text-xs text-blue-600 underline"
        >
          📎 {fileNameFromUrl(value)}
        </a>
        <button
          onClick={() => inputRef.current?.click()}
          className="text-xs text-slate-400 hover:text-slate-900"
        >
          Replace
        </button>
        <button
          onClick={() => onSave(null)}
          className="text-xs text-slate-400 hover:text-red-500"
        >
          Remove
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
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
        className={`w-56 cursor-pointer rounded-md border border-dashed px-3 py-2 text-xs ${
          dragOver
            ? "border-slate-900 bg-slate-50 text-slate-700"
            : "border-slate-300 text-slate-400 hover:text-slate-600"
        }`}
      >
        {uploading ? "Uploading…" : "Drop signed NDA here, or click"}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
