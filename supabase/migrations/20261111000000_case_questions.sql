-- Open questions per deal. Apply in the Supabase project (SQL editor or migration).
create table if not exists public.case_questions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  question text not null,
  answer text,
  status text not null default 'open' check (status in ('open', 'answered')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create index if not exists case_questions_case_id_idx on public.case_questions (case_id);

alter table public.case_questions enable row level security;

create policy "case_questions_select" on public.case_questions
  for select to authenticated using (true);

create policy "case_questions_insert" on public.case_questions
  for insert to authenticated with check (true);

create policy "case_questions_update" on public.case_questions
  for update to authenticated using (true) with check (true);

create policy "case_questions_delete_admin" on public.case_questions
  for delete to authenticated using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
