import { NextRequest, NextResponse } from "next/server";
import { requireAgent } from "@/lib/agent-auth";
import {
  AGENT_ATTACHMENT_TYPES,
  CASE_FILES_BUCKET_NAME,
  attachmentPath,
  isDocumentType,
} from "@/lib/agent-documents";

// Step 1 of attaching a PDF: returns a one-time signed URL. The caller PUTs the file straight
// to storage (Vercel limits request bodies to about 4.5 MB, a deck is often larger), then calls
// POST /api/agent/documents with the returned `path`.

export async function POST(request: NextRequest) {
  const auth = await requireAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin, role } = auth.caller;
  if (role !== "admin") return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !isDocumentType(body?.type) || !AGENT_ATTACHMENT_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "Expected { slug, type } with type 2-pager or Deck." }, { status: 400 });
  }
  const { data: deal } = await admin.from("cases").select("id").eq("slug", slug).maybeSingle();
  if (!deal) return NextResponse.json({ error: "Unknown deal." }, { status: 404 });

  const path = attachmentPath(deal.id, body.type);
  const { data, error } = await admin.storage.from(CASE_FILES_BUCKET_NAME).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not create the upload URL." }, { status: 500 });

  return NextResponse.json({
    path: data.path,
    signedUrl: data.signedUrl,
    maxBytes: 25 * 1024 * 1024,
    contentType: "application/pdf",
  });
}
