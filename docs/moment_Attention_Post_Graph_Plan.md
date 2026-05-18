# momment. Attention/Post Graph Plan

## Core Model

momment.의 최상위 클러스터링 단위는 `Topic`이고, 검증 대상 단위는 `Attention`이다. UI 표기는 어텐션에 `a/`를 사용한다.

- `topic/{slug}` 또는 `t/{slug}`: 같은 AI/유저 토픽으로 묶인 어텐션과 포스트 모음
- `a/{slug}`: 이벤트 발생 여부와 검증 시점이 결합된 질문형 어텐션
- `u/{handle}`: 유저 공개 프로필
- `post`: X/Threads에 가까운 짧은 포스트
- `repost` / `quote`: 기존 post를 다시 퍼뜨리거나 의견을 붙이는 포스트
- `comment`: 특정 post 아래의 가벼운 댓글/답글

중요: `a/ attention`은 지속 커뮤니티가 아니라 검증 가능한 질문형 이벤트 단위다. 장기 커뮤니티/클러스터링 성격은 `Topic`이 담당한다. Attention은 Polymarket의 market처럼 “무엇이, 언제까지, 어떤 기준으로 검증되는가”가 선명해야 한다.

현재 권장 계층:

```txt
Topic
  = 반복적으로 이어지는 관심사/키워드 클러스터
  = 예: #bts, #kbo, #bitcoin-etf
  = 하나의 attention은 여러 topic에 연결 가능

Attention
  = 이벤트 발생 여부 + 검증 시점 + 케이스/옵션 + AIO 기준이 결합된 질문형 단위
  = 사용자 라우트 a/{slug}

Source
  = Polymarket/Kalshi/Manifold/뉴스/공식 데이터 등 외부 또는 내부 참고 출처

Post / Reply
  = attention 아래에 쌓이는 유저 발화

Attention Cluster
  = 같은 현실 이벤트를 다루는 attention/source를 합치기 위한 내부 canonical merge 레이어
  = UI 문구로 직접 노출하지 않음
```

예:

- `topic/bts`: BTS 관련 어텐션과 포스트 묶음
- `a/bts-2026-june-comeback`: BTS가 2026년 6월에 컴백하는가?
- `a/kbo-2026-champion`: 올해 한국야구 우승팀은 어디인가?

## Relationship

```txt
topic
  └─ attentions
      └─ posts

attention(a/)
  ├─ posts
  │   ├─ reposts / quote posts
  │   └─ comments
  │       └─ comment replies
  ├─ topics
  ├─ external sources
  ├─ cases/options
  ├─ AIO rule / resolve criteria / verification deadline
  └─ energy / contribution ledger
```

`posts.attention_cluster_id`가 있으면 해당 post는 그 `a/` attention 아래에 쌓인다. `posts.attention_cluster_id`가 없으면 global/free post다.

## Global Posts

어텐션을 첨부하지 않은 post는 허용한다. 이유는 다음과 같다.

- 사용자는 항상 특정 a/를 먼저 고르지 않고 생각을 올릴 수 있어야 한다.
- 링크나 본문 기반으로 나중에 LLM/배치가 어울리는 Topic/Attention을 추천하거나 자동 후보로 묶을 수 있다.
- global post는 홈 피드에는 보이되, 특정 attention의 contribution/energy에는 직접 반영하지 않는다.
- 사용자가 나중에 “어텐션에 붙이기”를 하거나, 시스템이 “추천 Topic/Attention”을 제안한다.

즉 global post는 discovery buffer이고, attention-attached post는 event contribution이다.

## Energy Direction

어텐션의 총 에너지는 아래 활동으로 누적된다.

- attention-attached post 작성
- comment/reply 토론
- repost/quote 확산
- 외부 출처 추가
- AIO rule/evidence 검증 참여
- 같은 이벤트의 출처/중복 어텐션이 merge되는 synergy

이 에너지는 momment vault의 Contribution Ratio 계산으로 이어진다. 보상은 베팅 결과가 아니라 attention/event contribution에서 나온다.

현재 구현 상태:

- `create_native_attention`은 `attention_activity_ledger`에 `source_create = 5` MOM Energy를 기록하고, ledger trigger가 `attention_score`와 유저 `mom_energy`에 반영한다.
- `attention_rules.supported_outcomes`는 어텐션의 케이스/옵션을 저장한다. `/attentions/new`의 `만들기` 모드는 이 값을 어텐션 생성 시 함께 만든다.
- `posts.selected_outcome`은 포스트가 어느 케이스를 다루는지 표시한다. 이 값은 의견/근거 분류용이며 베팅 포지션이나 금전 보상 기준이 아니다.
- `import_attention_source`는 `attention_activity_ledger`에 `source_import = 3` MOM Energy를 기록하고, ledger trigger가 `attention_score`와 유저 `mom_energy`에 반영한다.
- 어텐션에 붙은 포스트 작성은 `+2`, 리플라이형 포스트는 `+1`, 리포스트/quote는 `+1.5`로 자동 반영한다.
- 댓글은 `+1`, 좋아요는 `+0.05`로 자동 반영한다. 좋아요 취소는 attention score에서 `-0.05`를 되돌린다.
- 기존 데이터는 `recalculate_attention_energy(attention_cluster_id)`로 재계산할 수 있다.

