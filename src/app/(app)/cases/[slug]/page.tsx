"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  supabase,
  Case,
  CaseDocument,
  CaseRound,
  DocumentStatus,
  DOCUMENT_TYPES,
  isRoundDocumentType,
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
  const [rounds, setRounds] = useState<CaseRound[]>([]);
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
    const [{ data: docs }, { data: roundRows }] = await Promise.all([
      supabase.from("documents").select("*").eq("case_id", c.id),
      supabase.from("case_rounds").select("*").eq("case_id", c.id).order("sort"),
    ]);
    const rs = (roundRows ?? []) as CaseRound[];
    setRounds(rs);
    // One row per document the deal should have: the shared types once, the round types once per round.
    // A document nobody has filled in yet has no row: it is made up here ("missing-…") and inserted on first edit.
    const rows = (docs ?? []) as CaseDocument[];
    const ordered: CaseDocument[] = [];
    for (const t of DOCUMENT_TYPES) {
      const scopes: (string | null)[] = isRoundDocumentType(t) ? rs.map((r) => r.id) : [null];
      for (const roundId of scopes) {
        ordered.push(
          rows.find((d) => d.type === t && (d.round_id ?? null) === roundId) ?? {
            id: `missing-${roundId ?? "common"}-${t}`,
            case_id: c.id,
            round_id: roundId,
            type: t,
            status: "Missing" as DocumentStatus,
            file_url: null,
            attachment_url: null,
            mirror_path: null,
            mirror_synced_at: null,
            mirror_source: null,
            updated_at: c.created_at,
          }
        );
      }
    }
    setDocuments(ordered);
    setLoading(false);  }, [params.slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function updateDocument(
    doc: CaseDocument,
    patch: Partial<Pick<CaseDocument, "file_url" | "attachment_url">>
  ) {
    if (!caseData) return;
    // The old status column is no longer shown, but keep it consistent with
    // the link in case anything else reads it.
    const full = {
      ...patch,
      status: (("file_url" in patch ? patch.file_url : doc.file_url)
        ? "Done"
        : "Missing") as DocumentStatus,
    };
    // optimistic update
    setDocuments((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, ...full } : d))
    );
    if (doc.id.startsWith("missing-")) {
      const { data, error } = await supabase
        .from("documents")
        .insert({
          case_id: caseData.id,
          round_id: doc.round_id ?? null,
          type: doc.type,
          status: full.status,
          file_url: patch.file_url ?? null,
          attachment_url: patch.attachment_url ?? null,
        })
        .select()
        .single();
      if (!error && data) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? data : d))
        );
      }
    } else {
      await supabase.from("documents").update(full).eq("id", doc.id);
    }
  }
  const colors = (caseData?.brand_colors ?? []).map((c) => c.hex);

  let content: React.ReactNode;
  if (loading || role === undefined) {
    content = <p className="py-24 text-center text-sm text-slate-500">Loadingâ€¦</p>;
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
        rounds={rounds}
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
