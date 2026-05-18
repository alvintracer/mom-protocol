# momment. Attention Aggregation Plan

문서 버전: v0.1  
목적: momment.의 자체 어텐션과 외부 예측시장 링크 기반 어텐션을 하나의 검증 가능한 이벤트 단위로 통합하고, 장기 관심사는 Topic으로 클러스터링하기 위한 제품/데이터/플로우 계획을 정리한다.

## 1. 용어

- `Topic`: AI/유저 태그 기반의 장기 관심사 클러스터. 예: `#bts`, `#kbo`, `#bitcoin`.
- `Attention`: momment. 안에서 토론, 예측, 근거, 게시물, 댓글, 오라클 검증이 모이는 질문형 이벤트 단위. 이벤트 발생 여부와 검증 시점이 함께 있어야 한다.
- `Native Attention`: momment.에서 직접 생성한 자체 어텐션.
- `External Attention`: Polymarket, Kalshi, Manifold 등 외부 예측시장 또는 뉴스/이벤트 링크를 기반으로 생성한 어텐션.
- `External Market Source`: 외부 플랫폼의 개별 마켓/이벤트 링크.
- `Attention Cluster`: 동일한 현실 이벤트를 다루는 여러 external source와 native attention을 하나로 묶는 내부 canonical 집합. UI에는 직접 노출하지 않는다.

## 2. 제품 목표

momment.는 외부 예측시장의 주문/거래/결제를 중개하지 않는다. 대신 여러 플랫폼에 흩어진 동일한 현실 이벤트를 하나의 `Attention`으로 묶고, 같은 주제권의 여러 Attention은 `Topic`으로 클러스터링한다.

```txt
Polymarket market
Kalshi market
Manifold market
news / public event
native momment. attention
        ↓
Attention Cluster
        ↓
Unified momment. Attention
        ↓
Topic clusters
        ↓
posts, comments, evidence, predictions, creator analysis, oracle verification
```

## 3. 외부 플랫폼 우선순위

초기 우선순위:

1. Polymarket
2. Kalshi
3. Manifold

보조 후보:

- PredictIt: 정치 이벤트 레퍼런스로 유용하지만 규제/가용성 이슈를 별도 확인해야 한다.
- Metaculus: 거래형 마켓보다 예측 커뮤니티/집단지성 레퍼런스에 가깝다.
- Robinhood/DraftKings prediction products: 미국 중심 신규/확장 영역으로 별도 검증 후 후보에 둔다.

## 4. 생성 플로우

### 4.1 만들기

사용자가 momment.에서 직접 어텐션을 만든다.

필드:

```txt
title
description
category
resolution_criteria
starts_at
ends_at
tags
topics
initial_evidence_urls
original_language
```

생성 후:

```txt
attention created
  -> original text saved
  -> optional translation batch queued
  -> AI/user topics extracted
  -> similar external sources searched later
  -> attention cluster candidate created only if same event matches exist
  -> AIO rule draft created as native oracle basis
```

### 4.2 가져오기

사용자가 외부 링크를 붙여넣는다.

지원 링크 예:

```txt
Polymarket market URL
Kalshi market URL
Manifold market URL
news/event URL
```

처리:

```txt
paste URL
  -> parse source platform
  -> store raw URL and extracted metadata
  -> import external market title / close date / rules / oracle metadata
  -> create external_market_source
  -> check duplicate source URL
  -> extract topic candidates
  -> find existing attention cluster candidates only for same event
  -> attach to existing attention or create new attention
```

`가져오기`는 외부 마켓을 momment. 안에 거래 마켓으로 복제하지 않는다. 외부 마켓의 rules/oracle/resolver/settlement 정보를 `attention_source` metadata로 가져와 canonical attention의 참고 출처로 붙인다. 자체 AIO rule은 `만들기`에서 생성하며, `가져오기`에서는 필요 시 나중에 source metadata를 기반으로 AIO rule draft를 생성할 수 있다.

## 5. 중복/통합 기준

여러 외부 마켓이 같은 현실 이벤트를 다룰 수 있으므로, 자동 통합은 보수적으로 한다.

매칭 신호:

```txt
title semantic similarity
event category
resolution date / close date
underlying entity/person/team/token
source platform metadata
resolution criteria similarity
external URL canonicalization
creator/admin manual confirmation
```

권장 정책:

