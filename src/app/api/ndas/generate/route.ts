import { NextRequest, NextResponse } from "next/server";
import { supabase, Nda, Case, ndaCounterpartyName } from "@/lib/supabase";
import { fillNdaTemplate, readDefaultCompanyTemplate } from "@/lib/nda-generate";

type NdaWithCase = Nda & {
  cases: Pick<
    Case,
    "name" | "nda_template_company_url" | "nda_template_individual_url"
  > | null;
};

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: nda, error } = await supabase
    .from("ndas")
    .select("*, cases(name, nda_template_company_url, nda_template_individual_url)")
    .eq("id", id)
    .maybeSingle<NdaWithCase>();

  if (error || !nda) {
    return NextResponse.json({ error: "NDA not found" }, { status: 404 });
  }

  const projectTemplateUrl =
    nda.counterparty_type === "company"
      ? nda.cases?.nda_template_company_url
      : nda.cases?.nda_template_individual_url;

  let templateBuffer: Buffer;
  if (projectTemplateUrl) {
    try {
      const res = await fetch(projectTemplateUrl);
      if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
      templateBuffer = Buffer.from(await res.arrayBuffer());
    } catch {
      return NextResponse.json(
        { error: "Could not fetch this project's uploaded NDA template." },
        { status: 500 }
      );
    }
  } else if (nda.counterparty_type === "company") {
    // No project-specific template — fall back to the shared default.
    templateBuffer = readDefaultCompanyTemplate();
  } else {
    return NextResponse.json(
      {
        error:
          "No individual-counterparty template uploaded for this project yet. Drop one in Project templates on the NDAs page.",
      },
      { status: 501 }
    );
  }

  let buffer: Buffer;
  try {
    buffer = fillNdaTemplate(templateBuffer, nda);
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
