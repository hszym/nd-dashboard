/** One file to attach to an email. */
export interface EmailAttachment {
  name: string;
  bytes: Uint8Array;
}

/** The intro email wording, shared by the share sheet and the .eml. */
export function introEmailContent(caseName: string, labels: string[]) {
  const what =
    labels.length === 0
      ? ""
      : labels.length === 1
        ? `Attached is the ${labels[0]}.`
        : `Attached are the ${labels.slice(0, -1).join(", ")} and the ${labels[labels.length - 1]}.`;
  const subject = caseName;
  const body = [
    "Hello,",
    "",
    "What do you think of this project?",
    ...(what ? ["", what] : []),
    "",
    "Best regards,",
  ].join("\n");
  return { subject, body };
}

/** File name safe on every OS, e.g. "Domino Nova - Deck.pdf". */
export function attachmentFileName(caseName: string, label: string): string {
  const base = `${caseName} - ${label}`.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return `${base}.pdf`;
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
 * Builds an unsent email (`.eml`) with the PDFs attached. The `X-Unsent: 1`
 * header makes Outlook open it as a draft ready to send.
 */
export function buildIntroEml(
  to: string,
  subject: string,
  body: string,
  attachments: EmailAttachment[]
): string {
  const enc = new TextEncoder();
  const boundary = `----=_intro_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

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
  ];
  for (const file of attachments) {
    const asciiName = file.name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
    lines.push(
      `--${boundary}`,
      `Content-Type: application/pdf; name="${asciiName}"`,
      `Content-Disposition: attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(toBase64(file.bytes))
    );
  }
  lines.push(`--${boundary}--`, "");
  return lines.join("\r\n");
}
