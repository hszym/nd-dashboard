import { NextRequest, NextResponse } from "next/server";
import {
  ndaCounterpartyName,
  NDA_GENERATED_PDFS_BUCKET,
  ndaGeneratedPdfPath,
} from "@/lib/supabase";
import { buildFilledNdaDocx } from "@/lib/nda-generate";
import { convertDocxToPdf } from "@/lib/pdf-convert";
import { getRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // The Word version is admin-only; everyone else gets a PDF, regardless of
  // what's requested — this is enforced here, not just hidden in the UI.
  const role = await getRole(supabase, user.id);

  if (role !== "admin") {
    // Normally already generated and cached at creation time — just redirect
    // to the stored copy so this is a fast, no-conversion request.
    const { data: existing } = await supabase
      .from("ndas")
      .select("generated_pdf_url")
      .eq("id", id)
      .maybeSingle();

    if (existing?.generated_pdf_url) {
      return NextResponse.redirect(existing.generated_pdf_url);
    }

    // No cached PDF yet (older NDA from before this feature, or creation-time
    // generation failed) — generate it now and cache it for next time.
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
      await supabase
        .from("ndas")
        .update({ generated_pdf_url: publicUrlData.publicUrl })
        .eq("id", id);
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  }

  // Admin: always the live docx, filled fresh from the current template.
  const result = await buildFilledNdaDocx(supabase, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
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
