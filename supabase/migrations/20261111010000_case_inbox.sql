-- Documents/notes dropped on a deal, waiting for an admin review.
-- Files live in a private storage bucket, one folder per deal (slug) then per submission.
create table if not exists public.case_inbox_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  note text,
  files jsonb not null default '[]'::jsonb,
  status text not null default 'to_review' check (status in ('to_review', 'reviewed')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint case_inbox_has_content check (
    note is not null or jsonb_array_length(files) > 0
  )
);

create index if not exists case_inbox_items_case_id_idx on public.case_inbox_items (case_id);

alter table public.case_inbox_items enable row level security;

-- Anyone signed in can submit; they can see their own submissions, admins see all.
create policy "case_inbox_insert" on public.case_inbox_items
  for insert to authenticated with check (created_by = auth.uid());

create policy "case_inbox_select" on public.case_inbox_items
  for select to authenticated using (public.is_admin() or created_by = auth.uid());

create policy "case_inbox_update_admin" on public.case_inbox_items
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "case_inbox_delete_admin" on public.case_inbox_items
  for delete to authenticated using (public.is_admin());

-- Private bucket, 50 MB per file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('case-inbox', 'case-inbox', false, 52428800)
on conflict (id) do nothing;

create policy "case_inbox_files_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'case-inbox');

create policy "case_inbox_files_select_admin" on storage.objects
  for select to authenticated using (bucket_id = 'case-inbox' and public.is_admin());

-- Uploaders may remove their own files (rollback of a failed submission); admins any.
create policy "case_inbox_files_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'case-inbox'
    and (public.is_admin() or owner_id = auth.uid()::text)
  );
