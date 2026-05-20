-- Enable pg_trgm extension for trigram-based text similarity
-- This powers the attention dedup / clustering feature.
-- Run after: attention_clusters_sources migration

create extension if not exists pg_trgm;

-- Add GIN trigram index on attention_clusters.title for fast similarity search
create index if not exists attention_clusters_title_trgm_idx
on public.attention_clusters using gin (title gin_trgm_ops);

-- Add GIN trigram index on attention_aliases.alias for synonym matching
create index if not exists attention_aliases_alias_trgm_idx
on public.attention_aliases using gin (alias gin_trgm_ops);

-- Function: Find similar attention clusters given a query text
-- Uses trigram similarity on both titles and aliases, deduplicates,
-- and returns top matches with scores.
create or replace function public.find_similar_attentions(
  query_text text,
  query_category text default null,
  max_results integer default 5,
  min_score numeric default 0.15
)
returns table (
  cluster_id uuid,
  title text,
  slug text,
  category text,
  similarity_score numeric,
  source_count integer,
  post_count integer,
  attention_score numeric,
  match_source text  -- 'title' or 'alias'
)
language sql
stable
security definer
set search_path = public
as $$
  with title_matches as (
    select
      c.id as cluster_id,
      c.title,
      c.slug,
      c.category,
      similarity(lower(c.title), lower(query_text))::numeric as sim_score,
      c.source_count,
      c.post_count,
      c.attention_score,
      'title'::text as match_source
    from public.attention_clusters c
    where c.status in ('active', 'reviewing')
      and similarity(lower(c.title), lower(query_text)) >= min_score
      and (query_category is null or c.category = query_category)
  ),
  alias_matches as (
    select
      c.id as cluster_id,
      c.title,
      c.slug,
      c.category,
      similarity(lower(a.alias), lower(query_text))::numeric as sim_score,
      c.source_count,
      c.post_count,
      c.attention_score,
      'alias'::text as match_source
    from public.attention_aliases a
    join public.attention_clusters c on c.id = a.cluster_id
    where c.status in ('active', 'reviewing')
      and similarity(lower(a.alias), lower(query_text)) >= min_score
      and (query_category is null or c.category = query_category)
  ),
  combined as (
    select * from title_matches
    union all
    select * from alias_matches
  ),
  ranked as (
    select
      cluster_id,
      title,
      slug,
      category,
      max(sim_score) as similarity_score,
      max(source_count) as source_count,
      max(post_count) as post_count,
      max(attention_score) as attention_score,
      (array_agg(match_source order by sim_score desc))[1] as match_source
    from combined
    group by cluster_id, title, slug, category
  )
  select
    cluster_id,
    title,
    slug,
    category,
    similarity_score,
    source_count,
    post_count,
    attention_score,
    match_source
  from ranked
  order by similarity_score desc, attention_score desc
  limit max_results;
$$;

-- Grant access to authenticated users and anon (for public search)
grant execute on function public.find_similar_attentions(text, text, integer, numeric)
to authenticated, anon;
