import { NextRequest, NextResponse } from "next/server";
import { requireAgent } from "@/lib/agent-auth";
import { DEAL_DOCUMENTS_BUCKET_NAME, isDocumentType, mirrorPath } from "@/lib/agent-documents";

// Step 1 of mirroring a PDF: returns a one-time signed upload URL into the private bucket.
// The file replaces the previous copy. The caller PUTs the PDF, then calls
// POST /api/agent/documents with { mirror_path, mirror_hash, mirror_source }.

export async function POST(request: NextRequest) {
  const auth = await requireAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin, role } = auth.caller;
  if (role !== "admin") return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !isDocumentType(body?.type) || body.type === "Intro Email") {
    return NextResponse.json({ error: "Expected { slug, type } with a document type that has a PDF." }, { status: 400 });
  }
  const { data: deal } = await admin.from("cases").select("id").eq("slug", slug).maybeSingle();
  if (!deal) return NextResponse.json({ error: "Unknown deal." }, { status: 404 });

  const path = mirrorPath(deal.id, body.type);
  const { data, error } = await admin.storage
    .from(DEAL_DOCUMENTS_BUCKET_NAME)
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not create the upload URL." }, { status: 500 });

  return NextResponse.json({
    path: data.path,
    signedUrl: data.signedUrl,
    maxBytes: 25 * 1024 * 1024,
    contentType: "application/pdf",
  });
}
