import { Nda, ndaCounterpartyName } from "@/lib/supabase";

/** The one NDA email wording, shared by the share sheet, the .eml and the mailto fallback. */
export function ndaEmailContent(nda: Nda, caseName: string) {
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
  return { to: nda.email ?? "", subject, body };
}

/**
 * A `mailto:` link pre-filled with subject/body. It can't carry an attachment,
 * so it's only the last fallback when the PDF can't be attached automatically.
 */
export function ndaMailtoLink(nda: Nda, caseName: string): string {
  const { to, subject, body } = ndaEmailContent(nda, caseName);
  const params = new URLSearchParams({ subject, body });
  return `mailto:${to ? encodeURIComponent(to) : ""}?${params.toString()}`;
}

/** File name for the attached PDF, safe on every OS. */
export function ndaPdfFileName(nda: Nda): string {
  const base = `NDA - ${ndaCounterpartyName(nda)}`.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return `${base || "NDA"}.pdf`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Base64 wrapped at 76 characters per line, as MIME requires. */
function wrapBase64(b64: string): string {
  return b64.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

/**
 * Builds an unsent email (`.eml`) with the NDA PDF attached. The `X-Unsent: 1`
 * header makes Outlook open it as a draft ready to send; other mail apps may
 * show it as a message to forward.
 */
export function buildNdaEml(
  nda: Nda,
  caseName: string,
  pdf: Uint8Array,
  fileName: string
): string {
  const { to, subject, body } = ndaEmailContent(nda, caseName);
  const enc = new TextEncoder();
  const boundary = `----=_nda_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");

  const lines: string[] = [
    "X-Unsent: 1",
    ...(to ? [`To: ${to}`] : []),
    `Subject: =?UTF-8?B?${toBase64(enc.encode(subject))}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(toBase64(enc.encode(body))),
    `--${boundary}`,
    `Content-Type: application/pdf; name="${asciiName}"`,
    `Content-Disposition: attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(toBase64(pdf)),
    `--${boundary}--`,
    "",
  ];
  return lines.join("\r\n");
}