권장 산식:

```txt
attention_energy =
  source_create * 5
  + source_import * 3
  + attached_post * 2
  + reply/comment * 1
  + repost/quote * 1.5
  + accepted_evidence * 4
  + verified_resolution_participation * 6
  + qualified_view_or_read * 0.05
```

스팸 방지를 위해 좋아요, 조회, 반복 댓글은 cap과 trust multiplier를 적용한다. Topic Energy는 해당 Topic에 연결된 Attention Energy의 합으로 보여준다.

## Topic vs Time-bounded Attention

Reddit의 subreddit처럼 계속 유지되는 역할은 `Topic`이 맡는다. momment.의 `a/`는 이벤트 검증 단위라서 검증 시점과 resolve 기준을 반드시 품어야 한다.

```txt
topic/bts
  ├─ a/bts-2026-june-comeback
  ├─ a/bts-pre-release-before-may
  └─ a/bts-tour-announcement-q3
```

- `topics`: 장기 관심사, AI/유저 태그, 탐색/추천/클러스터링의 중심
- `attention_cluster`: 동일 이벤트를 묶는 내부 canonical merge 단위
- `attention_rules`: 시간 제한이 있는 질문, 판정 기준, AIO resolve 단위
- `attention_sources`: 외부 마켓, 뉴스, 공식 문서, oracle metadata
- `posts/comments`: attention 활동과 기여

따라서 “BTS가 6월에 컴백하는가?”는 그대로 하나의 attention이어야 한다. 같은 BTS 관련 attention들이 장기적으로 모이는 곳은 `topic/bts`다.

## Cases / Options

케이스는 어텐션 질문이 최종적으로 가질 수 있는 결과 후보를 뜻한다. UI에서는 “케이스” 또는 “옵션”으로 표현한다.

예:

- YES / NO
- 한화 / 기아 / 삼성 / 두산 / LG / NC
- BTC 100K 미만 / 100K-120K / 120K 이상

케이스는 세 가지 용도로만 사용한다.

- 포스트가 어떤 관점/결과 후보를 다루는지 분류
- AIO assertion이 어떤 결과를 주장하는지 명확화
- 최종 resolution 후 검색/아카이브/분석에 사용

금지:

- 특정 케이스를 선택했다는 이유만으로 vault 보상 가중치를 주지 않는다.
- “맞힌 사람 보상”처럼 보이는 UI나 카피를 만들지 않는다.
- 사용자가 케이스에 돈을 걸거나 포지션을 보유하는 것처럼 표현하지 않는다.

## AIO Resolution Timing

어텐션 생성 시점에는 아직 결과 증거가 존재하지 않을 수 있다. 따라서 생성 시점에 AIO가 증명해야 하는 것은 “결과”가 아니라 “검증 가능한 질문 구조”다.

권장 상태 흐름:

```txt
draft
  -> active
  -> verification_pending
  -> builder_verification_window  (기준 시점 이후 12h)
  -> open_verification_window     (빌더 미제출 시 다음 12h)
  -> challenge_window             (AIO assertion 제출 후 24h)
  -> resolved / disputed / voided
```

- 생성 시점: 질문, 케이스/옵션, 검증 기준 시점, 잠정 해결 기준을 저장한다.
- 빌더 검증 시간: 최초 빌더가 먼저 레퍼런스/출처와 AIO assertion을 제출할 수 있다.
- 오픈 검증 시간: 빌더가 제출하지 않으면 자격 있는 유저 누구나 제출할 수 있다.
- 챌린지 시간: 잘못된 assertion에 대해 MOM Energy/포인트 기반 정직 담보를 걸고 challenge할 수 있다.
- Agentic Oracle은 자동 판정/증거 검증의 1차 레이어로 쓰되, 고가치 어텐션에는 challenge layer를 유지한다.

MVP 챌린지 자격:

- 최소 100 MOM Energy 보유
- Trust Score 1 이상
- 계정 생성 후 24시간 이상
- 동일 assertion에는 유저당 1회만 challenge 가능
- 유저당 최근 24시간 내 최대 5회
- challenge 제출 시 25 MOM Energy를 정직 담보로 소모

