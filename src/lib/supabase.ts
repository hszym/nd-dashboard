import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

/**
 * Browser client — carries the signed-in user's session (via cookies, so
 * server code sees the same session), used from all "use client" components.
 * For Server Components / Route Handlers / Middleware, use the helpers in
 * @/lib/supabase-server instead — this one has no request to read cookies from.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export type Stage = "Under Review" | "Raising" | "Completed";

export type DocumentType =
  | "Case Review"
  | "2-pager"
  | "Executive Summary"
  | "Deck"
  | "Term Sheet"
  | "Intro Email";

export type DocumentStatus = "Missing" | "In Progress" | "Done";

export const DOCUMENT_TYPES: DocumentType[] = [
  "Case Review",
  "2-pager",
  "Executive Summary",
  "Deck",
  "Term Sheet",
  "Intro Email",
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
  dd_stage: DdStage;
  amount_target: number | null;
  amount_remaining: number | null;
  currency: string;
  deadline: string | null;
  claude_project_url: string | null;
  drive_folder_url: string | null;
  /** The deal's OneDrive folder; Claude Code works inside it (MD files hold the details). */
  onedrive_url: string | null;
  /** Intro email template for this deal (copied from its OneDrive intro-email.md). */
  intro_email_subject: string | null;
  intro_email_text: string | null;
  intro_email_html: string | null;
  /** The deal's own website, shown as a link under its logo. */
  website_url: string | null;
  brand_colors: BrandColor[];
  logo_url: string | null;
  notes: string | null;
  nda_template_company_url: string | null;
  nda_template_individual_url: string | null;
  created_at: string;
  updated_at: string;
}

/** A funding round of a deal (table `case_rounds`); every deal has at least one. */
export interface CaseRound {
  id: string;
  case_id: string;
  name: string;
  sort: number;
  status: "raising" | "closed";
  currency: string;
  amount_target: number | null;
  amount_remaining: number | null;
  deadline: string | null;
}

/** These documents exist once per round; the others (Deck, Executive Summary, Intro Email) are shared by the deal. */
export const ROUND_DOCUMENT_TYPES: DocumentType[] = ["Term Sheet", "2-pager", "Case Review"];

export const isRoundDocumentType = (t: DocumentType) => ROUND_DOCUMENT_TYPES.includes(t);

/** The round being worked on: the last one still raising, else the last one. */
export function currentRound(rounds: CaseRound[]): CaseRound | null {
  const sorted = [...rounds].sort((a, b) => a.sort - b.sort);
  return [...sorted].reverse().find((r) => r.status === "raising") ?? sorted[sorted.length - 1] ?? null;
}

export interface CurrencyTotal {
  currency: string;
  target: number;
  raised: number;
  remaining: number;
}

/** Cumulative objective of all rounds, one line per currency (two currencies are never added together). */
export function roundTotals(rounds: CaseRound[]): CurrencyTotal[] {
  const by = new Map<string, CurrencyTotal>();
  for (const r of rounds) {
    if (r.amount_target === null) continue;
    const remaining = r.amount_remaining ?? r.amount_target;
    const t = by.get(r.currency) ?? { currency: r.currency, target: 0, raised: 0, remaining: 0 };
    t.target += r.amount_target;
    t.remaining += remaining;
    t.raised += Math.max(r.amount_target - remaining, 0);
    by.set(r.currency, t);
  }
  return [...by.values()];
}

/** The documents that count for the deal right now: the shared ones plus the current round's. */
export function activeDocuments(documents: CaseDocument[], rounds: CaseRound[]): CaseDocument[] {
  const cur = currentRound(rounds)?.id ?? null;
  return documents.filter((d) => d.round_id == null || d.round_id === cur);
}

