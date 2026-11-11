-- Private single-use links an LP opens to fill in their own details.
-- Only admins touch this table directly; the public form goes through a server
-- route (service role) that is limited to the one request its token names.
create table if not exists public.lp_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'revoked')),
  data jsonb,
  nda_id uuid references public.ndas(id) on delete set null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  submitted_at timestamptz
);

create index if not exists lp_requests_case_id_idx on public.lp_requests (case_id);

alter table public.lp_requests enable row level security;

create policy "lp_requests_select_admin" on public.lp_requests
  for select to authenticated using (public.is_admin());

create policy "lp_requests_insert_admin" on public.lp_requests
  for insert to authenticated with check (public.is_admin());

create policy "lp_requests_update_admin" on public.lp_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lp_requests_delete_admin" on public.lp_requests
  for delete to authenticated using (public.is_admin());
