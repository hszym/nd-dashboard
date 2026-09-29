import { NextRequest, NextResponse } from "next/server";
import {
  ndaCounterpartyName,
  NDA_GENERATED_PDFS_BUCKET,
  ndaGeneratedPdfPath,
} from "@/lib/supabase";
import { buildFilledNdaDocx } from "@/lib/nda-generate";
import { convertDocxToPdf } from "@/lib/pdf-convert";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Renders and stores the non-admin PDF for an NDA, once, right after it's
 * created. Called from the New NDA form after the row is inserted. A failure
 * here (e.g. no template uploaded yet for an individual counterparty) is not
 * fatal to NDA creation — the download route falls back to generating and
 * caching it on first request if this step didn't produce one.
 */
export async function POST(request: NextRequest) {
  const { id } = await request.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
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

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage
    .from(NDA_GENERATED_PDFS_BUCKET)
    .getPublicUrl(storagePath);

  const { error: updateError } = await supabase
    .from("ndas")
    .update({ generated_pdf_url: publicUrlData.publicUrl })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: publicUrlData.publicUrl });
}
