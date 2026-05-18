# momment. AIO Attention Protocol Plan

문서 버전: v0.1  
기준 문서: `docs/moment_aio.md`  
목적: momment.에서 어텐션 생성, 어텐션 룰, AIO 검증, resolve가 하나의 프로토콜로 이어지도록 제품/DB/온체인 설계를 정리한다.

## 1. 핵심 정의

momment.의 AIO는 Polymarket의 `Rules + UMA Optimistic Oracle`에 해당하는 역할을 한다. 단, momment.는 베팅/거래 플랫폼이 아니므로 AIO는 “어텐션 커뮤니티가 어떤 현실 이벤트를 어떤 기준으로 검증하고 확정하는가”를 담당한다.

```txt
Attention
  -> Attention Rules
  -> Cases / Options
  -> AIO Assertion
  -> Evidence Lite
  -> Multi-LLM Verification
  -> Challenge Period
  -> Final Resolution
  -> Optional On-chain Seal
```

## 2. UMA와 AIO의 매핑

| UMA/Polymarket 구조 | momment. AIO 구조 |
| --- | --- |
| Market Rules | Attention Rules |
| Proposed answer/assertion | AIO Assertion |
| Bond | 정직 담보. 초기 MVP는 MOM_POINT 또는 mock bond |
| Dispute | AIO Challenge |
| Oracle evidence discussion | Evidence Lite + Publisher Registry + LLM provenance |
| Final settlement | AIO Resolution |
| On-chain oracle record | GIWA on-chain seal |

## 3. Attention 생성과 Rule 생성

어텐션은 반드시 resolve 기준을 가져야 한다. 초기에는 간단한 규칙이어도 된다.

필수 필드:

```txt
question
supported_outcomes
resolution_criteria
verification_deadline
builder_verification_window_seconds
open_verification_window_seconds
min_evidence_count
source_requirements
challenge_period_seconds
prompt_version
prompt_hash
```

예시:

```txt
Question:
2026년 6월 FOMC 이후 연준이 기준금리를 동결했는가?

Supported outcomes:
yes / no / ambiguous

Resolution criteria:
연준 공식 발표문 또는 주요 Tier 1 언론 보도를 근거로 확인한다.
이벤트 종료 전에는 AIO assertion을 제출할 수 없다.
```

## 4. AIO 플로우

### 4.1 Rule Draft

사용자 또는 admin이 어텐션 생성 시 rule draft와 케이스/옵션을 만든다. 이 시점에는 미래 결과를 증명하지 않는다. 아직 공식 발표나 최종 데이터가 존재하지 않을 수 있으므로, 생성 시점의 AIO 역할은 검증 가능한 질문 구조를 고정하는 것이다.

```txt
attention created
  -> attention_rules.status = draft
  -> supported_outcomes stored
  -> rule preview displayed
  -> admin/community review optional
  -> status = active
```

### 4.2 Verification Windows

검증 기준 시점이 지난 뒤에만 결과 assertion을 제출한다.

```txt
verification deadline reached
  -> builder verification window: 12h
  -> open verification window: 12h if builder does not submit
  -> challenge window: 24h after assertion
```

- `builder verification window`: 최초 빌더가 먼저 정확한 레퍼런스/출처와 AIO assertion을 제출할 권리를 갖는다.
- `open verification window`: 빌더가 제출하지 않으면 다른 유저가 제출할 수 있다.
- 이 권리는 베팅 우위가 아니라 어텐션을 만든 기여에 대한 oracle 작업 우선권이다.

### 4.3 Assertion

이벤트가 종료되었거나 claim 가능한 조건이 충족되면 유저가 assertion을 제출한다.

```txt
claim_text
asserted_outcome
evidence_urls
bond
```

MVP에서는 실제 USDC bond를 붙이지 않는다. `bond_currency = MOM_POINT` 또는 mock bond로 시작한다.

### 4.4 Evidence Lite

각 URL에 대해 아래를 저장한다.

```txt
url
canonical_url
title
publisher
publisher_domain
publisher_trust_weight
published_at
captured_at
content_hash
metadata_hash
screenshot_url / thumbnail_url
capture_node_signature
```

전문 저장은 하지 않는다.

### 4.5 Multi-LLM Verification

LLM은 다음을 검증한다.

```txt
RELEVANCE
SUPPORT
RECENCY
CONSISTENCY
STATEMENT
```

저장 항목:

```txt
model_id
provider
prompt_version
prompt_hash
input_hash
output_hash
full_trace_uri
verdict
confidence
reasoning_summary
raw_output
```

MVP 구현 기준은 `Gemini + GPT` 1차 비교 후, 불일치하거나 신뢰도가 낮을 때만 `xAI/Grok`을 타이브레이커로 호출하는 adaptive `2 + 1` 구조다. 결과적으로는 `Gemini + GPT + xAI` 3개 provider 기반 `2 of 3` 합의를 유지하되, 모든 케이스에서 3개 모델을 항상 호출하지 않는다.

권장 provider 구성:

```txt
gemini  -> fast / multimodal-friendly / cost-efficient first pass
gpt     -> general reasoning / structured JSON reliability
xai     -> Grok tie-breaker / contradiction and temporal logic checks
```

호출 순서:

```txt
step 1:
  call Gemini and GPT in parallel

step 2:
  if Gemini and GPT agree with confidence >= 0.70:
    accept 2 of 2 provisional consensus
    do not call xAI/Grok

step 3:
  call xAI/Grok only if:
    - Gemini and GPT verdict differ
    - asserted_outcome differs
    - either confidence < 0.70
    - either returns ambiguous / insufficient_evidence
    - either provider times out
    - JSON parsing/schema validation fails

step 4:
  aggregate as 2 of 3 if xAI/Grok was called
```

