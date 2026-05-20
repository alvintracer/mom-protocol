create or replace function public.create_repost(
  target_post_id uuid,
  quote_body text default null,
  quote_language public.supported_language default 'ko'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  source_post public.posts%rowtype;
  new_post_id uuid;
  normalized_body text := nullif(btrim(coalesce(quote_body, '')), '');
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select * into source_post
  from public.posts
  where id = target_post_id
    and visibility = 'public'
    and is_deleted = false;

  if source_post.id is null then
    raise exception 'post not found';
  end if;

  insert into public.posts (
    user_id,
    event_id,
    attention_cluster_id,
    repost_of_post_id,
    post_kind,
    type,
    visibility,
    original_language,
    original_body,
    translation_status
  )
  values (
    current_user_id,
    source_post.event_id,
    source_post.attention_cluster_id,
    source_post.id,
    case when normalized_body is null then 'repost' else 'quote' end,
    source_post.type,
    'public',
    quote_language,
    coalesce(normalized_body, ''),
    case when normalized_body is null then 'translated'::public.translation_status else 'pending'::public.translation_status end
  )
  returning id into new_post_id;

  update public.posts
  set share_count = share_count + 1
  where id = source_post.id;

  return new_post_id;
end;
$$;
