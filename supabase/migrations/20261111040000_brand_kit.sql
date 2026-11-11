-- Brand Kit: logos become uploaded images, and a deal gets a single OneDrive
-- folder link (replacing the Claude project / Drive folder links in the UI).
-- The old claude_project_url / drive_folder_url columns are kept, just unused.
alter table public.cases add column if not exists onedrive_url text;

-- Public bucket (logos are shown to everyone), 5 MB per file, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-logos',
  'case-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do nothing;

create policy "public read case-logos" on storage.objects
  for select to public using (bucket_id = 'case-logos');

create policy "case_logos_insert_admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'case-logos' and public.is_admin());

create policy "case_logos_update_admin" on storage.objects
  for update to authenticated using (bucket_id = 'case-logos' and public.is_admin());

create policy "case_logos_delete_admin" on storage.objects
  for delete to authenticated using (bucket_id = 'case-logos' and public.is_admin());
