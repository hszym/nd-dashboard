import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import path from "path";
import fs from "fs";
import { supabase, Nda, Case, ndaCounterpartyName } from "@/lib/supabase";
import { formatLongDate } from "@/lib/utils";

type NdaWithCase = Nda & {
  cases: Pick<
    Case,
    "name" | "nda_template_company_url" | "nda_template_individual_url"
  > | null;
};

export type BuildNdaDocxResult =
  | { ok: true; buffer: Buffer; nda: NdaWithCase }
  | { ok: false; error: string; status: number };

/**
 * Loads an NDA row + its project, resolves the right template (project-specific
 * upload, or the bundled default for a company counterparty), and fills it.
 * Shared by the on-demand download route and the at-creation PDF generation step,
 * so both always produce byte-identical content for a given NDA.
 */
export async function buildFilledNdaDocx(ndaId: string): Promise<BuildNdaDocxResult> {
  const { data: nda, error } = await supabase
    .from("ndas")
    .select("*, cases(name, nda_template_company_url, nda_template_individual_url)")
    .eq("id", ndaId)
    .maybeSingle<NdaWithCase>();

  if (error || !nda) {
    return { ok: false, error: "NDA not found", status: 404 };
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
      return {
        ok: false,
        error: "Could not fetch this project's uploaded NDA template.",
        status: 500,
      };
    }
  } else if (nda.counterparty_type === "company") {
    templateBuffer = readDefaultCompanyTemplate();
  } else {
    return {
      ok: false,
      error:
        "No individual-counterparty template uploaded for this project yet. Drop one in Project templates on the NDAs page.",
      status: 501,
    };
  }

  try {
    const buffer = fillNdaTemplate(templateBuffer, nda);
    return { ok: true, buffer, nda };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not generate the NDA.",
      status: 500,
    };
  }
}

const DEFAULT_COMPANY_TEMPLATE_PATH = path.join(
  process.cwd(),
  "src/lib/templates/nda-company-template.docx"
);

/** The bundled default company template, used when a project hasn't uploaded its own. */
export function readDefaultCompanyTemplate(): Buffer {
  return fs.readFileSync(DEFAULT_COMPANY_TEMPLATE_PATH);
}

/**
 * Fills a given NDA template (as raw .docx bytes) with the NDA row's data
 * and returns the rendered .docx as a Buffer. The template can be either the
 * bundled default or a project-specific one uploaded to Supabase storage —
 * whichever tags it actually contains get filled in.
 */
export function fillNdaTemplate(templateBuffer: Buffer, nda: Nda): Buffer {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render({
    counterparty_name: ndaCounterpartyName(nda),
    first_name: nda.first_name ?? "",
    last_name: nda.last_name ?? "",
    company_name: nda.company_name ?? "",
    legal_form: nda.legal_form ?? "",
    jurisdiction: nda.jurisdiction ?? "",
    place_address: nda.place_address ?? "",
    registration_agency: nda.registration_agency ?? "",
    registration_number: nda.registration_number ?? "",
    tax_id: nda.tax_id ?? "",
    representative_name: nda.representative_name ?? "",
    representative_position: nda.representative_position ?? "",
    representative_name_2: nda.representative_name_2 ?? "",
    representative_position_2: nda.representative_position_2 ?? "",
    email: nda.email ?? "",
    signing_place: nda.signing_place,
    signing_date: formatLongDate(nda.signing_date),
  });

  return doc.getZip().generate({ type: "nodebuffer" });
}
