import { NextRequest, NextResponse } from "next/server";
import {
  readDefaultCompanyTemplate,
  readDefaultIndividualTemplate,
} from "@/lib/nda-generate";
import { getRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Downloads the blank (unfilled) NDA template a project uses: its own uploaded
 * template if it has one, otherwise the bundled default (company only).
 * Admin-only, like the Word version of a generated NDA.
 */
export async function GET(request: NextRequest) {
  const caseId = request.nextUrl.searchParams.get("caseId");
  const type = request.nextUrl.searchParams.get("type");
  if (!caseId || (type !== "company" && type !== "individual")) {
    return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if ((await getRole(supabase, user.id)) !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { data: project } = await supabase
    .from("cases")
    .select("name, nda_template_company_url, nda_template_individual_url")
    .eq("id", caseId)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const url =
    type === "company"
      ? project.nda_template_company_url
      : project.nda_template_individual_url;

  let buffer: Buffer;
  if (url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`status ${res.status}`);
      buffer = Buffer.from(await res.arrayBuffer());
    } catch {
      return NextResponse.json(
        { error: "Could not fetch this project's uploaded NDA template." },
        { status: 500 }
      );
    }
  } else {
    buffer =
      type === "company"
        ? readDefaultCompanyTemplate()
        : readDefaultIndividualTemplate();
  }

  const fileName = `NDA Template (${type}) - ${project.name ?? "project"}`.replace(
    /[/\\"]/g,
    "-"
  );
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": DOCX_TYPE,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}.docx`,
    },
  });
}
