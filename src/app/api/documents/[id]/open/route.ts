import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { DEAL_DOCUMENTS_BUCKET_NAME } from "@/lib/agent-documents";

// Opens the Supabase copy of a document: any signed-in member gets a short-lived signed link.
// Runs as the caller (RLS), so signed-out requests find nothing.

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const supabase = await createSupabaseServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { data: doc } = await supabase.from("documents").select("mirror_path").eq("id", id).maybeSingle();
  if (!doc?.mirror_path) return NextResponse.json({ error: "No copy of this document yet." }, { status: 404 });

  const { data, error } = await supabase.storage
    .from(DEAL_DOCUMENTS_BUCKET_NAME)
    .createSignedUrl(doc.mirror_path, 60 * 60);
  if (error || !data) return NextResponse.json({ error: "Could not open the document." }, { status: 500 });

  return NextResponse.redirect(data.signedUrl, 302);
}
