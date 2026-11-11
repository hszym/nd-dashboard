-- Open questions synced with the deal MD files in OneDrive, plus personal API tokens
-- so Claude (on a team member's PC) can sync without the service_role key.

-- 1. Questions: id used in the MD file (Q-001), priority, source document, last sync with the MD.
alter table public.case_questions
  add column if not exists ref text,
  add column if not exists priority text not null default 'normal'
    check (priority in ('normal', 'blocking')),
  add column if not exists source text,
  add column if not exists md_synced_at timestamptz;

create unique index if not exists case_questions_case_ref_key
  on public.case_questions (case_id, ref)
  where ref is not null;

-- 2. Personal API tokens. Only the SHA-256 hash is stored; the token is shown once on creation.
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists api_tokens_user_id_idx on public.api_tokens (user_id);

alter table public.api_tokens enable row level security;

-- Each member manages only their own tokens (the agent API reads them with the service role).
create policy "api_tokens_select_own" on public.api_tokens
  for select to authenticated using (user_id = auth.uid());

create policy "api_tokens_insert_own" on public.api_tokens
  for insert to authenticated with check (user_id = auth.uid());

create policy "api_tokens_update_own" on public.api_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "api_tokens_delete_own" on public.api_tokens
  for delete to authenticated using (user_id = auth.uid());
