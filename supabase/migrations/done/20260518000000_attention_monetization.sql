-- momment. Tier 1 Attention Monetization:
-- 1) Page-view & dwell-time tracking → Attention Energy
-- 2) Donations → Attention Energy boost + donor rankings
-- 3) Contributor ranking materialized view
-- 4) Ad slot inventory (placeholder)
-- Run after: 20260517130000_attention_similarity_search.sql

-- ─────────────────────────────────────────────────────
-- 1. Extend attention_activity_type enum with new values
-- ─────────────────────────────────────────────────────

do $$
begin
  -- Add 'donation' if it doesn't exist
  begin
    alter type public.attention_activity_type add value if not exists 'donation';
  exception when others then null;
  end;

  -- Add 'page_view' if it doesn't exist
  begin
    alter type public.attention_activity_type add value if not exists 'page_view';
  exception when others then null;
  end;

  -- Add 'dwell' if it doesn't exist
  begin
    alter type public.attention_activity_type add value if not exists 'dwell';
  exception when others then null;
  end;
end $$;

-- ─────────────────────────────────────────────────────
-- 2. Page views & dwell time tracking
-- ─────────────────────────────────────────────────────

create table if not exists public.attention_page_views (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.attention_clusters(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  session_id text,                                -- anonymous session tracking
  entered_at timestamptz not null default now(),
  left_at timestamptz,                            -- set when user leaves
  dwell_seconds integer generated always as (
    case
      when left_at is not null
      then greatest(extract(epoch from (left_at - entered_at))::integer, 0)
      else null
    end
  ) stored,
  energy_granted numeric not null default 0,      -- how much attention energy was granted
  is_unique_today boolean not null default false,  -- first visit of the day
  created_at timestamptz not null default now()
);

create index if not exists attention_page_views_cluster_day_idx
on public.attention_page_views(cluster_id, (entered_at::date), user_id);

create index if not exists attention_page_views_user_idx
on public.attention_page_views(user_id, entered_at desc)
where user_id is not null;

alter table public.attention_page_views enable row level security;

-- Anyone can read aggregate stats; inserts via RPC only
drop policy if exists "page views are insertable by authenticated" on public.attention_page_views;
create policy "page views are insertable by authenticated"
on public.attention_page_views for insert
with check (auth.uid() = user_id or user_id is null);

drop policy if exists "page views are readable by owner" on public.attention_page_views;
create policy "page views are readable by owner"
on public.attention_page_views for select
using (user_id = auth.uid() or user_id is null);

-- RPC: Record a page visit and optionally grant energy
create or replace function public.record_attention_page_view(
  p_cluster_id uuid,
  p_session_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  is_unique boolean := false;
  view_energy numeric := 0;
  new_view_id uuid;
begin
  -- Check if this is a unique visit today
  if viewer_id is not null then
    select not exists(
      select 1 from public.attention_page_views
      where cluster_id = p_cluster_id
        and user_id = viewer_id
        and entered_at::date = now()::date
    ) into is_unique;
  else
    -- Anonymous: check by session
    if p_session_id is not null then
      select not exists(
        select 1 from public.attention_page_views
        where cluster_id = p_cluster_id
          and session_id = p_session_id
          and entered_at::date = now()::date
      ) into is_unique;
    end if;
  end if;

  -- Unique daily visit = +0.1 attention energy
  if is_unique then
    view_energy := 0.1;
  end if;

  insert into public.attention_page_views (cluster_id, user_id, session_id, is_unique_today, energy_granted)
  values (p_cluster_id, viewer_id, p_session_id, is_unique, view_energy)
  returning id into new_view_id;

  -- Apply energy delta to attention_clusters
  if view_energy > 0 then
    update public.attention_clusters
    set attention_score = attention_score + view_energy, updated_at = now()
    where id = p_cluster_id;
  end if;

  return new_view_id;
end;
$$;

grant execute on function public.record_attention_page_view(uuid, text) to authenticated, anon;

-- RPC: Record dwell time and grant energy (called when user leaves page)
create or replace function public.record_attention_dwell_time(
  p_view_id uuid,
  p_dwell_seconds integer
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cluster_id uuid;
  v_user_id uuid;
  dwell_energy numeric := 0;
  existing_left timestamptz;
begin
  select cluster_id, user_id, left_at
  into v_cluster_id, v_user_id, existing_left
  from public.attention_page_views
  where id = p_view_id;

  if v_cluster_id is null or existing_left is not null then
    return 0; -- already recorded or not found
  end if;

  -- Energy: +0.05 per 30 seconds, max 1.0 per session
  dwell_energy := least(floor(p_dwell_seconds / 30.0) * 0.05, 1.0);

  update public.attention_page_views
  set left_at = entered_at + (p_dwell_seconds || ' seconds')::interval,
      energy_granted = energy_granted + dwell_energy
  where id = p_view_id;

  -- Apply to cluster
  if dwell_energy > 0 then
    update public.attention_clusters
    set attention_score = attention_score + dwell_energy, updated_at = now()
    where id = v_cluster_id;

    -- Also grant user MOM Energy for engagement
    if v_user_id is not null then
      update public.profiles
      set mom_energy = mom_energy + dwell_energy, updated_at = now()
      where id = v_user_id;
    end if;
  end if;

  return dwell_energy;
end;
$$;

grant execute on function public.record_attention_dwell_time(uuid, integer) to authenticated, anon;


-- ─────────────────────────────────────────────────────
-- 3. Donations system
-- ─────────────────────────────────────────────────────

create table if not exists public.attention_donations (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.attention_clusters(id) on delete cascade,
  donor_id uuid not null references public.profiles(id) on delete cascade,
  amount_krw numeric not null check (amount_krw > 0),
  energy_granted numeric not null default 0,   -- attention energy granted from this donation
  donor_mom_energy_granted numeric not null default 0, -- MOM energy granted to donor
  donor_message text,
  is_anonymous boolean not null default false,
  payment_status text not null default 'mock' check (payment_status in ('mock', 'pending', 'paid', 'refunded')),
  created_at timestamptz not null default now()
);

create index if not exists attention_donations_cluster_idx
on public.attention_donations(cluster_id, created_at desc);

create index if not exists attention_donations_donor_idx
on public.attention_donations(donor_id, created_at desc);

alter table public.attention_donations enable row level security;

drop policy if exists "donations are publicly readable" on public.attention_donations;
create policy "donations are publicly readable"
on public.attention_donations for select
using (true);

-- Insert only via RPC (not direct)
drop policy if exists "donations insert via rpc" on public.attention_donations;
create policy "donations insert via rpc"
on public.attention_donations for insert
with check (false); -- blocked; use RPC

-- RPC: Submit a donation
-- MVP: uses mock payment (no real charge). Grants Attention Energy and donor MOM Energy.
create or replace function public.submit_attention_donation(
  p_cluster_id uuid,
  p_amount_krw numeric,
  p_message text default null,
  p_is_anonymous boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  donor uuid := auth.uid();
  att_energy numeric;
  donor_energy numeric := 2.0;
  new_donation_id uuid;
  new_attention_score numeric;
begin
  if donor is null then
    raise exception 'authentication_required';
  end if;

  if p_amount_krw < 1000 then
    raise exception 'minimum_donation_1000_krw';
  end if;

  -- 1,000원당 +10 Attention Energy
  att_energy := floor(p_amount_krw / 1000.0) * 10.0;

  -- Insert donation record (bypasses RLS via security definer)
  insert into public.attention_donations (
    cluster_id, donor_id, amount_krw,
    energy_granted, donor_mom_energy_granted,
    donor_message, is_anonymous, payment_status
  )
  values (
    p_cluster_id, donor, p_amount_krw,
    att_energy, donor_energy,
    p_message, p_is_anonymous, 'mock'
  )
  returning id into new_donation_id;

  -- Apply Attention Energy to cluster
  update public.attention_clusters
  set attention_score = attention_score + att_energy, updated_at = now()
  where id = p_cluster_id
  returning attention_score into new_attention_score;

  -- Grant donor MOM Energy
  update public.profiles
  set mom_energy = mom_energy + donor_energy, updated_at = now()
  where id = donor;

  -- Log in activity ledger
  insert into public.attention_activity_ledger (
    cluster_id, user_id, activity_type, revenue_amount, revenue_currency, mom_energy, metadata
  )
  values (
    p_cluster_id, donor, 'donation', p_amount_krw, 'KRW', att_energy,
    jsonb_build_object(
      'donation_id', new_donation_id,
      'amount_krw', p_amount_krw,
      'energy_granted', att_energy,
      'donor_energy', donor_energy,
      'is_anonymous', p_is_anonymous
    )
  );

  return jsonb_build_object(
    'donation_id', new_donation_id,
    'attention_energy_granted', att_energy,
    'donor_mom_energy_granted', donor_energy,
    'new_attention_score', new_attention_score
  );
end;
$$;

grant execute on function public.submit_attention_donation(uuid, numeric, text, boolean) to authenticated;


-- ─────────────────────────────────────────────────────
-- 4. Donor rankings view (per attention)
-- ─────────────────────────────────────────────────────

create or replace view public.attention_donor_rankings as
select
  d.cluster_id,
  d.donor_id as user_id,
  p.handle,
  p.display_name,
  p.avatar_url,
  count(*) as donation_count,
  sum(d.amount_krw) as total_donated_krw,
  sum(d.energy_granted) as total_energy_granted,
  max(d.created_at) as last_donated_at,
  row_number() over (
    partition by d.cluster_id
    order by sum(d.amount_krw) desc
  ) as rank
from public.attention_donations d
join public.profiles p on p.id = d.donor_id
where d.is_anonymous = false
  and d.payment_status in ('mock', 'paid')
group by d.cluster_id, d.donor_id, p.handle, p.display_name, p.avatar_url;


-- ─────────────────────────────────────────────────────
-- 5. Contributor rankings view (per attention)
-- ─────────────────────────────────────────────────────

create or replace view public.attention_contributor_rankings as
with user_energy as (
  select
    al.cluster_id,
    al.user_id,
    sum(al.mom_energy) as total_energy,
    count(*) filter (where al.activity_type = 'post') as post_count,
    count(*) filter (where al.activity_type = 'comment') as comment_count,
    count(*) filter (where al.activity_type = 'evidence') as evidence_count,
    count(*) filter (where al.activity_type = 'donation') as donation_count,
    count(*) filter (where al.activity_type = 'share') as share_count
  from public.attention_activity_ledger al
  where al.user_id is not null
  group by al.cluster_id, al.user_id
),
cluster_totals as (
  select cluster_id, sum(total_energy) as cluster_energy
  from user_energy
  group by cluster_id
),
builder_map as (
  select id as cluster_id, created_by as builder_id
  from public.attention_clusters
  where created_by is not null
)
select
  ue.cluster_id,
  ue.user_id,
  p.handle,
  p.display_name,
  p.avatar_url,
  ue.total_energy,
  case
    when ct.cluster_energy > 0
    then round((ue.total_energy / ct.cluster_energy) * 100, 2)
    else 0
  end as contribution_ratio,
  ue.post_count,
  ue.comment_count,
  ue.evidence_count,
  ue.donation_count,
  ue.share_count,
  case
    when bm.builder_id = ue.user_id then 'builder'
    when ue.evidence_count >= 2 then 'verifier'
    when ue.post_count >= 3 then 'analyst'
    when ue.comment_count >= 10 then 'debater'
    when ue.donation_count >= 1 then 'supporter'
    else 'contributor'
  end as role_badge,
  row_number() over (
    partition by ue.cluster_id
    order by ue.total_energy desc
  ) as rank
from user_energy ue
join public.profiles p on p.id = ue.user_id
join cluster_totals ct on ct.cluster_id = ue.cluster_id
left join builder_map bm on bm.cluster_id = ue.cluster_id;


-- ─────────────────────────────────────────────────────
-- 6. Ad slot inventory (placeholder for Tier 3)
-- ─────────────────────────────────────────────────────

create table if not exists public.attention_ad_slots (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.attention_clusters(id) on delete cascade,
  slot_type text not null default 'banner' check (slot_type in ('banner', 'native', 'inline', 'sponsor')),
  position text not null default 'top' check (position in ('top', 'feed_mid', 'bottom', 'sidebar')),
  min_attention_energy numeric not null default 500,
  is_active boolean not null default false,
  booking_id uuid,                                -- future: references ad_bookings
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attention_ad_slots_cluster_idx
on public.attention_ad_slots(cluster_id, is_active);

alter table public.attention_ad_slots enable row level security;

drop policy if exists "ad slots are publicly readable" on public.attention_ad_slots;
create policy "ad slots are publicly readable"
on public.attention_ad_slots for select
using (true);

-- Auto-activate ad slots when attention energy reaches threshold
create or replace function public.check_attention_ad_slot_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If attention_score crosses 500, auto-create a banner slot
  if new.attention_score >= 500 and old.attention_score < 500 then
    insert into public.attention_ad_slots (cluster_id, slot_type, position, min_attention_energy, is_active)
    values (new.id, 'banner', 'top', 500, true)
    on conflict do nothing;
  end if;

  -- If crosses 1000, add native ad slot
  if new.attention_score >= 1000 and old.attention_score < 1000 then
    insert into public.attention_ad_slots (cluster_id, slot_type, position, min_attention_energy, is_active)
    values (new.id, 'native', 'feed_mid', 1000, true)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists attention_ad_slot_auto_activate on public.attention_clusters;
create trigger attention_ad_slot_auto_activate
after update of attention_score on public.attention_clusters
for each row execute function public.check_attention_ad_slot_activation();


-- ─────────────────────────────────────────────────────
-- 7. Add view_count and unique_visitor_count to clusters
-- ─────────────────────────────────────────────────────

alter table public.attention_clusters
add column if not exists total_view_count integer not null default 0;

alter table public.attention_clusters
add column if not exists unique_visitor_count integer not null default 0;

alter table public.attention_clusters
add column if not exists total_donation_krw numeric not null default 0;

-- Update recalculate function to include page views and donations
create or replace function public.recalculate_attention_stats(target_cluster_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_views integer;
  v_unique integer;
  v_donations numeric;
begin
  select count(*), count(distinct coalesce(user_id::text, session_id))
  into v_views, v_unique
  from public.attention_page_views
  where cluster_id = target_cluster_id;

  select coalesce(sum(amount_krw), 0)
  into v_donations
  from public.attention_donations
  where cluster_id = target_cluster_id
    and payment_status in ('mock', 'paid');

  update public.attention_clusters
  set
    total_view_count = v_views,
    unique_visitor_count = v_unique,
    total_donation_krw = v_donations,
    updated_at = now()
  where id = target_cluster_id;
end;
$$;

grant execute on function public.recalculate_attention_stats(uuid) to authenticated;
