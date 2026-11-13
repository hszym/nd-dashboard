-- A copy of each deal's PDFs lives in Supabase (OneDrive stays the source).
-- The bucket is private: internal documents (Case Review, Executive Summary)
-- are read through short-lived signed URLs by signed-in users only.
alter table public.documents
  add column if not exists mirror_path text,
  add column if not exists mirror_hash text,
  add column if not exists mirror_source text,
  add column if not exists mirror_synced_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deal-documents', 'deal-documents', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

-- Any signed-in team member can read; writes go through the server (service role) only.
create policy "deal_documents_read_authenticated" on storage.objects
  for select to authenticated using (bucket_id = 'deal-documents');
