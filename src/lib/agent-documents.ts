// Shared constants for the agent API that publishes deal documents (server-side only).
// Kept separate from @/lib/supabase, which creates a browser client when imported.

export const AGENT_DOCUMENT_TYPES = [
  "Case Review",
  "2-pager",
  "Executive Summary",
  "Deck",
  "Term Sheet",
  "Intro Email",
] as const;
export type AgentDocumentType = (typeof AGENT_DOCUMENT_TYPES)[number];

export const AGENT_DOCUMENT_STATUSES = ["Missing", "In Progress", "Done"] as const;
export type AgentDocumentStatus = (typeof AGENT_DOCUMENT_STATUSES)[number];

/** Only these two PDFs are kept in the app (public bucket) so the intro email can attach them. */
export const AGENT_ATTACHMENT_TYPES: AgentDocumentType[] = ["2-pager", "Deck"];

export const CASE_FILES_BUCKET_NAME = "case-files";

export function isDocumentType(v: unknown): v is AgentDocumentType {
  return typeof v === "string" && (AGENT_DOCUMENT_TYPES as readonly string[]).includes(v);
}
export function isDocumentStatus(v: unknown): v is AgentDocumentStatus {
  return typeof v === "string" && (AGENT_DOCUMENT_STATUSES as readonly string[]).includes(v);
}

export function attachmentPath(caseId: string, type: AgentDocumentType): string {
  const slug = type.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${caseId}/${slug}-${Date.now()}.pdf`;
}

/** A https link only: these URLs are shown to the team and opened from the app. */
export function cleanHttpsUrl(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return null;
  if (s.length > 2000 || !/^https:\/\/[^\s]+$/i.test(s)) return undefined;
  return s;
}
