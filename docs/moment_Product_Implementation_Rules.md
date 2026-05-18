# momment. Product Implementation Rules

문서 버전: v0.1  
목적: Codex 및 다른 개발 에이전트가 서비스명, 심볼명, 다국어 UI, 모바일 웹 기준을 일관되게 적용하도록 한다.

## 1. Naming

- 서비스명은 `momment.`이다. 항상 소문자이며 마지막 마침표를 포함한다.
- 심볼명은 `MOM`이다.
- 사용자에게 보이는 브랜드 카피, 페이지 타이틀, 네비게이션, 설명 문구에서는 `MOM` 대신 `momment.`를 사용한다.
- 예외: `MOM Energy`, `MOM 포인트`, 토큰 심볼, 컨트랙트명, 심볼을 의미하는 기술 식별자는 `MOM`을 유지한다.

## 1.1 momment vault

- 매월 1일 Contribution Ratio 기준으로 분배 예정인 플랫폼 리워드 풀은 `momment vault` 또는 `월간 vault`로 표현한다.
- vault는 베팅 배당, odds 기반 보상, ROI, 유저 스테이크가 아니다. 구독, 부스트, 슈퍼 댓글, 스폰서 캠페인, 이벤트룸, 데이터/API, 광고 슬롯 등 플랫폼 수익 일부를 MOM Energy 기반 Contribution Ratio로 나누기 위한 투명성 지표이다.
- 실제 정산 연동 전까지 UI는 월간 분배 예정 vault, 누적 vault, 누적 분배액, 유입 비중, 다음 분배일, 활성 기여자를 mock data로 보여준다.

## 2. Product Positioning

- momment.는 사용자가 금전을 걸고 베팅하는 예측시장이 아니다.
- momment.는 글로벌 예측시장과 현실 이벤트 위의 Event Attention SocialFi 및 AI Oracle Layer이다.
- 예측, 근거, 토론, 확산 기여도를 기반으로 Contribution Ratio와 Reward Pool을 보여준다.
- 실제 결제, Supabase, thirdweb, GIWA, 온체인 연동은 별도 스프린트 전까지 mock UI와 mock data로 유지한다.

## 3. Internationalization

- 기본 언어는 한국어이다.
- 현재 지원 언어팩은 한국어, 영어, 스페인어이다.
- 추가 언어를 쉽게 넣을 수 있어야 한다.
- 새 UI 문구는 하드코딩하지 말고 `src/shared/i18n/dictionaries.ts`에 추가한다.
- 도메인 mock data의 제목, 설명, 출처, 근거 문구는 `src/shared/i18n/config.ts`의 `text(ko, en, es)` helper를 사용한다.
- 컴포넌트에서는 `useI18n()`의 `t()`로 문구를 렌더링한다.
- 언어 선택은 전역 상태와 `localStorage`에 저장되어 페이지 전반에 적용되어야 한다.
- `src/app` 및 `src/shared/components`에 사용자에게 보이는 한국어 문자열을 직접 남기지 않는다.
- UI 변경 후 다음 검사를 실행해 직접 하드코딩된 한국어가 남아있지 않은지 확인한다.

```bash
rg -n '"[^"]*[가-힣][^"]*"|>[^<]*[가-힣][^<]*<' src/app src/shared/components --glob '!**/*.sql'
```

## 3.1 User Generated Content Translation

- 사용자 게시물과 댓글은 UI 언어팩과 다르게 취급한다.
- 원문은 `posts.original_*`, `comments.original_*`에 보존한다.
- 첫 저장 원문은 `post_original_versions`, `comment_original_versions`에도 남긴다.
- LLM 번역문은 `post_translations`, `comment_translations`에 언어별로 저장한다.
- 업로드 요청에서 LLM 번역을 직접 호출하지 않는다.
- 번역 작업은 `translation_batches`와 `translation_jobs` 큐에 저장하고 별도 worker 또는 Edge Function이 배치로 처리한다.
- 유저 설정 언어에 맞는 번역이 있으면 번역문을 보여주고, 없으면 원문을 fallback으로 보여준다.
- 자세한 설계는 `docs/moment_Supabase_Content_Translation_Plan.md`를 따른다.

## 4. Mobile Web

- 모든 신규 페이지와 컴포넌트는 모바일 웹 뷰를 우선 고려한다.
- 사이드바가 숨겨지는 화면에서도 핵심 이동 경로가 있어야 한다.
- 버튼, 셀렉트, 카드, 하단 네비게이션은 터치하기 충분한 높이를 가져야 한다.
- 긴 한국어/영어/스페인어 문구가 카드나 버튼 밖으로 넘치지 않도록 responsive grid, wrapping, truncate, min-width 처리를 확인한다.
- 데스크톱 전용 레이아웃을 만들 때도 모바일 대체 레이아웃을 함께 구현한다.

## 5. Post Creation UX

- 포스트 작성은 `/posts/new`를 단일 정식 플로우로 사용한다.
- 홈, 어텐션 상세, 프로필 등에서 포스트 작성이 필요하면 별도 축소 작성기를 만들기보다 `/posts/new`로 이동한다.
- 특정 어텐션에서 작성할 때는 `/posts/new?attention=<attention_id 또는 slug>`로 진입시킨다.
- 작성 페이지는 어텐션을 자동 선택하고, 선택된 어텐션의 케이스/옵션을 `attention_rules.supported_outcomes`에서 불러온다.
- 어텐션 선택 표시 형식은 `어텐션 제목 (a/slug)`이다.
- 케이스 선택은 `posts.selected_outcome`에 저장한다. 이 값은 의견/근거 분류용이며 베팅 포지션, 예측 적중 보상, 수익률 계산 기준으로 사용하지 않는다.
- 첨부 미디어는 이미지/오디오 최대 5개, 총합 50MB 미만으로 제한한다.
- 포스트 미디어는 Supabase Storage `post-media` 버킷을 사용하고, 공개 URL/경로/타입/크기를 `posts.media_items`에 저장한다.

## 6. Current MVP Surface

현재 MVP 화면/흐름은 아래를 기준으로 한다.

- `/`: Supabase 기반 홈 피드
- `/explore`: 어텐션 탐색, 인기 토픽, 카테고리
- `/attentions/new`: Attention Builder의 만들기/가져오기
- `/a/[slug]`: 어텐션 상세, Join, 케이스, 출처, 관련 포스트
- `/topic/[slug]`: Topic Energy와 관련 어텐션
- `/posts/new`: 통합 포스트 작성
- `/posts/[postId]`: 포스트 상세, 리플라이, 리포스트/quote, 좋아요, 조회
- `/profile`, `/u/[handle]`: 내 프로필/공개 프로필
- `/rewards`: momment vault
- `/oracle`: AIO/Challenge 정책 mock UI
