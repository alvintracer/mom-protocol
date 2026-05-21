# momment. 토픽 & 태깅 시스템 아키텍처

> 최종 업데이트: 2026-05-21

## 개요

momment.의 토픽 시스템은 **정형화된 토픽 풀 + LLM 자동 태깅 + 유저 선택**의 3계층 구조로, 모든 포스트에 구조화된 메타데이터를 부여합니다. 이 메타데이터는 추천, 탐색, 트렌딩, 광고 타겟팅의 기반이 됩니다.

---

## 1. 데이터 모델

### `topics` 테이블 (마스터)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `slug` | TEXT (UNIQUE) | 영문 lowercase slug — 시스템 전체 식별자 |
| `kind` | ENUM | `category` · `entity` · `ai_keyword` · `user_hashtag` · `source_platform` |
| `canonical_label` | TEXT | 영문 대표 라벨 (Bitcoin, UFC 등) |
| `labels` | JSONB | 다국어 라벨 `{"ko":"비트코인","en":"Bitcoin","es":"Bitcoin"}` |
| `description` | TEXT | 토픽 설명 (optional) |
| `created_by` | UUID | 생성자 (NULL = system/LLM) |

### `content_topics` 테이블 (조인)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `topic_id` | UUID → topics | FK |
| `target_type` | ENUM | `post` · `attention` · `comment` · `source` |
| `target_id` | UUID | 대상 ID |
| `source` | TEXT | `user` · `llm` · `admin` · `system` |
| `confidence` | NUMERIC | LLM 신뢰도 (0.0–1.0) |
| `model` | TEXT | 사용한 모델 (e.g., `gpt-4o-mini`) |

**Unique Constraint**: `(topic_id, target_type, target_id, source)`

---

## 2. 토픽 종류 (`kind`)

```
category        상위 카테고리 (예: Blockchain, Sports, Politics)
                └─ 1개 포스트에 보통 1개
                
entity          고유명사 (예: Bitcoin, UFC, Trump, Tesla)
                └─ 사람, 회사, 리그, 프로토콜 등
                
ai_keyword      주제 키워드 (예: DeFi, Staking, Election)
                └─ LLM이 주로 생성
                
user_hashtag    유저가 직접 생성한 해시태그
                └─ 현재 비활성 (유저는 기존 토픽에서만 선택)
                
source_platform 출처 플랫폼 (예: polymarket, twitter)
                └─ 크롤링/연동 시 자동 부여
```

---

## 3. 태깅 파이프라인

### 3.1 포스트 작성 시 흐름

```
유저가 글 작성 → [게시] 클릭
       │
       ├─① posts INSERT (즉시)
       │
       ├─② 유저 선택 토픽 INSERT (즉시)
       │   └─ 유저가 토픽 피커에서 선택한 토픽들
       │   └─ content_topics에 source='user', confidence=1.0
       │
       ├─③ 번역 큐 등록 (즉시)
       │   └─ enqueue_missing_translations_for_post()
       │
       └─④ LLM 자동 태깅 (비동기, fire-and-forget)
           └─ POST /api/posts/auto-tag { postId }
           └─ 1~3초 후 완료
```

### 3.2 LLM 자동 태깅 상세 (`/api/posts/auto-tag`)

```
1. postId로 포스트 조회
2. HTML이면 태그 제거 → 순수 텍스트 추출
3. topics 테이블에서 상위 300개 기존 토픽 slug 목록 로드
4. GPT-4o-mini 호출 (temperature=0.1, json_object mode)
5. 응답 파싱 → 최대 5개 토픽
6. 각 토픽:
   ├─ slug 정규화 (lowercase, 특수문자 제거)
   ├─ topics UPSERT (새 토픽이면 자동 생성)
   └─ content_topics INSERT (source='llm')
7. 포스트 auto_tag_status = 'done'
```

### 3.3 LLM 프롬프트 핵심 규칙

| 규칙 | 설명 |
|------|------|
| **기존 토픽 우선** | 기존 slug 목록을 프롬프트에 포함, 매칭 우선 |
| **새 토픽 생성 가능** | 기존에 없으면 새 slug 생성 (3개국어 라벨 필수) |
| **너무 일반적 ❌** | `news`, `post`, `update` 등 금지 |
| **너무 구체적 ❌** | `bitcoin-price-may-21-2026` 등 금지 |
| **카테고리 1개 + 키워드/엔티티 최대 4개** | 총 5개 이내 |
| **confidence 포함** | 각 토픽에 0.0–1.0 신뢰도 |

### 3.4 어텐션 클러스터 태깅

