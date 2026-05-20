create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'like' check (reaction_type in ('like')),
  created_at timestamptz not null default now(),
  unique(post_id, user_id, reaction_type)
);

create index if not exists post_reactions_post_idx
on public.post_reactions(post_id, created_at desc);

create index if not exists post_reactions_user_idx
on public.post_reactions(user_id, created_at desc);

alter table public.post_reactions enable row level security;

drop policy if exists "public post reactions are readable" on public.post_reactions;
create policy "public post reactions are readable"
on public.post_reactions for select
using (
  exists (
    select 1
    from public.posts
    where posts.id = post_reactions.post_id
      and posts.visibility = 'public'
      and posts.is_deleted = false
  )
);

drop policy if exists "users can insert their own post reactions" on public.post_reactions;
create policy "users can insert their own post reactions"
on public.post_reactions for insert
with check (auth.uid() = user_id);

drop policy if exists "users can delete their own post reactions" on public.post_reactions;
create policy "users can delete their own post reactions"
on public.post_reactions for delete
using (auth.uid() = user_id);

create or replace function public.toggle_post_like(target_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_reaction_id uuid;
  next_like_count integer;
  next_liked boolean;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1 from public.posts
    where id = target_post_id
      and visibility = 'public'
      and is_deleted = false
  ) then
    raise exception 'post not found';
  end if;

  select id into existing_reaction_id
  from public.post_reactions
  where post_id = target_post_id
    and user_id = current_user_id
    and reaction_type = 'like'
  limit 1;

  if existing_reaction_id is null then
    insert into public.post_reactions (post_id, user_id, reaction_type)
    values (target_post_id, current_user_id, 'like');

    update public.posts
    set like_count = like_count + 1
    where id = target_post_id
    returning like_count into next_like_count;

    next_liked := true;
  else
    delete from public.post_reactions
    where id = existing_reaction_id
      and user_id = current_user_id;

    update public.posts
    set like_count = greatest(like_count - 1, 0)
    where id = target_post_id
    returning like_count into next_like_count;

    next_liked := false;
  end if;

  return jsonb_build_object(
    'liked', next_liked,
    'like_count', next_like_count
  );
end;
$$;
