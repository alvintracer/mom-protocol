do $$
declare
  seed_owner uuid;
  bts_attention uuid;
  kbo_attention uuid;
begin
  select id into seed_owner
  from public.profiles
  order by created_at asc
  limit 1;

  if seed_owner is null then
    raise notice 'No profile found. Sign up once before running this seed.';
    return;
  end if;

  insert into public.attention_clusters (
    slug,
    title,
    description,
    category,
    original_language,
    status,
    source_count,
    post_count,
    comment_count,
    attention_score,
    created_by
  )
  values
    (
      'bts-june-comeback',
      'BTS가 6월에 컴백하는가?',
      '앨범, 투어, 소셜 시그널, 유통 일정 근거가 모이는 a/ 커뮤니티입니다.',
      'entertainment',
      'ko',
      'active',
      3,
      0,
      0,
      7820,
      seed_owner
    )
  on conflict (slug) do update
  set title = excluded.title,
      description = excluded.description,
      category = excluded.category,
      status = 'active',
      updated_at = now()
  returning id into bts_attention;

  insert into public.attention_clusters (
    slug,
    title,
    description,
    category,
    original_language,
    status,
    source_count,
    post_count,
    comment_count,
    attention_score,
    created_by
  )
  values
    (
      'kbo-2026-champion',
      '올해 한국야구 우승팀은 어디?',
      '시즌 흐름, 부상, 전력 보강, 팬 여론이 모이는 a/ 커뮤니티입니다.',
      'sports',
      'ko',
      'active',
      2,
      0,
      0,
      6410,
      seed_owner
    )
  on conflict (slug) do update
  set title = excluded.title,
      description = excluded.description,
      category = excluded.category,
      status = 'active',
      updated_at = now()
  returning id into kbo_attention;

  insert into public.posts (
    user_id,
    attention_cluster_id,
    post_kind,
    type,
    visibility,
    original_language,
    original_body,
    translation_status,
    like_count,
    comment_count,
    share_count
  )
  values
    (
      seed_owner,
      bts_attention,
      'post',
      'analysis',
      'public',
      'ko',
      '최근 유통사 일정과 멤버별 활동 공백을 보면 6월 컴백설이 완전히 뜬소문은 아닌 것 같음. 공식 티저 전까지는 소셜 이미지 변경을 더 봐야 할 듯.',
      'pending',
      18,
      4,
      2
    ),
    (
      seed_owner,
      kbo_attention,
      'post',
      'analysis',
      'public',
      'ko',
      '초반 전력만 보면 우승 후보가 너무 빨리 좁혀지는 느낌인데, 여름 이후 선발 로테이션 버티는 팀이 a/kbo-2026-champion의 핵심 변수일 듯.',
      'pending',
      11,
      3,
      1
    ),
    (
      seed_owner,
      null,
      'post',
      'analysis',
      'public',
      'ko',
      '어텐션을 아직 고르지 않은 자유 포스트. 이런 글은 홈에는 남기고, 나중에 LLM이 어울리는 a/를 추천하면 좋겠다.',
      'pending',
      7,
      1,
      0
    );

  update public.attention_clusters
  set post_count = (
    select count(*)
    from public.posts
    where attention_cluster_id = public.attention_clusters.id
      and is_deleted = false
  )
  where id in (bts_attention, kbo_attention);
end $$;
