# momment. Handover

Last updated: 2026-05-18

이 문서는 Codex, Antigravity, Claude 등 다른 에이전트가 현재 상태를 놓치지 않고 이어서 작업하기 위한 최신 인수인계 문서다.

## Product Direction

- 서비스명은 `momment.`이다. 심볼은 `MOM`이며, `MOM Energy`, `MOM 포인트`처럼 심볼 의미일 때만 `MOM`을 쓴다.
- momment.는 베팅 플랫폼이 아니다. 사용자는 momment. 안에서 실돈으로 결과에 베팅하지 않는다.
- momment.는 글로벌 이벤트/예측시장/뉴스 위에 쌓이는 Event Attention SocialFi + AI Oracle Layer다.
- 케이스/옵션 선택은 의견/근거 분류이며 베팅 포지션이 아니다.
- vault 보상은 결과 적중이 아니라 포스트, 리플라이, 근거, 검증, 확산, 기여 기반 Contribution Ratio로 계산한다.

## Core Graph

```txt
Topic
  -> Attention
      -> Source
      -> Case / Option
      -> Post / Reply
      -> AIO Rule / Assertion / Resolution
```

- `Topic`: 장기 관심사/키워드 클러스터. Route: `/topic/[slug]`
- `Attention`: 질문형 이벤트 + 검증 기준 시점 + 케이스/옵션. Route: `/a/[slug]`
- `Post`: 유저 발화. Route: `/posts/[postId]`
- `Attention Cluster`: 동일 이벤트 merge를 위한 내부 레이어. UI에 직접 노출하지 않는다.

## Current Routes

- `/`: Supabase posts 기반 홈 피드
- `/explore`: 어텐션 탐색
- `/attentions/new`: Attention Builder, 만들기/가져오기
- `/a/[slug]`: Attention detail
- `/topic/[slug]`: Topic page
- `/posts/new`: 통합 포스트 작성
- `/posts/[postId]`: 포스트 상세, 리플라이, 리포스트/quote, 좋아요, 조회
- `/profile`: 내 프로필
- `/u/[handle]`: 공개 프로필
- `/rewards`: momment vault
- `/oracle`: AIO/Challenge mock dashboard

## Post Creation Flow

- `/posts/new`가 단일 정식 포스트 작성 플로우다.
- 어텐션 상세에서 포스트 작성 CTA는 `/posts/new?attention=<attention_id>`로 이동한다.
- `/posts/new?attention=<attention_id 또는 slug>`로 진입하면 해당 어텐션을 자동 선택한다.
- 어텐션 선택 UI는 `어텐션 제목 (a/slug)` 형식으로 보여준다.
- 선택한 어텐션의 케이스는 `attention_rules.supported_outcomes`에서 읽는다.
- 포스트 저장 시:
  - `posts.attention_cluster_id`
  - `posts.selected_outcome`
  - `posts.media_items`
  - `posts.link_title`
  - `posts.link_url`
  를 사용한다.
- 이미지/오디오는 Supabase Storage `post-media` bucket에 업로드한다. 최대 5개, 총합 50MB 미만.

## Supabase Schema Notes

핵심 마이그레이션:

- `20260516000000_initial_moment_schema.sql`
- `20260516010000_attention_topics_and_discovery.sql`
- `20260516020000_aio_protocol.sql`
- `20260517000000_attention_clusters_sources.sql`
- `20260517020000_attention_post_graph.sql`
- `20260517070000_post_attention_outcomes.sql`
- `20260517080000_native_attention_supported_outcomes.sql`
- `20260517090000_aio_challenge_mvp_guardrails.sql`
- `20260517110000_post_media_storage.sql`
- `20260517130000_attention_similarity_search.sql`
- `20260518000000_attention_monetization.sql`
- `20260518010000_aio_adaptive_llm_metadata.sql`

Important naming:

- Use `attention_cluster_id` on posts/comments/ledger when linking user activity to an attention.
- Use `starts_at`, `ends_at`, `resolved_at` naming in event/source style tables. Do not invent `start_date` or `end_date`.
- Use `attention_rules.supported_outcomes` for cases/options.
- Use `posts.selected_outcome` for the selected case on a post.

## Antigravity DB Additions

`supabase/migrations/20260518000000_attention_monetization.sql` adds Tier 1 Attention monetization primitives:

- `attention_page_views`
- `attention_donations`
- `attention_donor_rankings`
- `attention_contributor_rankings`
- `attention_ad_slots`
- `record_attention_page_view(p_cluster_id, p_session_id)`
- `record_attention_dwell_time(p_view_id, p_dwell_seconds)`
- `submit_attention_donation(p_cluster_id, p_amount_krw, p_message, p_is_anonymous)`
- `attention_clusters.total_view_count`
- `attention_clusters.unique_visitor_count`
- `attention_clusters.total_donation_krw`

MVP payments are mock. Do not make donation UI look like betting, staking, odds, ROI, or prediction payout.

