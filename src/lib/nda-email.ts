import { Nda, ndaCounterpartyName } from "@/lib/supabase";

/**
 * Builds a `mailto:` link pre-filled with a subject/body for sending the NDA
 * to its counterparty. The generated .docx itself still has to be attached
 * manually — a mailto link can't carry an attachment.
 */
export function ndaMailtoLink(nda: Nda, caseName: string): string {
  const name = ndaCounterpartyName(nda);
  const subject = `NDA — ${caseName}`;
  const body = [
    `Dear ${name},`,
    "",
    `Please find attached the Non-Disclosure Agreement for ${caseName}.`,
    "",
    "Could you please sign and return it at your earliest convenience?",
    "",
    "Best regards,",
  ].join("\n");

  const params = new URLSearchParams({ subject, body });
  const to = nda.email ? encodeURIComponent(nda.email) : "";
  return `mailto:${to}?${params.toString()}`;
}
