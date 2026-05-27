-- Fix duplicate attention clusters from repeated imports of the same market
-- 1. Add duplicate detection to import_attention_source
-- 2. Clean up existing duplicates for apple foldable iPhone market

-- Step 1: Update import_attention_source to check for existing source before creating new cluster
create or replace function public.import_attention_source(
  source_url text,
  source_platform text,
  title text,
  description text default null,
  category text default null,
  rules_text text default null,
  oracle_type text default null,
  resolver_address text default null,
  external_market_id text default null,
  reference_signal numeric default null,
  reference_signal_label text default null,
  ends_at timestamptz default null,
  raw_metadata jsonb default '{}'::jsonb,
  merge_target_cluster_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  clean_title text;
  normalized_url text;
  source_kind public.attention_source_type;
  new_event_id uuid;
  target_cluster_id uuid;
  new_source_id uuid;
  generated_slug text;
  existing_source_id uuid;
  existing_cluster_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  normalized_url := public.normalize_attention_url(source_url);
  if normalized_url is null then
    raise exception 'source_url_required';
  end if;

  clean_title := coalesce(nullif(trim(title), ''), source_platform || ' attention');
  source_kind := case lower(coalesce(source_platform, 'other'))
    when 'polymarket' then 'polymarket'::public.attention_source_type
    when 'kalshi' then 'kalshi'::public.attention_source_type
    when 'manifold' then 'manifold'::public.attention_source_type
    when 'predictit' then 'predictit'::public.attention_source_type
    when 'news' then 'news'::public.attention_source_type
    when 'official' then 'official'::public.attention_source_type
    else 'other'::public.attention_source_type
  end;

  -- CHECK FOR EXISTING SOURCE: if a source with same canonical_url already exists,
  -- return its cluster_id instead of creating a new cluster
  if merge_target_cluster_id is null then
    select s.id, s.cluster_id into existing_source_id, existing_cluster_id
    from public.attention_sources s
    where s.source_type = source_kind
      and s.canonical_url = normalized_url
    limit 1;

    if existing_cluster_id is not null then
      -- Source already exists — update it and return existing cluster
      update public.attention_sources
      set
        title = clean_title,
        description = import_attention_source.description,
        rules_text = import_attention_source.rules_text,
        oracle_type = import_attention_source.oracle_type,
        resolver_address = import_attention_source.resolver_address,
        reference_signal = import_attention_source.reference_signal,
        reference_signal_label = import_attention_source.reference_signal_label,
        ends_at = import_attention_source.ends_at,
        raw_metadata = coalesce(import_attention_source.raw_metadata, '{}'::jsonb),
        updated_at = now()
      where id = existing_source_id;

      return existing_cluster_id;
    end if;
  end if;

  generated_slug := public.slugify_attention(clean_title) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  if merge_target_cluster_id is null then
    insert into public.events (
      slug,
      title,
      description,
      category,
      source_platform,
      source_url,
      external_market_id,
      status,
      resolution,
      ends_at,
      created_by
    )
    values (
      generated_slug,
      clean_title,
      import_attention_source.description,
      import_attention_source.category,
      import_attention_source.source_platform,
      normalized_url,
      import_attention_source.external_market_id,
      'draft',
      import_attention_source.rules_text,
      import_attention_source.ends_at,
      current_user_id
    )
    returning id into new_event_id;

    insert into public.attention_clusters (
      canonical_event_id,
      slug,
      title,
      description,
      category,
      status,
      created_by
    )
    values (
      new_event_id,
      generated_slug,
      clean_title,
      import_attention_source.description,
      import_attention_source.category,
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
    source_url,
    canonical_url,
    external_market_id,
    title,
    description,
    rules_text,
    oracle_type,
    resolver_address,
    reference_signal,
    reference_signal_label,
    ends_at,
    raw_metadata,
    imported_by
  )
  values (
    target_cluster_id,
    new_event_id,
    source_kind,
    import_attention_source.source_platform,
    import_attention_source.source_url,
    normalized_url,
    import_attention_source.external_market_id,
    clean_title,
    import_attention_source.description,
    import_attention_source.rules_text,
    import_attention_source.oracle_type,
    import_attention_source.resolver_address,
    import_attention_source.reference_signal,
    import_attention_source.reference_signal_label,
    import_attention_source.ends_at,
    coalesce(import_attention_source.raw_metadata, '{}'::jsonb),
    current_user_id
  )
  on conflict (source_type, canonical_url) do update
  set
    cluster_id = excluded.cluster_id,
    title = excluded.title,
    description = excluded.description,
    rules_text = excluded.rules_text,
    oracle_type = excluded.oracle_type,
    resolver_address = excluded.resolver_address,
    reference_signal = excluded.reference_signal,
    reference_signal_label = excluded.reference_signal_label,
    ends_at = excluded.ends_at,
    raw_metadata = excluded.raw_metadata,
    updated_at = now()
  returning id into new_source_id;

  insert into public.attention_source_ledger (source_id, cluster_id, creator_id, pre_merge_energy_weight)
  values (new_source_id, target_cluster_id, current_user_id, 1)
  on conflict (source_id) do nothing;

  insert into public.attention_activity_ledger (cluster_id, source_id, user_id, activity_type, mom_energy, metadata)
  values (target_cluster_id, new_source_id, current_user_id, 'source_import', 3, jsonb_build_object('platform', import_attention_source.source_platform));

  insert into public.attention_aliases (cluster_id, alias, source)
  values (target_cluster_id, clean_title, 'external')
  on conflict do nothing;

  update public.attention_clusters
  set source_count = (
    select count(*) from public.attention_sources
    where cluster_id = target_cluster_id
  )
  where id = target_cluster_id;

  return target_cluster_id;
end;
$$;

-- Step 2: Clean up duplicate Apple foldable iPhone clusters
-- Keep the one with most energy/posts, archive the rest
do $$
declare
  keep_id uuid;
  dup_ids uuid[];
begin
  -- Find duplicate clusters with similar slug pattern
  select array_agg(id order by attention_score desc, post_count desc)
  into dup_ids
  from public.attention_clusters
  where slug like 'will-apple-announce-a-foldable-iphone%'
    and status = 'active';

  if dup_ids is not null and array_length(dup_ids, 1) > 1 then
    keep_id := dup_ids[1];  -- Keep the highest scored one

    -- Move any posts from duplicates to the keeper
    update public.posts
    set attention_cluster_id = keep_id
    where attention_cluster_id = any(dup_ids[2:]);

    -- Move any memberships
    insert into public.attention_memberships (user_id, attention_cluster_id)
    select user_id, keep_id
    from public.attention_memberships
    where attention_cluster_id = any(dup_ids[2:])
    on conflict do nothing;

    -- Archive the duplicates
    update public.attention_clusters
    set status = 'archived'
    where id = any(dup_ids[2:]);

    -- Update counts on the keeper
    update public.attention_clusters
    set
      post_count = (select count(*) from public.posts where attention_cluster_id = keep_id),
      source_count = (select count(*) from public.attention_sources where cluster_id = keep_id)
    where id = keep_id;
  end if;
end;
$$;