## Platform Revenue / momment Vault Ledger

Implemented in:

```txt
supabase/migrations/20260518040000_platform_revenue_vault.sql
```

Revenue source of truth:

- `platform_revenue_ledger`
- `platform_vault_overview`
- `platform_vault_source_mix_current`

Flow:

- NOWPayments finished payment -> `credit_mom_energy_for_payment` credits user once via `payments.energy_credited_at`.
- The same function records the finished payment into `platform_revenue_ledger` as `nowpayments_energy_purchase`.
- AdSense, direct advertiser deposit, campaign revenue, or manual revenue can be posted through `/api/platform-revenue`.
- `/api/platform-revenue` requires `PLATFORM_REVENUE_ADMIN_SECRET` and calls `record_platform_revenue` with the service role.
- Default conversion is `1 USD = 100 MOM Energy` when `energy_amount` is omitted.
- `/rewards` and the home top vault chip read aggregate views, not mock totals.

## AIO Multi-LLM Decision

MVP model set:

```txt
Gemini + GPT + xAI/Grok
```

Consensus:

```txt
adaptive 2 + 1
```

Call flow:

```txt
1. Call Gemini and GPT in parallel.
2. If both agree on the same verdict/outcome and confidence is high enough, stop.
3. Call xAI/Grok only when Gemini and GPT disagree, return low confidence, return ambiguous/insufficient evidence, timeout, or fail JSON schema validation.
4. If xAI/Grok is called, aggregate as 2 of 3.
```

Verdict enum:

```txt
supports
refutes
ambiguous
insufficient_evidence
```

Accept an AIO assertion when:

- Gemini and GPT both support the same `asserted_outcome` with average confidence at least `0.70`
- or xAI/Grok is called and 2 of 3 models support the same `asserted_outcome`
- average confidence of supporting models is at least `0.70`
- evidence count and source requirements pass
- publisher trust checks pass

Reject or require review when:

- 2 or more models refute
- 2 or more models return insufficient evidence
- 1 / 1 / 1 split
- ambiguous appears in 2 or more models
- provider timeout or JSON parse failure happens in 2 or more models
- 2 of 3 agreement exists but confidence is below threshold

Storage:

- Store every provider result in `aio_llm_verifications`.
- Store provider, model_id, prompt_version, prompt_hash, input_hash, output_hash, confidence, verdict, reasoning_summary, raw_output.
- Store aggregate metadata with `consensus_method = "adaptive_2_plus_1"`.
- Store `tie_breaker_called`, `provider_count`, and `tie_breaker_provider = "xai"` when applicable.
- LLM consensus is the first verification layer, not final truth. Keep challenge window.

KoGPT or another Korean-specialized model is not required for MVP. It can be added later as a 4th model or tie-breaker.

## AIO Edge Function

Implemented function:

```txt
supabase/functions/aio-verify/index.ts
```

Required secrets:

```txt
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
OPENAI_API_KEY
XAI_API_KEY
```

Optional model/threshold overrides:

```txt
GEMINI_MODEL=gemini-2.5-flash
OPENAI_MODEL=gpt-4o-mini
XAI_MODEL=grok-4.3
AIO_CONFIDENCE_THRESHOLD=0.7
AIO_PROMPT_VERSION=aio-verifier-v1
```

Request body:

```json
{
  "assertion_id": "uuid",
  "evidence_urls": ["https://example.com/source"]
}
```

Behavior:

- Loads `aio_assertions` and `attention_rules`.
- Captures Evidence Lite metadata into `aio_evidence_items`.
- Calls Gemini and GPT in parallel.
- Calls xAI/Grok only when tie-breaker conditions are met.
- Inserts provider rows into `aio_llm_verifications`.
- Updates `aio_assertions.aggregate_verdict`, `aggregate_confidence`, `llm_bundle_hash`, `aggregate_metadata`, `status`, and `challenge_ends_at` when accepted into challenge period.
- Uses `aggregate_metadata.consensus_method = "adaptive_2_plus_1"`.

## Next Best Task

Recommended next task:

1. Apply `20260518010000_aio_adaptive_llm_metadata.sql` in Supabase SQL Editor.
2. Deploy `aio-verify` Edge Function and set the required secrets.
3. Add `/oracle` dashboard UI action to invoke `aio-verify` for submitted assertions.
4. Add AIO assertion submit form tied to `aio_assertions`.
5. Add Challenge/Finalize state UI.

## UI Rules

- Always read `docs/AGENT_DESIGN_SYNC.md` before frontend work.
- UI copy must use `src/shared/i18n/dictionaries.ts`.
- Do not hardcode Korean in `src/app` or `src/shared/components`.
- After UI work, run:

```bash
rg -n '"[^"]*[가-힣][^"]*"|>[^<]*[가-힣][^<]*<' src/app src/shared/components --glob '!**/*.sql'
npm run lint
npm run build
```