합의 규칙:

```txt
verdict enum:
  supports
  refutes
  ambiguous
  insufficient_evidence

acceptance:
  - Gemini와 GPT가 같은 asserted_outcome을 supports하고 평균 confidence >= 0.70
  - 또는 xAI/Grok 포함 3개 중 2개 이상 모델이 같은 asserted_outcome을 supports
  - supporting models 평균 confidence >= 0.70
  - evidence_count >= attention_rules.min_evidence_count
  - publisher trust / source requirements 통과

rejection:
  - 2개 이상 모델이 refutes
  - 또는 2개 이상 모델이 insufficient_evidence

manual_or_challenge_required:
  - 1 / 1 / 1 split
  - 2 of 3 합의는 있으나 평균 confidence < 0.70
  - Gemini/GPT 2 of 2 합의는 있으나 하나라도 confidence < 0.70
  - ambiguous가 2개 이상
  - 모델 출력 JSON 파싱 실패 또는 provider timeout이 2개 이상
```

저장 원칙:

- `aio_llm_verifications`에는 모델별 원본 verdict, confidence, reasoning summary, raw output/provenance를 모두 저장한다.
- aggregate 결과는 assertion/resolution metadata에 `consensus_method = "adaptive_2_plus_1"`로 저장한다.
- xAI/Grok을 호출하지 않은 케이스는 metadata에 `tie_breaker_called = false`, `provider_count = 2`를 남긴다.
- xAI/Grok을 호출한 케이스는 metadata에 `tie_breaker_called = true`, `provider_count = 3`을 남긴다.
- provider timeout이 1개인 경우 남은 2개가 같은 verdict이고 confidence floor를 넘으면 provisional consensus로 처리할 수 있다. 단, 고에너지 어텐션은 3개 모두 완료를 기다리거나 challenge window를 강제로 유지한다.
- 모델끼리 불일치한 케이스는 자동 확정하지 말고 challenge/manual review UI에 노출한다.
- LLM 합의는 최종 진실 그 자체가 아니라 AIO assertion의 1차 검증 레이어다. challenge window는 유지한다.

### 4.6 Challenge

Challenge period 동안 반박 가능하다.

```txt
counter_claim_text
counter_outcome
counter_evidence_urls
bond
```

반박 evidence도 같은 Evidence Lite + Multi-LLM 파이프라인을 탄다.

챌린지는 제거하지 않는다. Agentic Oracle이 1차 판정을 하더라도, 잘못된 레퍼런스·애매한 규칙·모델 오류를 막기 위한 인간/커뮤니티 감사 레이어가 필요하다. 단, 챌린지 보상은 결과 예측 보상이 아니라 oracle 정직성 보상이어야 한다.

MVP guardrail:

```txt
minimum_mom_energy = 100
minimum_trust_score = 1
minimum_account_age = 24h
challenge_cost = 25 MOM Energy
max_daily_challenges = 5
one_challenge_per_assertion_per_user = true
```

제출은 `submit_aio_challenge()` RPC로만 허용한다. 직접 insert는 RLS 정책에서 막고, RPC가 자격 확인과 MOM Energy 차감을 원자적으로 처리한다.

결과 처리:

- accepted: 담보 25 환급 + 25 MOM Energy oracle contribution 보상 + Trust Score `+0.25`
- rejected: 담보 소각 + Trust Score `-0.1`
- challenge 결과는 oracle 정직성 평가이지 사용자가 선택한 케이스를 맞혔다는 보상이 아니다.

### 4.7 Final Resolution

Challenge가 없거나, challenge가 기각/처리되면 final resolution을 만든다.

```txt
final_outcome
resolution_text
resolution_hash
evidence_bundle_hash
llm_bundle_hash
challenge_summary
onchain_tx_hash
```

## 5. DB Migration

현재 AIO 프로토콜 스키마는 다음 migration으로 추가한다.

```txt
supabase/migrations/20260516020000_aio_protocol.sql
supabase/migrations/20260517090000_aio_challenge_mvp_guardrails.sql
```

주요 테이블:

```txt
aio_rule_templates
attention_rules
publisher_registry
aio_assertions
aio_evidence_items
aio_llm_verifications
aio_challenges
aio_resolutions
```

## 6. On-chain 단계

초기 MVP는 off-chain DB + mock on-chain preview로 시작한다. 이후 GIWA에 아래 해시만 seal한다.

```txt
rule_hash
assertion_hash
evidence_bundle_hash
llm_bundle_hash
resolution_hash
```

체인에 전문/기사 원문/LLM 전문을 올리지 않는다. 원문은 IPFS 또는 내부 스토리지에 두고, 체인에는 해시와 provenance만 기록한다.

## 7. 제품 UI 순서

UI 작업 전에는 반드시 `docs/AGENT_DESIGN_SYNC.md`를 읽는다.

추천 순서:

1. `/attentions/new`에 rule draft 섹션 추가
2. Attention detail에 `Rules` 탭 추가
3. `/oracle`을 AIO Dashboard로 확장
4. assertion 제출 mock form
5. evidence capture mock result
6. LLM verification mock result
7. challenge/finalize state machine

## 8. 중요한 제품 경계

- momment. 안에서 사용자는 실돈으로 결과에 베팅하지 않는다.
- AIO bond는 예측 베팅금이 아니라 정직 담보다.
- MVP에서는 실제 bond 결제 없이 mock 또는 MOM_POINT로 표현한다.
- AIO는 미래 예측이 아니라 이미 발생한 사실의 확인 인프라다.
- 외부 마켓의 UMA/rules 정보는 참고 metadata이고, momment.의 canonical resolve는 AIO rule과 AIO resolution을 따른다.