export interface CaseDocument {
  id: string;
  case_id: string;
  /** The round it belongs to (Term Sheet, 2-pager, Case Review); null for the shared documents. */
  round_id?: string | null;
  type: DocumentType;
  status: DocumentStatus;
  file_url: string | null;
  /** A PDF kept in the app (2-pager, Deck) so the intro email can attach it. */
  attachment_url: string | null;
  /** Private copy of the PDF kept in the app (opened through a signed link). */
  mirror_path: string | null;
  mirror_synced_at: string | null;
  mirror_source: string | null;
  /** Accounts that have reviewed the current version (cleared by the database when the document changes). */
  reviewer_ids?: string[];
  /** Who has to provide it (set through `assign_document`). */
  assignee_id?: string | null;
  due_date?: string | null;
  updated_at: string;
}

/** Documents whose PDF the intro email attaches. */
export const EMAIL_ATTACHMENT_TYPES: DocumentType[] = ["2-pager", "Deck"];

/** The documents that have a PDF ready to attach to the intro email. */
export function emailAttachments(documents: CaseDocument[]): CaseDocument[] {
  return documents.filter(
    (d) => EMAIL_ATTACHMENT_TYPES.includes(d.type) && d.attachment_url
  );
}

/**
 * A document counts as available as soon as it has a link. The Intro Email has
 * no file of its own: it is available once there is a PDF to attach to it. (The
 * old status column is kept in the database but no longer shown or used.)
 */
export function isDocumentReady(doc: CaseDocument, all: CaseDocument[]): boolean {
  if (doc.type === "Intro Email") return emailAttachments(all).length > 0;
  return Boolean(doc.file_url || doc.mirror_path);
}

/** A document stays "unreviewed" (red) until this many different people have reviewed it. */
export const REQUIRED_REVIEWS = 2;

/** Only a document that has a file or link can be reviewed (not a missing one, nor the Intro Email). */
export function needsReview(doc: CaseDocument): boolean {
  return (
    doc.type !== "Intro Email" &&
    !doc.id.startsWith("missing-") &&
    Boolean(doc.file_url || doc.mirror_path)
  );
}

export function isUnreviewed(doc: CaseDocument): boolean {
  return needsReview(doc) && (doc.reviewer_ids?.length ?? 0) < REQUIRED_REVIEWS;
}

/** Public bucket for the PDFs attached to emails (25 MB, PDF only). */
export const CASE_FILES_BUCKET = "case-files";
export const CASE_FILE_MAX_BYTES = 25 * 1024 * 1024;

