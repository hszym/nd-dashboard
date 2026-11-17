// Shared constants for the agent API that publishes deal documents (server-side only).
// Kept separate from @/lib/supabase, which creates a browser client when imported.

import type { SupabaseClient } from "@supabase/supabase-js";

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

/** Private bucket holding one current PDF copy of each document (OneDrive stays the source). */
export const DEAL_DOCUMENTS_BUCKET_NAME = "deal-documents";

/** These documents exist once per funding round; the others are shared by the whole deal. */
export const ROUND_DOCUMENT_TYPES: AgentDocumentType[] = ["Term Sheet", "2-pager", "Case Review"];

export interface RoundRef {
  id: string;
  name: string;
  /** The deal's first round keeps the original file names, so nothing already stored moves. */
  first: boolean;
}

/**
 * The round an agent call is about: the one named (by name or id), else the current one
 * (the last still raising, otherwise the last). Returns null for an unknown name.
 */
export async function resolveRound(
  admin: SupabaseClient,
  caseId: string,
  requested: unknown
): Promise<RoundRef | null> {
  const { data } = await admin
    .from("case_rounds")
    .select("id, name, sort, status")
    .eq("case_id", caseId)
    .order("sort");
  const rounds = (data ?? []) as { id: string; name: string; sort: number; status: string }[];
  if (rounds.length === 0) return null;
  const pick =
    typeof requested === "string" && requested.trim()
      ? rounds.find((r) => r.id === requested.trim() || r.name.toLowerCase() === requested.trim().toLowerCase())
      : ([...rounds].reverse().find((r) => r.status === "raising") ?? rounds[rounds.length - 1]);
  return pick ? { id: pick.id, name: pick.name, first: pick.id === rounds[0].id } : null;
}

export function mirrorPath(caseId: string, type: AgentDocumentType, round?: RoundRef | null): string {
  const slug = type.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const suffix = round && !round.first && ROUND_DOCUMENT_TYPES.includes(type) ? `-${round.id.slice(0, 8)}` : "";
  return `${caseId}/${slug}${suffix}.pdf`;
}

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
