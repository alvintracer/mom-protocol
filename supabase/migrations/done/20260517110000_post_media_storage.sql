insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "post media is publicly readable" on storage.objects;
create policy "post media is publicly readable"
on storage.objects for select
using (bucket_id = 'post-media');

drop policy if exists "users can upload own post media" on storage.objects;
create policy "users can upload own post media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can update own post media" on storage.objects;
create policy "users can update own post media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'post-media'
  and owner = auth.uid()
)
with check (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can delete own post media" on storage.objects;
create policy "users can delete own post media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'post-media'
  and owner = auth.uid()
);
