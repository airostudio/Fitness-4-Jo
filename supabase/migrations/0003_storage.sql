-- JoStrong 0003: private storage for optional progress photographs.
-- Photos are OFF by default in the app. Objects live under "<user_id>/…" and only that user can touch them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal-photos', 'journal-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880;

create policy "own photos read" on storage.objects for select to authenticated
  using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own photos update" on storage.objects for update to authenticated
  using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
