import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import path from "path";
import fs from "fs";
import { Nda } from "@/lib/supabase";
import { formatLongDate } from "@/lib/utils";

const COMPANY_TEMPLATE_PATH = path.join(
  process.cwd(),
  "src/lib/templates/nda-company-template.docx"
);

/**
 * Fills the company-counterparty NDA template with the given NDA row's data
 * and returns the rendered .docx as a Buffer.
 *
 * Only supports `counterparty_type === "company"` — there is no
 * individual-counterparty template yet (see handoff notes / open items).
 */
export function generateCompanyNda(nda: Nda): Buffer {
  if (nda.counterparty_type !== "company") {
    throw new Error(
      "generateCompanyNda() only supports company counterparties."
    );
  }

  const content = fs.readFileSync(COMPANY_TEMPLATE_PATH, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render({
    counterparty_name: nda.company_name ?? "",
    legal_form: nda.legal_form ?? "",
    jurisdiction: nda.jurisdiction ?? "",
    place_address: nda.place_address ?? "",
    registration_agency: nda.registration_agency ?? "",
    registration_number: nda.registration_number ?? "",
    tax_id: nda.tax_id ?? "",
    representative_name: nda.representative_name ?? "",
    representative_position: nda.representative_position ?? "",
    signing_place: nda.signing_place,
    signing_date: formatLongDate(nda.signing_date),
  });

  return doc.getZip().generate({ type: "nodebuffer" });
}
