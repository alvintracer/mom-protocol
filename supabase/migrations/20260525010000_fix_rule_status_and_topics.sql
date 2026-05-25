-- Fix: create_native_attention should set attention_rules.status = 'active' (not 'draft')
-- so that client-side RLS policy allows reading outcomes.
-- Also add topics param for user-created topics.

create or replace function public.create_native_attention(
  title text,
  description text default null,
  category text default null,
  resolution_criteria text default null,
  ends_at timestamptz default null,
  original_language public.supported_language default 'ko',
  merge_target_cluster_id uuid default null,
  supported_outcomes text[] default array['yes', 'no'],
  topic_slugs text[] default array[]::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  new_event_id uuid;
  target_cluster_id uuid;
  new_source_id uuid;
  clean_title text;
  generated_slug text;
  clean_outcomes text[];
  topic_slug text;
  topic_id_val uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  clean_title := nullif(trim(title), '');
  if clean_title is null then
    raise exception 'title_required';
  end if;

  select coalesce(array_agg(distinct nullif(btrim(value), '')), array['yes', 'no'])
  into clean_outcomes
  from unnest(coalesce(supported_outcomes, array['yes', 'no'])) as value;

  clean_outcomes := array_remove(clean_outcomes, null);
  if array_length(clean_outcomes, 1) is null then
    clean_outcomes := array['yes', 'no'];
  end if;

  generated_slug := public.slugify_attention(clean_title) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.events (
    slug,
    title,
    description,
    category,
    source_platform,
    original_language,
    status,
    resolution,
    ends_at,
    created_by
  )
  values (
    generated_slug,
    clean_title,
    description,
    category,
    'momment.',
    original_language,
    'draft',
    resolution_criteria,
    ends_at,
    current_user_id
  )
  returning id into new_event_id;

  if merge_target_cluster_id is null then
    insert into public.attention_clusters (
      canonical_event_id,
      slug,
      title,
      description,
      category,
      original_language,
      status,
      created_by
    )
    values (
      new_event_id,
      generated_slug,
      clean_title,
      description,
      category,
      original_language,
      'active',
      current_user_id
    )
    returning id into target_cluster_id;
  else
    target_cluster_id := merge_target_cluster_id;
  end if;

  insert into public.attention_sources (
    cluster_id,
    event_id,
    source_type,
    source_platform,
    title,
    description,
    rules_text,
    oracle_type,
    ends_at,
    raw_metadata,
    imported_by
  )
  values (
    target_cluster_id,
    new_event_id,
    'native',
    'momment.',
    clean_title,
    description,
    resolution_criteria,
    'aio_native',
    ends_at,
    jsonb_build_object('mode', 'create', 'supported_outcomes', clean_outcomes),
    current_user_id
  )
  returning id into new_source_id;

  insert into public.attention_source_ledger (source_id, cluster_id, creator_id, pre_merge_energy_weight)
  values (new_source_id, target_cluster_id, current_user_id, 1)
  on conflict (source_id) do nothing;

  insert into public.attention_activity_ledger (cluster_id, source_id, user_id, activity_type, mom_energy, metadata)
  values (target_cluster_id, new_source_id, current_user_id, 'source_create', 5, jsonb_build_object('mode', 'create'));

  insert into public.attention_aliases (cluster_id, alias, language, source)
  values (target_cluster_id, clean_title, original_language, 'user')
  on conflict do nothing;

  -- Create attention rule with status 'active' so clients can read via RLS
  insert into public.attention_rules (
    event_id,
    title,
    question,
    resolution_criteria,
    supported_outcomes,
    source_requirements,
    challenge_period_seconds,
    oracle_config,
    status,
    created_by
  )
  values (
    new_event_id,
    clean_title,
    clean_title,
    coalesce(nullif(trim(resolution_criteria), ''), 'AIO evidence and official sources are required for final resolution.'),
    clean_outcomes,
    jsonb_build_object('mode', 'aio_native', 'min_sources', 1),
    86400,
    jsonb_build_object(
      'oracle_mode', 'aio_native',
      'builder_verification_window_seconds', 43200,
      'open_verification_window_seconds', 43200,
      'challenge_period_seconds', 86400,
      'challenge_cost_mom_energy', 25,
      'minimum_challenge_mom_energy', 100,
      'minimum_challenge_trust_score', 1
    ),
    'active',
    current_user_id
  )
  on conflict (event_id) do update
  set
    supported_outcomes = excluded.supported_outcomes,
    resolution_criteria = excluded.resolution_criteria,
    challenge_period_seconds = excluded.challenge_period_seconds,
    oracle_config = excluded.oracle_config,
    status = 'active',
    updated_at = now();

  -- Link topics to the attention cluster
  if array_length(topic_slugs, 1) is not null then
    foreach topic_slug in array topic_slugs
    loop
      -- Find or create the topic
      select id into topic_id_val
      from public.topics
      where slug = topic_slug;

      if topic_id_val is null then
        insert into public.topics (slug, canonical_label, description, created_by, status)
        values (topic_slug, topic_slug, null, current_user_id, 'pending')
        returning id into topic_id_val;
      end if;

      -- Link topic to attention
      insert into public.content_topics (topic_id, target_id, target_type)
      values (topic_id_val, target_cluster_id, 'attention')
      on conflict do nothing;
    end loop;
  end if;

  update public.attention_clusters
  set source_count = (
    select count(*) from public.attention_sources
    where cluster_id = target_cluster_id
  )
  where id = target_cluster_id;

  return target_cluster_id;
end;
$$;

-- Grant execute with new signature (includes topic_slugs)
grant execute on function public.create_native_attention(text, text, text, text, timestamptz, public.supported_language, uuid, text[], text[]) to authenticated;

-- Allow authenticated users to insert topics (for user-generated topics)
drop policy if exists "users can create topics" on public.topics;
create policy "users can create topics"
on public.topics for insert
to authenticated
with check (true);

-- Allow public read on topics
drop policy if exists "topics are publicly readable" on public.topics;
create policy "topics are publicly readable"
on public.topics for select
using (true);

-- Allow authenticated users to create content_topics links
drop policy if exists "users can link topics" on public.content_topics;
create policy "users can link topics"
on public.content_topics for insert
to authenticated
with check (true);
