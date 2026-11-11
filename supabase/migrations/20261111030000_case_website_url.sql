-- A deal's own website, shown as a link under its logo on the deal page.
alter table public.cases add column if not exists website_url text;