어텐션 클러스터에도 동일한 `content_topics` 구조로 태깅 가능:

```
content_topics.target_type = 'attention'
content_topics.target_id = attention_cluster.id
```

현재는 어텐션의 `slug`/`category`를 피드에서 `autoTags`로 fallback 사용.

---

## 4. 토픽 소스별 비교

| 소스 | 시점 | 신뢰도 | 생성 주체 | 새 토픽 생성 |
|------|------|--------|----------|------------|
| **user** | 포스트 작성 시 | 1.0 (확정) | 유저 선택 | ❌ 기존 토픽만 |
| **llm** | 포스트 작성 직후 (비동기) | 0.5–1.0 | GPT-4o-mini | ✅ 자동 생성 |
| **admin** | 관리자 수동 | 1.0 | 관리자 | ✅ |
| **system** | 시스템 자동 | varies | 배치/트리거 | ✅ |

---

## 5. 프론트엔드 표시

### 피드 카드 (SocialPostCard)

```
#Bitcoin  #DeFi  #ETF          ← 파란색: user 태그
#crypto-regulation  #staking   ← 회색: llm/auto 태그
```

- `userTags`: `source='user'`인 토픽의 `canonical_label`
- `autoTags`: `source='llm'`인 토픽 또는 어텐션 slug fallback

### 포스트 상세 페이지

- 타임스탬프 아래에 모든 토픽 칩 표시
- 클릭 시 `/topic/[slug]` 페이지로 이동
- user 태그 = 파란, llm 태그 = 회색

### 포스트 작성 페이지

- 토픽 피커: 검색 입력 → topics 테이블 쿼리 → 드롭다운 → 칩 선택
- 최대 5개
- 유저는 새 토픽 직접 생성 불가 → 정형화 유지

---

## 6. 시드 토픽 카테고리

초기 ~170개 토픽이 시드됨:

| 카테고리 | 예시 토픽 | 개수 |
|----------|----------|------|
| Crypto & Blockchain | bitcoin, ethereum, defi, nft, web3 | 22 |
| Investing & Economy | stock-market, real-estate, etf, inflation | 16 |
| Technology | ai, semiconductors, ev, cybersecurity | 11 |
| Tech Companies | apple, google, nvidia, tesla, openai | 9 |
| Gaming | esports, steam, mmorpg, indie-games | 12 |
| MMA / Fighting | ufc, boxing, jiu-jitsu, muay-thai | 7 |
| Soccer | premier-league, la-liga, k-league, transfer | 11 |
| NBA | nba, nba-playoffs, nba-draft, nba-trade | 4 |
| Baseball | mlb, kbo, npb, world-series | 5 |
| Other Sports | tennis, golf, f1, nfl, olympics | 7 |
| Politics | us-politics, korea-politics, election, trump | 9 |
| Entertainment | movies, kpop, kdrama, anime, netflix | 10 |
| Lifestyle | food, travel, fitness, fashion, career | 10 |
| Science | climate, biotech, medicine, astronomy | 6 |
| Society | environment, crime, breaking-news, controversy | 7 |
| Prediction Market | market-analysis, technical-analysis, whale-alert | 6 |

---

## 7. 자정 작용 (향후)

### 7.1 토픽 병합

```
관리자 → 중복 토픽 발견 (예: "btc"와 "bitcoin")
       → slug "btc"를 "bitcoin"으로 병합
       → content_topics의 topic_id 일괄 업데이트
       → "btc" 토픽 삭제 또는 alias 처리
```

### 7.2 주기적 LLM 정리 (배치)

```
매주 1회:
  1. 사용 빈도 0인 토픽 삭제 또는 비활성화
  2. 유사 slug 감지 (edit distance) → 병합 제안
  3. 트렌딩 토픽 스냅샷 생성 (topic_trend_snapshots)
```

---

## 8. RLS 정책

| 테이블 | 작업 | 정책 |
|--------|------|------|
| `topics` | SELECT | 전체 공개 |
| `topics` | INSERT/UPDATE | service_role only (LLM API) |
| `content_topics` | SELECT | 전체 공개 |
| `content_topics` | INSERT | `source='user' AND target_type='post' AND 본인 포스트` |

---

## 9. 비용 추정

| 항목 | 비용 |
|------|------|
| GPT-4o-mini 포스트 1건 | ~$0.0005–$0.001 |
| 일 1,000건 | ~$0.50–$1.00 |
| 월 30,000건 | ~$15–$30 |

기존 토픽 목록(300개)을 프롬프트에 포함해도 입력 토큰 ~2K 수준으로 비용 미미.
