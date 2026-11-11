-- A deal's own intro email template, copied here from its OneDrive
-- documents/intro-email.md. The plain-text body is used everywhere (share
-- sheet, .eml); the optional HTML body is added to the .eml for desktop Outlook.
-- Placeholders: {project} and {attachments}. Empty parts fall back to the default wording.
alter table public.cases
  add column if not exists intro_email_subject text,
  add column if not exists intro_email_text text,
  add column if not exists intro_email_html text;
