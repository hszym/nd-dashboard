import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Stage = "Under Review" | "Raising" | "Completed";

export type DocumentType =
  | "Case Review"
  | "2-pager"
  | "Executive Summary"
  | "Deck"
  | "Term Sheet"
  | "Intro Email"
  | "Follow-up Email";

export type DocumentStatus = "Missing" | "In Progress" | "Done";

export const DOCUMENT_TYPES: DocumentType[] = [
  "Case Review",
  "2-pager",
  "Executive Summary",
  "Deck",
  "Term Sheet",
  "Intro Email",
  "Follow-up Email",
];

export interface BrandColor {
  label: string;
  hex: string;
}

export const COMMON_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "AED"];

export interface Case {
  id: string;
  slug: string;
  name: string;
  sector: string | null;
  sponsor: string | null;
  stage: Stage;
  amount_target: number | null;
  amount_remaining: number | null;
  currency: string;
  deadline: string | null;
  claude_project_url: string | null;
  drive_folder_url: string | null;
  brand_colors: BrandColor[];
  logo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseDocument {
  id: string;
  case_id: string;
  type: DocumentType;
  status: DocumentStatus;
  file_url: string | null;
  updated_at: string;
}

export const EMAIL_DOCUMENT_TYPES: DocumentType[] = [
  "Intro Email",
  "Follow-up Email",
];

export function isEmailDocumentType(type: DocumentType): boolean {
  return EMAIL_DOCUMENT_TYPES.includes(type);
}

export const EMAIL_FILES_BUCKET = "case-emails";

/** Storage path for the uploaded .msg/.eml file for a given case + document type. */
export function emailStoragePath(
  caseId: string,
  type: DocumentType,
  extension: string
): string {
  const slug = type.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${caseId}/${slug}.${extension}`;
}

export type NdaCounterpartyType = "individual" | "company";

export type NdaStatus = "Draft" | "Sent" | "Signed";

export interface Nda {
  id: string;
  case_id: string;
  counterparty_type: NdaCounterpartyType;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  legal_form: string | null;
  jurisdiction: string | null;
  place_address: string | null;
  registration_agency: string | null;
  registration_number: string | null;
  tax_id: string | null;
  representative_name: string | null;
  representative_position: string | null;
  email: string | null;
  signing_place: string;
  signing_date: string;
  status: NdaStatus;
  signed_file_url: string | null;
  created_at: string;
  updated_at: string;
}

export const NDA_SIGNED_FILES_BUCKET = "nda-files";

/** Storage path for the uploaded signed NDA file for a given NDA row. */
export function ndaSignedFilePath(ndaId: string, extension: string): string {
  return `${ndaId}/signed.${extension}`;
}

/** Display name for the counterparty on an NDA row, whichever type it is. */
export function ndaCounterpartyName(nda: Nda): string {
  if (nda.counterparty_type === "individual") {
    return [nda.first_name, nda.last_name].filter(Boolean).join(" ") || "—";
  }
  return nda.company_name || "—";
}
