# momment. Supabase Content Translation Plan

문서 버전: v0.1  
목적: 유저 게시물/댓글을 원문 그대로 보존하면서, 유저 설정 언어에 맞춰 자연스럽게 번역된 콘텐츠를 보여주기 위한 Supabase 설계 기준을 정리한다.

## 1. 핵심 원칙

- 유저가 작성한 게시물과 댓글의 원문은 절대 덮어쓰지 않는다.
- 원문 언어는 `original_language`로 저장한다.
- 번역문은 원문과 별도 테이블에 저장한다.
- 사용자의 `preferred_language`에 맞는 번역이 있으면 번역문을 보여주고, 없으면 원문을 보여준다.
- 번역문은 UI 언어팩이 아니라 사용자 생성 콘텐츠 캐시이다.
- LLM 번역은 “마치 해당 언어권 사용자가 자연스럽게 쓴 것처럼” 읽히는 것을 목표로 한다.

## 2. 적용된 Migration

현재 초기 스키마는 아래 파일에 있다.

```txt
supabase/migrations/20260516000000_initial_moment_schema.sql
```

포함된 주요 테이블:

```txt
profiles
wallets
events
event_translations
predictions
evidence
posts
post_original_versions
post_translations
comments
comment_original_versions
comment_translations
translation_jobs
translation_batches
contributions
reward_pools
reward_allocations
```

## 3. 게시물 저장 흐름

1. 사용자가 게시물을 작성한다.
2. 앱 또는 서버 액션이 원문 언어를 감지하거나 사용자의 현재 언어를 기본값으로 사용한다.
3. `posts.original_title`, `posts.original_body`, `posts.original_language`, `posts.original_hash`를 저장한다.
4. DB trigger가 `post_original_versions`에 version `1`을 생성한다.
5. 업로드 요청에서는 LLM을 호출하지 않는다.
6. `posts.translation_status = pending` 상태로 둔다.
7. 배치 생성 함수 또는 scheduled worker가 원문 언어가 아닌 지원 언어별로 `translation_jobs` row를 만든다.
8. 별도 worker 또는 Edge Function이 jobs를 처리해 `post_translations`에 저장한다.

## 4. 댓글 저장 흐름

1. 사용자가 댓글을 작성한다.
2. `comments.original_body`, `comments.original_language`, `comments.original_hash`를 저장한다.
3. DB trigger가 `comment_original_versions`에 version `1`을 생성한다.
4. 업로드 요청에서는 LLM을 호출하지 않는다.
5. `comments.translation_status = pending` 상태로 둔다.
6. 배치 생성 함수 또는 scheduled worker가 지원 언어별로 `translation_jobs` row를 만든다.
7. 번역 완료 후 `comment_translations`에 저장한다.

## 4.1 Batch Translation Strategy

번역은 실시간 업로드 요청 안에서 처리하지 않는다. 기본 전략은 배치 처리다.

```txt
user upload
  -> original content saved immediately
  -> translation_status = pending
  -> no LLM call in request path
  -> scheduled batch creates translation_jobs
  -> worker processes jobs in chunks
  -> translation cache is updated
```

이 방식의 장점:

- 글/댓글 작성 UX가 빠르다.
- LLM 장애가 게시물 작성 실패로 이어지지 않는다.
- 인기 콘텐츠, 최신 콘텐츠, 미번역 콘텐츠를 우선순위로 처리할 수 있다.
- 같은 콘텐츠를 중복 번역하지 않는다.
- 비용을 시간대별, 언어별, 콘텐츠 타입별로 제어할 수 있다.

현재 스키마는 이를 위해 아래 구조를 포함한다.

```txt
translation_batches
translation_jobs.batch_id
translation_jobs.priority
translation_jobs.scheduled_at
translation_jobs.next_attempt_at
translation_jobs.max_attempts
translation_jobs.locked_by
```

번역 worker는 같은 배치에서 topic extraction도 함께 수행할 수 있다. 유저가 직접 입력한 해시태그는 `source = user`, LLM이 추출한 키워드/엔티티/카테고리는 `source = llm`으로 저장한다. 관련 schema는 `supabase/migrations/20260516010000_attention_topics_and_discovery.sql`에 둔다.

추천 배치 정책:

- 신규 게시물: 1-5분 단위 배치로 처리
- 신규 댓글: 5-15분 단위 배치로 처리
- 조회수가 높은 콘텐츠: `priority`를 낮은 숫자로 올려 빠르게 처리
- 오래된 콘텐츠 backfill: 야간 또는 저비용 시간대에 큰 batch로 처리
- 실패 job: exponential backoff로 `next_attempt_at` 갱신
- 번역 지원 언어 추가 시: 기존 콘텐츠에 대해 backfill batch 생성

업로드 시 즉시 job을 만들지, 배치가 나중에 job을 만들지는 운영 정책으로 선택할 수 있다. 다만 어떤 경우에도 업로드 요청에서 LLM 번역 자체는 호출하지 않는다.

## 5. 조회 흐름

사용자의 표시 언어가 `en`인 경우:

1. `posts` 또는 `comments`를 가져온다.
2. `post_translations.language = 'en'` 또는 `comment_translations.language = 'en'`을 우선 조회한다.
3. 번역 상태가 `translated` 또는 `needs_review`이고 body가 있으면 번역문을 보여준다.
4. 번역이 없으면 원문을 보여준다.
5. 필요하면 조회 이벤트를 기반으로 priority를 올리거나 `translation_jobs`를 enqueue한다.

## 6. LLM 번역 지침

번역 worker는 다음 원칙을 따른다.

- 원문의 의미를 보존한다.
- 직역투를 피하고 해당 언어권 커뮤니티에서 자연스럽게 보이는 문체를 사용한다.
- 투자 조언, 확정적 결과 단정, 베팅 유도처럼 보이는 표현을 만들지 않는다.
- 원문에 없는 사실을 추가하지 않는다.
- 욕설, 위험 표현, 민감한 표현은 정책에 맞게 처리하되 원문 보존 테이블은 훼손하지 않는다.

## 7. 향후 작업

- Supabase SQL Editor 또는 CLI로 migration 적용
- `supabase gen types typescript` 기반 자동 타입 생성으로 `src/shared/types/database.ts` 교체
- 게시물/댓글 작성 server action 추가
- 번역 job enqueue 함수 또는 scheduled batch 추가
- OpenAI 또는 선택 LLM provider 기반 batch translation worker 추가
- 표시 언어별 content fallback helper 추가
