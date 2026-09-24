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
