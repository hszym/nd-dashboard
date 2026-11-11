-- A document (the 2-pager, the Deck) can carry a PDF kept in the app, so the
-- intro email can attach it. The OneDrive link in file_url stays as it is.
alter table public.documents add column if not exists attachment_url text;

-- Public bucket (the email attaches the file straight from its URL),
-- 25 MB per file, PDFs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-files', 'case-files', true, 26214400, array['application/pdf'])
on conflict (id) do nothing;

create policy "public read case-files" on storage.objects
  for select to public using (bucket_id = 'case-files');

create policy "case_files_insert_admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'case-files' and public.is_admin());

create policy "case_files_update_admin" on storage.objects
  for update to authenticated using (bucket_id = 'case-files' and public.is_admin());

create policy "case_files_delete_admin" on storage.objects
  for delete to authenticated using (bucket_id = 'case-files' and public.is_admin());
