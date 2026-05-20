-- User-to-user follow relationships for the social feed.
-- Following a user makes their posts appear in your "Following" feed tab.

create table if not exists public.user_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists user_follows_follower_idx
on public.user_follows(follower_id, created_at desc);

create index if not exists user_follows_following_idx
on public.user_follows(following_id, created_at desc);

alter table public.user_follows enable row level security;

drop policy if exists "user follows are publicly readable" on public.user_follows;
create policy "user follows are publicly readable"
on public.user_follows for select
using (true);

drop policy if exists "users can follow others" on public.user_follows;
create policy "users can follow others"
on public.user_follows for insert
with check (auth.uid() = follower_id);

drop policy if exists "users can unfollow others" on public.user_follows;
create policy "users can unfollow others"
on public.user_follows for delete
using (auth.uid() = follower_id);

-- Add follower/following counts to profiles
alter table public.profiles
  add column if not exists follower_count integer not null default 0,
  add column if not exists following_count integer not null default 0;

-- Toggle follow RPC — returns { followed, follower_count, following_count }
create or replace function public.toggle_user_follow(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_follow_id uuid;
  next_followed boolean;
  next_follower_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if current_user_id = target_user_id then
    raise exception 'cannot follow yourself';
  end if;

  if not exists (
    select 1 from public.profiles where id = target_user_id
  ) then
    raise exception 'user not found';
  end if;

  select id into existing_follow_id
  from public.user_follows
  where follower_id = current_user_id
    and following_id = target_user_id
  limit 1;

  if existing_follow_id is null then
    insert into public.user_follows (follower_id, following_id)
    values (current_user_id, target_user_id);
    next_followed := true;
  else
    delete from public.user_follows
    where id = existing_follow_id
      and follower_id = current_user_id;
    next_followed := false;
  end if;

  -- Update follower count for target user
  select count(*)::integer into next_follower_count
  from public.user_follows
  where following_id = target_user_id;

  update public.profiles
  set follower_count = next_follower_count
  where id = target_user_id;

  -- Update following count for current user
  update public.profiles
  set following_count = (
    select count(*)::integer
    from public.user_follows
    where follower_id = current_user_id
  )
  where id = current_user_id;

  return jsonb_build_object(
    'followed', next_followed,
    'follower_count', next_follower_count
  );
end;
$$;
