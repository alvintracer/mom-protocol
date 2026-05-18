-- Automatically roll up attention Energy from posts, comments, reposts, and reactions.

create or replace function public.apply_attention_energy_delta(
  target_cluster_id uuid,
  actor_user_id uuid,
  activity public.attention_activity_type,
  energy_delta numeric,
  post_delta integer default 0,
  comment_delta integer default 0,
  metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_cluster_id is null or energy_delta = 0 then
    return;
  end if;

  insert into public.attention_activity_ledger (
    cluster_id,
    user_id,
    activity_type,
    mom_energy,
    metadata
  )
  values (
    target_cluster_id,
    actor_user_id,
    activity,
    energy_delta,
    coalesce(metadata, '{}'::jsonb)
  );

  update public.attention_clusters
  set
    attention_score = greatest(attention_score + energy_delta, 0),
    post_count = greatest(post_count + post_delta, 0),
    comment_count = greatest(comment_count + comment_delta, 0),
    updated_at = now()
  where id = target_cluster_id;

  if actor_user_id is not null and energy_delta > 0 then
    update public.profiles
    set
      mom_energy = mom_energy + energy_delta,
      updated_at = now()
    where id = actor_user_id;
  end if;
end;
$$;

create or replace function public.handle_post_attention_energy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  energy_delta numeric;
  activity public.attention_activity_type;
begin
  if new.attention_cluster_id is null or new.is_deleted then
    return new;
  end if;

  if new.post_kind in ('repost', 'quote') then
    energy_delta := 1.5;
    activity := 'share';
  elsif new.post_kind = 'reply' then
    energy_delta := 1;
    activity := 'comment';
  else
    energy_delta := 2;
    activity := 'post';
  end if;

  perform public.apply_attention_energy_delta(
    new.attention_cluster_id,
    new.user_id,
    activity,
    energy_delta,
    1,
    0,
    jsonb_build_object('post_id', new.id, 'post_kind', new.post_kind)
  );

  return new;
end;
$$;

drop trigger if exists posts_attention_energy_after_insert on public.posts;
create trigger posts_attention_energy_after_insert
after insert on public.posts
for each row execute function public.handle_post_attention_energy();

create or replace function public.handle_source_ledger_attention_energy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.activity_type not in (
    'source_create',
    'source_import',
    'boost',
    'ad',
    'subscription',
    'evidence',
    'merge'
  ) then
    return new;
  end if;

  update public.attention_clusters
  set
    attention_score = greatest(attention_score + new.mom_energy, 0),
    updated_at = now()
  where id = new.cluster_id;

  if new.user_id is not null and new.mom_energy > 0 then
    update public.profiles
    set
      mom_energy = mom_energy + new.mom_energy,
      updated_at = now()
    where id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists attention_activity_source_energy_after_insert on public.attention_activity_ledger;
create trigger attention_activity_source_energy_after_insert
after insert on public.attention_activity_ledger
for each row execute function public.handle_source_ledger_attention_energy();

create or replace function public.handle_comment_attention_energy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_cluster_id uuid;
begin
  select posts.attention_cluster_id
  into target_cluster_id
  from public.posts
  where posts.id = new.post_id
    and posts.is_deleted = false;

  if target_cluster_id is null or new.is_deleted then
    return new;
  end if;

  perform public.apply_attention_energy_delta(
    target_cluster_id,
    new.user_id,
    'comment',
    1,
    0,
    1,
    jsonb_build_object('comment_id', new.id, 'post_id', new.post_id)
  );

  return new;
end;
$$;

drop trigger if exists comments_attention_energy_after_insert on public.comments;
create trigger comments_attention_energy_after_insert
after insert on public.comments
for each row execute function public.handle_comment_attention_energy();

create or replace function public.handle_post_reaction_attention_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_cluster_id uuid;
  actor_user_id uuid;
  score_delta numeric;
begin
  if tg_op = 'INSERT' then
    select posts.attention_cluster_id
    into target_cluster_id
    from public.posts
    where posts.id = new.post_id
      and posts.is_deleted = false;

    actor_user_id := new.user_id;
    score_delta := 0.05;
  elsif tg_op = 'DELETE' then
    select posts.attention_cluster_id
    into target_cluster_id
    from public.posts
    where posts.id = old.post_id
      and posts.is_deleted = false;

    actor_user_id := old.user_id;
    score_delta := -0.05;
  end if;

  if target_cluster_id is not null then
    update public.attention_clusters
    set
      attention_score = greatest(attention_score + score_delta, 0),
      updated_at = now()
    where id = target_cluster_id;

    if score_delta > 0 and actor_user_id is not null then
      update public.profiles
      set
        mom_energy = mom_energy + score_delta,
        updated_at = now()
      where id = actor_user_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists post_reactions_attention_score_after_insert on public.post_reactions;
create trigger post_reactions_attention_score_after_insert
after insert on public.post_reactions
for each row execute function public.handle_post_reaction_attention_score();

drop trigger if exists post_reactions_attention_score_after_delete on public.post_reactions;
create trigger post_reactions_attention_score_after_delete
after delete on public.post_reactions
for each row execute function public.handle_post_reaction_attention_score();

create or replace function public.recalculate_attention_energy(target_cluster_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  next_score numeric;
  next_post_count integer;
  next_comment_count integer;
begin
  select
    coalesce(sum(
      case
        when posts.post_kind in ('repost', 'quote') then 1.5
        when posts.post_kind = 'reply' then 1
        else 2
      end
    ), 0),
    count(*)
  into next_score, next_post_count
  from public.posts
  where attention_cluster_id = target_cluster_id
    and visibility = 'public'
    and is_deleted = false;

  select
    next_score + coalesce(count(*)::numeric, 0),
    coalesce(count(*)::integer, 0)
  into next_score, next_comment_count
  from public.comments
  join public.posts on posts.id = comments.post_id
  where posts.attention_cluster_id = target_cluster_id
    and posts.visibility = 'public'
    and posts.is_deleted = false
    and comments.is_deleted = false;

  select next_score + coalesce(count(*)::numeric * 0.05, 0)
  into next_score
  from public.post_reactions
  join public.posts on posts.id = post_reactions.post_id
  where posts.attention_cluster_id = target_cluster_id
    and posts.visibility = 'public'
    and posts.is_deleted = false;

  select next_score + coalesce(sum(mom_energy), 0)
  into next_score
  from public.attention_activity_ledger
  where cluster_id = target_cluster_id
    and activity_type in ('source_create', 'source_import', 'boost', 'ad', 'subscription', 'evidence', 'merge');

  update public.attention_clusters
  set
    attention_score = greatest(next_score, 0),
    post_count = next_post_count,
    comment_count = next_comment_count,
    updated_at = now()
  where id = target_cluster_id;

  return greatest(next_score, 0);
end;
$$;

grant execute on function public.recalculate_attention_energy(uuid) to authenticated;
