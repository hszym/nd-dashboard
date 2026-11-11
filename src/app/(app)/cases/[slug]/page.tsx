"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  supabase,
  Case,
  CaseDocument,
  DocumentStatus,
  DOCUMENT_TYPES,
} from "@/lib/supabase";
import { useRole } from "@/lib/useRole";
import AmbientBackground from "@/components/AmbientBackground";
import DealPager from "@/components/DealPager";

export default function CaseDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const role = useRole();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const { data: c, error: cErr } = await supabase
      .from("cases")
      .select("*")
      .eq("slug", params.slug)
      .maybeSingle();
    if (cErr || !c) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setCaseData(c);
    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .eq("case_id", c.id);
    const byType = new Map((docs ?? []).map((d) => [d.type, d]));
    const ordered = DOCUMENT_TYPES.map(
      (t) =>
        byType.get(t) ?? {
          id: `missing-${t}`,
          case_id: c.id,
          type: t,
          status: "Missing" as DocumentStatus,
          file_url: null,
          updated_at: c.created_at,
        }
    );
    setDocuments(ordered);
    setLoading(false);
  }, [params.slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function updateDocument(
    doc: CaseDocument,
    patch: Partial<Pick<CaseDocument, "status" | "file_url">>
  ) {
    if (!caseData) return;
    // optimistic update
    setDocuments((prev) =>
      prev.map((d) => (d.type === doc.type ? { ...d, ...patch } : d))
    );
    if (doc.id.startsWith("missing-")) {
      const { data, error } = await supabase
        .from("documents")
        .insert({
          case_id: caseData.id,
          type: doc.type,
          status: patch.status ?? "Missing",
          file_url: patch.file_url ?? null,
        })
        .select()
        .single();
      if (!error && data) {
        setDocuments((prev) =>
          prev.map((d) => (d.type === doc.type ? data : d))
        );
      }
    } else {
      await supabase.from("documents").update(patch).eq("id", doc.id);
    }
  }

  const colors = (caseData?.brand_colors ?? []).map((c) => c.hex);

  let content: React.ReactNode;
  if (loading || role === undefined) {
    content = <p className="py-24 text-center text-sm text-slate-500">Loading…</p>;
  } else if (notFound || !caseData) {
    content = (
      <div className="glass mx-auto mt-16 max-w-md rounded-[2rem] p-10 text-center text-slate-900">
        <p className="text-slate-600">Deal not found.</p>
        <Link href="/" className="mt-3 inline-block text-sm underline">
          Back to deals
        </Link>
      </div>
    );
  } else {
    content = (
      <DealPager
        caseData={caseData}
        documents={documents}
        role={role}
        onUpdateDocument={updateDocument}
        onReload={load}
        onDeleted={() => router.push("/")}
      />
    );
  }

  return (
    <>
      <AmbientBackground colors={colors} />
      {content}
    </>
  );
}