챌린지 결과:

- 유효한 챌린지: 담보 환급 + 25 MOM Energy oracle contribution 보상 + Trust Score 소폭 증가
- 실패/악성 챌린지: 담보 소각 + Trust Score 소폭 감소

## Implementation Rules

- 신규 포스트 작성 UI는 “어텐션 첨부 없음”을 허용한다.
- 어텐션에 첨부된 포스트는 홈과 `/a/[slug]` 양쪽에 노출한다.
- `/a/[slug]`는 질문형 이벤트 상세 페이지로 동작한다.
- `/a/[slug]` 안에 축소판 포스트 작성기를 중복 구현하지 않는다. 어텐션 상세의 작성 CTA는 `/posts/new?attention=<attention_id>`로 이동해야 한다.
- `/posts/new`가 단일 정식 포스트 작성 플로우다. 이 페이지는 어텐션 검색/선택, 선택된 어텐션의 케이스/옵션 선택, 타이틀/바디, 미디어, 링크, 드래프트 저장을 모두 담당한다.
- `/posts/new?attention=<attention_id 또는 slug>`로 진입하면 해당 어텐션을 자동 선택한다.
- 어텐션 선택 UI는 `a/slug`만 보여주지 말고 `어텐션 제목 (a/slug)` 형식으로 보여준다.
- 어텐션 선택 후 `attention_rules.supported_outcomes`를 읽어 케이스 선택 UI를 표시한다.
- 포스트 저장 시 `posts.attention_cluster_id`와 함께 `posts.selected_outcome`을 저장한다. 선택하지 않은 경우 `null`을 허용한다.
- 사용자는 `attention_memberships`로 a/를 Follow/Track 한다. 이 데이터가 홈의 Following 피드, 알림, 개인화 추천의 기반이다.
- `repost_of_post_id`는 repost/quote의 원본을 가리킨다.
- `parent_post_id`는 post-level thread/reply를 위해 사용한다.
- `comments`는 특정 post 아래의 lightweight comment/reply로 유지한다.
- 향후 LLM batch는 global/free post를 분석해 추천 Topic/Attention 후보와 자동 키워드를 생성한다.

## Current Frontend State

현재 구현은 아래 상태다.

- 홈 `/`은 Supabase `posts` 기반 피드이며 For You/Following 흐름을 사용한다.
- 포스트 작성은 `/posts/new`로 통합되어 있다.
- `/posts/new`는 이미지/오디오 업로드를 Supabase Storage `post-media` 버킷에 저장하고, 업로드 결과를 `posts.media_items` JSON으로 저장한다.
- `/posts/new`의 링크 입력은 제목과 URL을 함께 받으며, URL이 Polymarket/Kalshi/Reddit 등일 때 출처명을 미리보기로 보여준다.
- `/a/[slug]`는 질문, a/slug, Join, 통계, 포스트 리스트, 케이스, 출처를 보여준다.
- `/a/[slug]`의 포스트 작성 CTA는 `/posts/new?attention=<attention_id>`로 연결된다.
- `/posts/[postId]`는 포스트 상세, 첨부 미디어, 링크, 리플라이, 리포스트/quote, 좋아요, 조회 수를 표시한다.
- `/topic/[slug]`는 해당 Topic의 Energy, 상승량, 연결 어텐션을 보여준다. Topic Energy는 연결된 Attention Energy 합산으로 표시한다.
- `/explore`는 어텐션 탐색 페이지다. 신규 링크와 UI 명칭은 Market 대신 Explore/탐색을 사용한다.
- UI 문구는 `src/shared/i18n/dictionaries.ts`의 한국어/영어/스페인어 사전을 통해 렌더링한다. 컴포넌트에 한국어 문구를 직접 쓰지 않는다.

## Open Next Steps

다음 에이전트가 이어서 처리하기 좋은 작업은 아래 순서다.

1. `/posts/new`에서 선택한 어텐션의 `canonical_event_id`가 없는 legacy/mock 데이터일 때도 케이스 fallback을 더 자연스럽게 처리한다.
2. `/posts/new`의 링크 미리보기를 서버 Route Handler로 확장해 title/description/OG image를 가져온다.
3. `post_translations`, `comment_translations`를 실제 렌더링에 붙여 유저 언어별 번역 fallback을 구현한다.
4. 포스트 작성 후 `content_topics` 자동 추천/큐 적재를 붙인다.
5. 어텐션 상세에서 AIO 검증 기준 시점, builder/open/challenge window 상태 UI를 추가한다.
6. 프로필/유저 페이지에 작성 포스트, 만든 어텐션, 댓글/활동, MOM Energy 변화를 실제 데이터로 연결한다.
