/** One file to attach to an email. */
export interface EmailAttachment {
  name: string;
  bytes: Uint8Array;
}

/** A deal's own intro email template; every part is optional. */
export interface IntroEmailTemplate {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
}

export interface IntroEmailContent {
  subject: string;
  /** Plain text: used by the share sheet and as the text part of the .eml. */
  body: string;
  /** Only when the deal's template has an HTML version; added to the .eml. */
  html: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "the 2-pager and the deck": the attached documents, as a phrase. */
function attachmentsPhrase(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return `the ${labels[0]}`;
  return `the ${labels.slice(0, -1).join(", the ")} and the ${labels[labels.length - 1]}`;
}

/**
 * The intro email wording. A deal's template wins part by part; any part it
 * leaves empty falls back to the default. In a template, `{project}` becomes
 * the deal name and `{attachments}` becomes e.g. "the 2-pager and the deck".
 */
export function introEmailContent(
  caseName: string,
  labels: string[],
  template?: IntroEmailTemplate | null
): IntroEmailContent {
  const phrase = attachmentsPhrase(labels);
  const fill = (s: string, escape: (v: string) => string = (v) => v) =>
    s
      .replace(/\{project\}/gi, escape(caseName))
      .replace(/\{attachments\}/gi, escape(phrase || "the documents"));

  const subject = template?.subject?.trim()
    ? fill(template.subject.trim())
    : caseName;

  const body = template?.text?.trim()
    ? fill(template.text.trim())
    : [
        "Hello,",
        "",
        "What do you think of this project?",
        ...(phrase ? ["", `Attached ${labels.length === 1 ? "is" : "are"} ${phrase}.`] : []),
        "",
        "Best regards,",
      ].join("\n");

  const html = template?.html?.trim() ? fill(template.html.trim(), escapeHtml) : null;

  return { subject, body, html };
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
 * header makes Outlook open it as a draft ready to send. With an HTML version
 * the body is sent as plain text + HTML, and the mail app shows the HTML.
 */
export function buildIntroEml(
  to: string,
  subject: string,
  body: string,
  attachments: EmailAttachment[],
  html?: string | null
): string {
  const enc = new TextEncoder();
  const rand = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const mixed = `----=_intro_${rand}`;
  const alt = `----=_alt_${rand}`;

  const textPart = (): string[] => [
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(toBase64(enc.encode(body))),
  ];

  const lines: string[] = [
    "X-Unsent: 1",
    ...(to ? [`To: ${to}`] : []),
    `Subject: =?UTF-8?B?${toBase64(enc.encode(subject))}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    "",
    `--${mixed}`,
  ];

  if (html) {
    lines.push(
      `Content-Type: multipart/alternative; boundary="${alt}"`,
      "",
      `--${alt}`,
      ...textPart(),
      `--${alt}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(toBase64(enc.encode(html))),
      `--${alt}--`
    );
  } else {
    lines.push(...textPart());
  }

  for (const file of attachments) {
    const asciiName = file.name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
    lines.push(
      `--${mixed}`,
      `Content-Type: application/pdf; name="${asciiName}"`,
      `Content-Disposition: attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(toBase64(file.bytes))
    );
  }
  lines.push(`--${mixed}--`, "");
  return lines.join("\r\n");
}