/** Storage path for a document's email attachment; a fresh name per upload avoids stale caches. */
export function attachmentStoragePath(caseId: string, type: DocumentType): string {
  const slug = type.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${caseId}/${slug}-${Date.now()}.pdf`;
}
export type NdaCounterpartyType = "individual" | "company";

export type NdaStatus = "Draft" | "Sent" | "Signed";

/** One pipeline status per investor, from first contact to the outcome. */
export type LpStatus = "Contacted" | "NDA sent" | "NDA signed" | "Invested" | "Declined";
export const LP_STATUSES: LpStatus[] = ["Contacted", "NDA sent", "NDA signed", "Invested", "Declined"];

/** Where the deal stands on due diligence (not the same as its fundraising stage). */
export type DdStage = "Not started" | "In progress" | "Completed";
export const DD_STAGES: DdStage[] = ["Not started", "In progress", "Completed"];

export type Tier = 1 | 2 | 3;
export const TIERS: { value: Tier; label: string; description: string }[] = [
  {
    value: 1,
    label: "Tier 1 · Institutional",
    description:
      "Large sovereign wealth funds, big public pensions, top university endowments, major insurers. Very large cheques and strict due diligence; having one in the deal is a seal of approval that attracts others.",
  },
  {
    value: 2,
    label: "Tier 2 · Mid-size institutions",
    description:
      "Smaller pensions, regional institutions, funds of funds, large foundations. Solid and professional, but smaller cheques and less signalling power.",
  },
  {
    value: 3,
    label: "Tier 3 · Family offices & HNW",
    description:
      "Family offices, HNW individuals, smaller institutions. Faster and more flexible, but cheques are smaller and often more variable.",
  },
];

export function tierInfo(tier: Tier | null) {
  return TIERS.find((t) => t.value === tier) ?? null;
}

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
  /** Optional second counterparty signatory — most deals only need one. */
  representative_name_2: string | null;
  representative_position_2: string | null;
  email: string | null;
  signing_place: string;
  signing_date: string;
  /** The NDA's own status (Draft/Sent/Signed) — distinct from `lp_status`. */
  status: NdaStatus;
  /** Pipeline stage of the LP relationship. */
  lp_status: LpStatus;
  /** The salesperson in charge of this investor (an account marked "can sell"). */
  sales_id: string | null;
  /** LP classification, 1 = institutional. Null until filled. */
  tier: Tier | null;
  signed_file_url: string | null;
  /** PDF rendered from the filled template at creation time; served to non-admins. */
  generated_pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export type LpRequestStatus = "pending" | "submitted" | "revoked";

/** A private single-use link an LP opens to fill in their own details (`lp_requests`). */
export interface LpRequest {
  id: string;
  case_id: string;
  token: string;
  status: LpRequestStatus;
  data: unknown | null;
  nda_id: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  submitted_at: string | null;
}

export type QuestionStatus = "open" | "answered";

/** A shared open question on a deal (table `case_questions`). */
export type QuestionPriority = "normal" | "blocking";

export interface CaseQuestion {
  id: string;
  case_id: string;
  question: string;
  answer: string | null;
  status: QuestionStatus;
  /** Id used in the deal's 00_README.md (Q-001); null until Claude has written it into the file. */
  ref: string | null;
  priority: QuestionPriority;
  /** Document or review the question came from. */
  source: string | null;
  /**
   * When the MD file last matched this row. null = a change made in the dashboard
   * (new question, answer, reopen, priority) that Claude has not yet written into the file.
   */
  md_synced_at: string | null;
  created_by: string | null;
  created_at: string;
  answered_at: string | null;
  /** Who has to answer; null = nobody yet (anyone can take it). Not part of the MD file. */
  assignee_id: string | null;
  due_date: string | null;
}

export type InboxStatus = "to_review" | "reviewed";

export interface InboxFile {
  name: string;
  path: string;
  size: number;
  type: string;
}

/** Documents/notes dropped on a deal, waiting for an admin review (`case_inbox_items`). */
export interface CaseInboxItem {
  id: string;
  case_id: string;
  note: string | null;
  files: InboxFile[];
  status: InboxStatus;
  created_by: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/** Private bucket; one folder per deal (by slug), then one folder per submission. */
export const CASE_INBOX_BUCKET = "case-inbox";
export const CASE_INBOX_MAX_FILE_BYTES = 50 * 1024 * 1024;

export function inboxStoragePath(
  caseSlug: string,
  itemId: string,
  index: number,
  filename: string
): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
  return `${caseSlug}/${itemId}/${index}-${safe}`;
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

export const NDA_GENERATED_PDFS_BUCKET = "nda-generated-pdfs";

/** Storage path for the generated (non-admin) PDF for a given NDA row. */
export function ndaGeneratedPdfPath(ndaId: string): string {
  return `${ndaId}/nda.pdf`;
}

/** Public bucket for uploaded deal logos (5 MB, images only). */
export const CASE_LOGOS_BUCKET = "case-logos";
export const CASE_LOGO_MAX_BYTES = 5 * 1024 * 1024;

export const NDA_TEMPLATES_BUCKET = "nda-templates";

/** Storage path for a project's uploaded NDA template, by counterparty type. */
export function ndaTemplateStoragePath(
  caseId: string,
  counterpartyType: NdaCounterpartyType
): string {
  return `${caseId}/${counterpartyType}.docx`;
}
