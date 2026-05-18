-- Fix: post_original_versions and comment_original_versions trigger functions
-- need SECURITY DEFINER to bypass RLS when inserting from a trigger context.
-- Without this, authenticated users get RLS violation errors when creating posts/comments
-- because the trigger inserts into the *_original_versions tables which have no INSERT policy.

create or replace function public.seed_post_original_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.post_original_versions (
    post_id,
    version,
    original_language,
    original_title,
    original_body,
    original_hash,
    created_by
  )
  values (
    new.id,
    1,
    new.original_language,
    new.original_title,
    new.original_body,
    new.original_hash,
    new.user_id
  )
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.seed_comment_original_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.comment_original_versions (
    comment_id,
    version,
    original_language,
    original_body,
    original_hash,
    created_by
  )
  values (
    new.id,
    1,
    new.original_language,
    new.original_body,
    new.original_hash,
    new.user_id
  )
  on conflict do nothing;

  return new;
end;
$$;
