-- Allow attention creators to delete their own attention clusters
drop policy if exists "users can delete own attention clusters" on public.attention_clusters;
create policy "users can delete own attention clusters"
on public.attention_clusters for delete
using (auth.uid() = created_by);
