create table if not exists public.attention_memberships (
  id uuid primary key default gen_random_uuid(),
  attention_cluster_id uuid not null references public.attention_clusters(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator', 'creator')),
  notification_level text not null default 'normal' check (notification_level in ('off', 'normal', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(attention_cluster_id, user_id)
);

drop trigger if exists attention_memberships_set_updated_at on public.attention_memberships;
create trigger attention_memberships_set_updated_at
before update on public.attention_memberships
for each row execute function public.set_updated_at();

create index if not exists attention_memberships_user_idx
on public.attention_memberships(user_id, created_at desc);

create index if not exists attention_memberships_attention_idx
on public.attention_memberships(attention_cluster_id, created_at desc);

alter table public.attention_memberships enable row level security;

drop policy if exists "attention memberships are publicly readable" on public.attention_memberships;
create policy "attention memberships are publicly readable"
on public.attention_memberships for select
using (true);

drop policy if exists "users can join attentions" on public.attention_memberships;
create policy "users can join attentions"
on public.attention_memberships for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update their attention memberships" on public.attention_memberships;
create policy "users can update their attention memberships"
on public.attention_memberships for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can leave attentions" on public.attention_memberships;
create policy "users can leave attentions"
on public.attention_memberships for delete
using (auth.uid() = user_id);

create or replace function public.toggle_attention_membership(target_attention_cluster_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_membership_id uuid;
  next_joined boolean;
  next_member_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1 from public.attention_clusters
    where id = target_attention_cluster_id
      and status = 'active'
  ) then
    raise exception 'attention not found';
  end if;

  select id into existing_membership_id
  from public.attention_memberships
  where attention_cluster_id = target_attention_cluster_id
    and user_id = current_user_id
  limit 1;

  if existing_membership_id is null then
    insert into public.attention_memberships (attention_cluster_id, user_id)
    values (target_attention_cluster_id, current_user_id);
    next_joined := true;
  else
    delete from public.attention_memberships
    where id = existing_membership_id
      and user_id = current_user_id;
    next_joined := false;
  end if;

  select count(*)::integer into next_member_count
  from public.attention_memberships
  where attention_cluster_id = target_attention_cluster_id;

  return jsonb_build_object(
    'joined', next_joined,
    'member_count', next_member_count
  );
end;
$$;