- 높은 확신: 자동으로 같은 cluster에 묶되 UI에서 출처별 카드 표시
- 중간 확신: admin/reviewer 확인 큐로 보냄
- 낮은 확신: 별도 attention으로 생성

## 6. 데이터 모델 확장 방향

현재 migration의 `events`는 향후 제품 언어상 `attentions`로 승격하는 것이 자연스럽다. 단, 이미 SQL을 실행했으므로 즉시 rename하지 않고 다음 migration에서 아래 확장 테이블을 추가하는 방식을 권장한다.

```txt
attention_clusters
attention_sources
attention_source_snapshots
attention_merge_candidates
attention_aliases
```

예상 역할:

- `attention_clusters`: 같은 현실 이벤트를 묶는 canonical 그룹
- `attention_sources`: Polymarket/Kalshi/Manifold/native/news 등 출처별 원본
- `attention_source_snapshots`: 외부 확률, 거래량, 상태 등 시점별 참고 데이터
- `attention_merge_candidates`: 자동/수동 병합 후보 큐
- `attention_aliases`: 검색과 중복 탐지를 위한 별칭

## 7. 게시물 생성과의 관계

게시물 생성 기능은 `Attention Detail`이 있어야 자연스럽다. 따라서 순서는 아래가 좋다.

1. Attention/External Source 모델 확정
2. Attention 생성 플로우 mock UI
3. External URL paste/import mock UI
4. Attention detail에 post composer 추가
5. post/comment 원문 저장
6. batch translation worker
7. merge candidate review/admin flow

게시물부터 바로 만들 수는 있지만, 어떤 attention에 붙을지와 외부 source 통합 기준이 먼저 잡혀야 재작업이 적다.

## 7.1 AIO Rule과 Attention의 관계

모든 canonical attention은 자체 `Attention Rules`를 가져야 한다. 외부 Polymarket/Kalshi/Manifold rules는 참고 source metadata이고, momment.에서 canonical하게 resolve되는 기준은 `docs/moment_aio.md` 기반 AIO rule이다.

```txt
external market rules
native creator proposal
admin/community edits
        ↓
Attention Rules
        ↓
AIO Assertion / Evidence / LLM Verification / Challenge / Final Resolution
```

상세 설계는 `docs/moment_AIO_Attention_Protocol_Plan.md`를 따른다.

## 7.2 병합 시너지와 분배 원칙

어텐션 병합은 사용자가 손해를 보는 구조가 아니어야 한다. 병합 후 커뮤니티가 커지면 게시물, 댓글, 구독, 광고, 부스트, 슈퍼 댓글 노출이 늘어나므로 전체 vault 유입과 MOM Energy가 커질 수 있다. 이를 `merge synergy`로 정의한다.

### 핵심 원칙

- 병합 전 각 하위 어텐션의 생성자, 초기 기여자, 게시물 작성자, 댓글 작성자, 광고/부스트 구매자의 원천 기여 기록은 보존한다.
- 병합 후에는 하나의 canonical attention room에서 커뮤니티를 통합하되, revenue/energy 계산은 source ledger를 기준으로 attribution한다.
- 병합 때문에 기존 기여자의 Contribution Ratio가 갑자기 사라지거나 희석되지 않도록 pre-merge credit을 snapshot한다.
- 병합 이후 새로 발생한 수익과 MOM Energy는 unified room의 activity ledger로 계산한다.
- 중복 어텐션을 합쳐 전체 관심이 커진 효과는 별도 `synergy_pool`로 잡고, 병합된 source들의 기여 비율에 따라 나눈다.

### 추천 데이터 구조

```txt
attention_source_ledger
- source_id
- cluster_id
- creator_id
- created_at
- pre_merge_post_count
- pre_merge_comment_count
- pre_merge_revenue_weight
- pre_merge_energy_weight
- merge_snapshot_at

attention_activity_ledger
- cluster_id
- source_id nullable
- user_id
- activity_type: post | comment | boost | ad | subscription | evidence | share
- revenue_amount
- mom_energy
- created_at

attention_synergy_allocations
- cluster_id
- period_start
- period_end
- total_synergy_revenue
- total_synergy_energy
- allocation_method
- allocated_to_user_id
- allocated_to_source_id
- allocation_ratio
```

### 분배 방식

```txt
total attention value
  = direct source value
  + unified room value
  + merge synergy value
```

