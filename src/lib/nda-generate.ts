import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import path from "path";
import fs from "fs";
import { Nda, ndaCounterpartyName } from "@/lib/supabase";
import { formatLongDate } from "@/lib/utils";

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
    email: nda.email ?? "",
    signing_place: nda.signing_place,
    signing_date: formatLongDate(nda.signing_date),
  });

  return doc.getZip().generate({ type: "nodebuffer" });
}
