import { NextRequest, NextResponse } from "next/server";
import { supabase, Nda, ndaCounterpartyName } from "@/lib/supabase";
import { generateCompanyNda } from "@/lib/nda-generate";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: nda, error } = await supabase
    .from("ndas")
    .select("*")
    .eq("id", id)
    .maybeSingle<Nda>();

  if (error || !nda) {
    return NextResponse.json({ error: "NDA not found" }, { status: 404 });
  }

  if (nda.counterparty_type !== "company") {
    return NextResponse.json(
      {
        error:
          "No individual-counterparty template yet — generation is only available for company counterparties.",
      },
      { status: 501 }
    );
  }

  let buffer: Buffer;
  try {
    buffer = generateCompanyNda(nda);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate the NDA." },
      { status: 500 }
    );
  }

  const filename = `NDA - ${ndaCounterpartyName(nda)}.docx`.replace(/[/\\]/g, "-");

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