- `direct source value`: 특정 하위 어텐션/외부 source에 직접 붙은 광고, 부스트, 게시물 성과.
- `unified room value`: 병합 이후 canonical room에서 발생한 댓글, 게시물, 구독, 슈퍼 댓글, 부스트.
- `merge synergy value`: 병합으로 증가한 조회, 참여, 광고 단가, 커뮤니티 체류 시간에서 발생한 추가분.

초기 MVP에서는 아래 보수적 공식을 사용한다.

```txt
creator allocation
  = source creator base credit
  + own content activity credit
  + source merge contribution credit

community allocation
  = post/comment/evidence/share activity credit
  + trust score multiplier
  + anti-spam quality multiplier
```

### 제품 UX

- 병합 후보 UI에는 "어텐션 합치기"를 보여주되, 병합 시 기존 기여와 수익 attribution이 유지된다는 점을 내부 ledger로 보장한다.
- 사용자-facing UI에서는 복잡한 수식 대신 `이 어텐션은 여러 출처가 통합된 커뮤니티입니다`와 `기여도는 원천 활동과 통합 이후 활동을 함께 반영합니다` 정도로 표현한다.
- admin/reviewer 화면에서는 source별 기여, pre-merge snapshot, synergy allocation을 볼 수 있어야 한다.

## 8. UI 원칙

- UI 작업 전 `docs/AGENT_DESIGN_SYNC.md`를 반드시 읽는다.
- 외부 마켓은 거래 CTA가 아니라 참고 출처 카드로 보여준다.
- 외부 이동은 `External link`로만 제공한다.
- momment. 내부 CTA는 `예측`, `근거`, `토론`, `게시`, `팔로우`, `구독`, `부스트` 중심이다.
- 모바일 웹에서 URL paste, source 선택, 중복 후보 선택이 모두 가능해야 한다.

## 9. 다음 스프린트 제안

Sprint A: Attention source model

- 다음 migration으로 `attention_clusters`, `attention_sources`, `attention_source_snapshots`, `attention_merge_candidates` 추가
- 기존 `events`를 당분간 canonical attention 테이블처럼 사용
- mock data에 native/external attention 구분 추가

Sprint B: Attention creation mock UI

- `/attentions/new`
- native/external segmented control
- external URL paste parser mock
- merge candidate preview mock

Sprint C: Post composer

- attention detail에 게시물 작성 composer
- 원문 언어 저장
- translation pending 표시
- batch translation queue enqueue는 server action 또는 scheduled function으로 분리

## 10. Home vs Explore IA

`홈`은 소셜 피드로 유지한다.

```txt
추천 / 팔로잉
creator posts
evidence cards
comments / discussion
super comments
translation-aware feed
```

`탐색`은 거래 화면이 아니라 Attention discovery 화면이다. Kalshi/Polymarket 메인처럼 박스형 카드 그리드와 섹션을 사용하되, momment. 내부에서는 거래/주문이 아니라 어텐션 커뮤니티 진입으로 처리한다.

```txt
속보 / 인기있는 어텐션
인기 주제 / 해시태그
카테고리별 어텐션
마감 임박
외부 출처별 모음
새로 생성된 어텐션
```

추천 라우트:

```txt
/                 -> Home feed
/explore          -> Attention discovery grid
/attentions/new   -> Native / External attention creation
/attentions/[id]  -> Unified attention room
```

## 11. Topic Extraction

유저가 지정한 해시태그와 LLM이 자동 추출한 키워드는 별도로 저장한다.

```txt
user hashtags
  -> source = user

LLM keywords / entities / categories
  -> source = llm
  -> confidence
  -> model
```

번역 배치와 같은 worker 파이프라인에서 아래 작업을 함께 처리한다.

```txt
original post/comment saved
  -> translation_status = pending
  -> topic extraction pending
  -> batch worker translates content
  -> batch worker extracts hashtags, keywords, entities, category
  -> content_topics updated
  -> topic_trend_snapshots updated
  -> Explore tab sections refreshed
```

다음 migration:

```txt
supabase/migrations/20260516010000_attention_topics_and_discovery.sql
```

추가 테이블:

```txt
topics
content_topics
attention_source_snapshots
discovery_sections
discovery_section_items
topic_trend_snapshots
```

`탐색` 탭의 `속보`와 `인기 주제`는 이 테이블들을 기반으로 구성한다.
