-- Allow users to read their own posts even if they are deleted or private
create policy "users can read their own posts"
on public.posts for select
using (auth.uid() = user_id);

-- Also for comments
create policy "users can read their own comments"
on public.comments for select
using (auth.uid() = user_id);
