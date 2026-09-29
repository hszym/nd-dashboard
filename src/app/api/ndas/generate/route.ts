import { NextRequest, NextResponse } from "next/server";
import {
  ndaCounterpartyName,
  NDA_GENERATED_PDFS_BUCKET,
  ndaGeneratedPdfPath,
} from "@/lib/supabase";
import { buildFilledNdaDocx, BuildNdaDocxResult } from "@/lib/nda-generate";
import { convertDocxToPdf } from "@/lib/pdf-convert";
import { getRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Serves the cached PDF for an NDA, generating and caching it first if this
 * is the first time it's been requested (older NDA from before caching was
 * added, or creation-time generation failed).
 */
async function servePdf(supabase: SupabaseClient, id: string): Promise<NextResponse> {
  const { data: existing } = await supabase
    .from("ndas")
    .select("generated_pdf_url")
    .eq("id", id)
    .maybeSingle();

  if (existing?.generated_pdf_url) {
    return NextResponse.redirect(existing.generated_pdf_url);
  }

  const result = await buildFilledNdaDocx(supabase, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const baseName = `NDA - ${ndaCounterpartyName(result.nda)}`.replace(/[/\\]/g, "-");
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await convertDocxToPdf(result.buffer, `${baseName}.docx`);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Could not generate the PDF: ${err.message}`
            : "Could not generate the PDF.",
      },
      { status: 500 }
    );
  }

  const storagePath = ndaGeneratedPdfPath(id);
  const { error: uploadError } = await supabase.storage
    .from(NDA_GENERATED_PDFS_BUCKET)
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (!uploadError) {
    const { data: publicUrlData } = supabase.storage
      .from(NDA_GENERATED_PDFS_BUCKET)
      .getPublicUrl(storagePath);
    await supabase.from("ndas").update({ generated_pdf_url: publicUrlData.publicUrl }).eq("id", id);
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
    },
  });
}

function serveDocx(result: Extract<BuildNdaDocxResult, { ok: true }>): NextResponse {
  const baseName = `NDA - ${ndaCounterpartyName(result.nda)}`.replace(/[/\\]/g, "-");
  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${baseName}.docx"`,
    },
  });
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const requestedFormat = request.nextUrl.searchParams.get("format");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // The Word version is admin-only, regardless of what's requested — that's
  // enforced here, not just hidden in the UI. Admins can get either format;
  // everyone else always gets the PDF.
  const role = await getRole(supabase, user.id);

  if (role !== "admin") {
    return servePdf(supabase, id);
  }

  if (requestedFormat === "pdf") {
    return servePdf(supabase, id);
  }

  const result = await buildFilledNdaDocx(supabase, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return serveDocx(result);
}
