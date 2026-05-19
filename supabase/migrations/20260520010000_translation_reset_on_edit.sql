-- Auto-reset translation_status to 'pending' when content is edited.
-- This ensures edited posts/comments are re-queued for the next batch translation run.

-- 1. Posts: reset on body or title change
create or replace function public.reset_post_translation_on_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.original_body is distinct from old.original_body
    or new.original_title is distinct from old.original_title
  ) then
    new.translation_status := 'pending';

    -- Delete stale translations so fresh ones are generated
    delete from public.post_translations
    where post_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists posts_reset_translation_on_edit on public.posts;
create trigger posts_reset_translation_on_edit
before update on public.posts
for each row execute function public.reset_post_translation_on_edit();

-- 2. Comments: reset on body change
create or replace function public.reset_comment_translation_on_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.original_body is distinct from old.original_body then
    new.translation_status := 'pending';

    delete from public.comment_translations
    where comment_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_reset_translation_on_edit on public.comments;
create trigger comments_reset_translation_on_edit
before update on public.comments
for each row execute function public.reset_comment_translation_on_edit();

comment on function public.reset_post_translation_on_edit() is
'Trigger: resets translation_status to pending and deletes stale translations when post body/title is edited.';

comment on function public.reset_comment_translation_on_edit() is
'Trigger: resets translation_status to pending and deletes stale translations when comment body is edited.';
