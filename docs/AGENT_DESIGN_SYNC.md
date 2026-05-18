# momment. AGENT DESIGN SYNC

> **대상**: Codex 및 기타 AI 에이전트  
> **목적**: Antigravity 에이전트가 설정한 디자인 원칙과 아키텍처를 동기화하여 향후 UI/기능 개발 시 일관성을 유지하기 위함.

## 1. 아이콘 라이브러리 규칙
- **절대 사용 금지**: `lucide-react` (프로젝트에서 완전히 제거되었습니다. 특히 `Sparkles` 아이콘 등 LLM 특유의 아이콘은 사용하지 마세요).
- **사용 패키지**: `react-icons/ri` (Remix Icons)를 최우선으로 사용합니다. 프리미엄하고 깔끔한 라인/채움 아이콘 셋이 프로젝트 무드에 맞습니다.

## 2. 디자인 및 테마 시스템 (Dark/Light Mode)
- **next-themes 연동**: 이미 최상단 레이아웃에 `ThemeProvider`가 셋업되어 다크 모드를 완벽 지원합니다.
- **Tailwind 색상 규칙**: 
  - 하드코딩된 색상(예: `bg-white`, `text-zinc-950`) 대신 테마 변수를 활용하세요.
  - 배경은 `bg-background`, 기본 텍스트는 `text-foreground`, 서브 텍스트는 `text-muted-foreground`, 보더는 `border-border`를 기본으로 합니다.
  - 카드의 호버 효과에는 `hover:bg-zinc-50 dark:hover:bg-zinc-900/50` 같은 부드러운 전환을 추천합니다.

## 3. UI 레이아웃 컨셉 (Medium + Twitter/Claude 믹스)
- **구조**: `AppShell`은 트위터처럼 3단 레이아웃(좌측 네비게이션, 중앙 피드, 우측 트렌드/검색)으로 구성되어 있습니다.
- **여백과 타이포그래피**: 빽빽하게 붙이는 대신 여백(padding/margin)을 넓게 쓰고, 폰트 웨이트(bold, black)를 명확히 대비시켜 "읽기 좋은(Medium 스타일)" UI를 유지하세요.
- **포스트 디테일 페이지**: 
  - 특정 어젠다를 좌우로 억지로 쪼개지 말고, 아래로 자연스럽게 스택되는 블로그/스레드 형태를 지향합니다.
  - 외부 예측 시장(예: Polymarket)의 연동 정보(거래량, 플랫폼 수 등)와 YES/NO 투표 버튼(비환금성 플랫폼 투표용)을 UI에 녹여냅니다.
  - 실제 결제나 베팅은 우리 플랫폼이 아닌 외부 링크(`RiExternalLinkLine`)를 통해서만 진행되는 UX 구조입니다.

## 4. 네비게이션 및 i18n
- **탭/메뉴**: "추천(For You)", "팔로잉(Following)" 위주로 탭을 구성합니다. ("내 포지션" 등 직접적인 베팅 용어 지양)
- **사전 동기화**: `src/shared/i18n/dictionaries.ts` 내에 새로운 다국어 문자열을 추가하고 `t(dictionary.category.key)` 형식으로 사용합니다.
- **하드코딩 금지**: 사용자에게 보이는 신규 UI 문구는 한국어/영어/스페인어 모두 사전에 추가해야 합니다. `src/app`과 `src/shared/components`에 한국어 문자열을 직접 남기지 않습니다.
- **검증 명령**: UI 작업 후 아래 명령으로 하드코딩 한국어가 남았는지 확인하세요.

```bash
rg -n '"[^"]*[가-힣][^"]*"|>[^<]*[가-힣][^<]*<' src/app src/shared/components --glob '!**/*.sql'
```

## 5. momment vault / 리워드 표현
- **용어**: 매월 1일 Contribution Ratio에 따라 분배 예정인 플랫폼 누적 리워드 풀은 `momment vault` 또는 `월간 vault`로 표현합니다.
- **의미**: vault는 베팅 배당이나 수익률이 아니라, 구독·부스트·슈퍼 댓글·스폰서 캠페인 등 플랫폼 수익 일부를 MOM Energy 기반 Contribution Ratio로 나누기 위한 투명성 지표입니다.
- **UI 배치**: PC에서는 우측 사이드바 상단에 compact vault 게이지를 노출하고, 상세 화면은 `/rewards`의 Vault 대시보드에서 누적 vault, 이번 달 분배 예정액, 유입 비중, Contribution Ratio 보드를 보여줍니다. 모바일에서는 하단 네비게이션의 Vault 탭을 통해 접근 가능해야 합니다.
- **DB 원장**: 플랫폼 수익은 `platform_revenue_ledger`에 기록하고, `platform_vault_overview` 및 `platform_vault_source_mix_current` view로 UI에 반영합니다. NOWPayments로 유저가 MOM Energy를 구매하면 `payments` 완료 처리 후 자동으로 vault 원장에 기록됩니다. AdSense, 직접 입금 광고주 매출, 캠페인 매출은 `/api/platform-revenue` 서버 route 또는 batch job이 `record_platform_revenue` RPC를 호출해 기록합니다.

## 6. Attention Builder
- **대응 개념**: Polymarket의 Builder/Market Creation에 대응되는 momment. 기능은 `Attention Builder`입니다.
- **차이점**: momment. Attention Builder는 거래 마켓을 생성하지 않습니다. 질문, 외부 출처, 근거, 검증 시점, AIO 기준을 묶는 기준점을 만듭니다.
- **플로우**: `/attentions/new`에서 `만들기`와 `가져오기` 두 모드를 제공합니다. `만들기`는 momment. native attention, 케이스/옵션, 검증 기준 시점, AIO rule draft를 만들고, `가져오기`는 Polymarket/Kalshi/Manifold 등 외부 마켓 링크에서 rules/oracle metadata를 가져와 하나의 어텐션으로 통합하는 UX를 유지합니다.
- **케이스/옵션**: 어텐션은 반드시 가능한 결과 케이스를 가져야 합니다. 예: YES/NO, 한화/기아/삼성/LG, 가격 범위 등. 케이스 선택은 의견/근거 분류이지 베팅 포지션이 아닙니다.
- **검증 타이밍**: 생성 시점에는 미래 결과를 증명하지 않습니다. 생성 시점에는 질문, 케이스, 검증 기준 시점, 잠정 해결 기준만 고정합니다. 검증 기준 시점 이후 AIO assertion과 실제 레퍼런스/출처를 제출합니다.
- **AIO 제출 권한**: MVP 기본값은 `빌더 검증 시간 12시간 -> 오픈 검증 시간 12시간 -> 챌린지 시간 24시간`입니다. 초기 빌더가 먼저 AIO를 제출할 권리를 갖고, 미제출 시 자격 있는 유저가 제출할 수 있게 합니다. 고에너지 어텐션은 이 시간을 자동 확장할 수 있습니다.
- **Challenge**: 챌린지는 제거하지 않습니다. 다만 예측 결과를 맞춘 보상이 아니라 잘못된 oracle assertion을 막는 감사 레이어로 둡니다. MVP 기준 챌린지는 최소 `100 MOM Energy`, `계정 생성 24시간+`, `하루 5회 제한`, `동일 assertion당 1회`를 통과해야 하며, 제출 시 `25 MOM Energy`를 정직 담보로 소모합니다. 유효한 챌린지는 담보 환급 + oracle contribution 보상, 악성/실패 챌린지는 담보 소각으로 처리합니다. Trust Score는 폐기되었으며, MOM Energy 하나로 모든 자격을 통합합니다. Builder 권한은 별도 등급 없이 **누구나** 어텐션을 생성하고 AIO 규칙을 설정할 수 있습니다.

## 7. Topic-first Attention Graph
- **구조 비유**: momment.의 `attention`은 Polymarket의 market처럼 질문형 이벤트 단위에 가깝습니다. 단, 거래/베팅 단위가 아니라 “검증 시점이 있는 관심 이벤트”입니다. Reddit식 장기 커뮤니티 역할은 `Topic`이 맡습니다.
- **핵심 계층**: `Topic > Attention > Post`를 기본으로 합니다. 예: `#bts` Topic 아래에 “BTS가 2026년 6월에 컴백하는가?” Attention이 있고, 그 아래에 관련 포스트와 리플라이가 쌓입니다. 하나의 Attention은 여러 Topic에 연결될 수 있습니다.
- **라우팅 규칙**: 어텐션 상세는 `/a/[slug]`, 유저 공개 프로필은 `/u/[handle]`, 내 프로필 편집은 `/profile`, 어텐션 탐색은 `/explore`, 어텐션 생성은 `/attentions/new`를 사용합니다.
- **프로필 UX**: 프로필은 Twitter/X식 자기 홍보 페이지보다 Reddit식 활동 기록에 가깝게 설계합니다. 공개 프로필과 내 프로필 모두 “작성한 글”, “댓글/활동”, “만든 a/ Attentions”, “기여 지표”가 중심이어야 합니다.
- **탐색 UX**: Explore/어텐션 탐색 화면에서는 제목/설명으로 기능을 설명하기보다, 검색, 인기 어텐션, 인기 키워드, 카테고리, join/follow 상태 같은 컨텐츠 자체로 화면 목적이 드러나야 합니다.
- **Attention Detail**: 어텐션 상세 페이지는 질문, 검증 기준 시점, AIO 기준, 출처, 현재 참고 신호, 관련 포스트를 한 화면에서 보여주는 이벤트 페이지입니다. 장기 커뮤니티 설명보다 “무엇을 언제 어떻게 검증하는가”가 먼저 보여야 합니다.
- **Post Graph**: 자세한 데이터/UX 원칙은 `docs/moment_Attention_Post_Graph_Plan.md`를 따른다. 어텐션을 첨부한 post는 해당 attention 아래에 쌓이고, 첨부하지 않은 post는 global/free post로 홈 피드에 남긴 뒤 LLM/배치가 추후 어울리는 Topic/Attention 후보를 추천할 수 있게 한다.
- **토픽 클러스터링**: LLM/배치가 포스트와 어텐션에서 자동 토픽을 추출합니다. 같은 Topic에 속한 Attention들은 Topic 페이지에서 모아 보여주고, 필요 시 동일 이벤트로 판단되는 Attention끼리만 내부 canonical cluster로 묶습니다.
- **Topic Energy**: Topic Energy는 해당 Topic에 연결된 Attention들의 Energy 합으로 표시합니다. Topic 자체가 별도 베팅/거래 단위가 되면 안 됩니다.
- **용어 계층**: 사용자에게 보이는 최상위 탐색 단위는 `Topic`, 검증 대상은 `Attention`, 외부 링크/공식 문서/타 플랫폼 항목은 `Source`, 사용자 발화는 `Post/Reply`로 구분합니다. `Attention Cluster`는 중복/동일 이벤트 merge를 위한 내부 백엔드 용어로 두고 UI에 직접 노출하지 않습니다.

## 8. Current Implementation Snapshot

다른 에이전트는 아래 상태를 전제로 이어서 작업하세요.

- 서비스명은 `momment.`로 적용되었습니다. `MOM Energy`, `MOM 포인트`처럼 심볼 의미일 때만 `MOM`을 유지합니다.
- 주요 라우트는 `/`, `/explore`, `/attentions/new`, `/a/[slug]`, `/topic/[slug]`, `/posts/new`, `/posts/[postId]`, `/profile`, `/u/[handle]`, `/rewards`, `/oracle`입니다.
- `/markets`는 과거 호환 라우트로 남아있을 수 있으나 신규 UI/링크는 `/explore`를 사용합니다.
- `/explore`는 Polymarket식 박스형 탐색 화면에 가깝게, 인기 어텐션/토픽/카테고리 중심으로 구성합니다.
- `/a/[slug]`는 인라인 포스트 작성기를 갖지 않습니다. 어텐션 상세에서 포스트 작성은 `/posts/new?attention=<attention_id>`로 이동시키고, 작성 페이지에서 어텐션과 케이스를 자동 선택/표시합니다.
- `/posts/new`가 단일 정식 포스트 작성 플로우입니다. 어텐션 선택, 케이스 선택, 타이틀/바디, 이미지/오디오 최대 5개 및 총 50MB 제한, 링크 미리보기, 드래프트 저장을 담당합니다.
- 포스트 미디어는 Supabase Storage `post-media` 버킷에 업로드하고, 공개 URL/경로 메타데이터를 `posts.media_items`에 저장합니다.
- 어텐션 케이스/옵션은 `attention_rules.supported_outcomes`에서 읽어 `posts.selected_outcome`에 저장합니다. 케이스 선택은 의견/근거 분류이며 베팅 포지션이 아닙니다.
- 포스트 상세 `/posts/[postId]`는 리플라이, 리포스트/quote, 좋아요, 조회 수 표시를 담당합니다.
- 홈 피드는 Supabase `posts`를 사용하며, 어텐션 첨부 포스트는 홈과 어텐션 상세 양쪽에 노출됩니다.
- 현재 UI 문구는 한국어/영어/스페인어 사전 기반입니다. 신규 페이지도 반드시 `src/shared/i18n/dictionaries.ts`를 먼저 확장한 뒤 사용하세요.
- `npm run lint`와 `npm run build`는 현재 통과 상태를 기준으로 유지해야 합니다.
- Antigravity 쪽에서 Tier 1 Attention monetization DB 기반을 추가했습니다. 관련 migration은 `supabase/migrations/20260518000000_attention_monetization.sql`입니다.
- 해당 migration은 page view/dwell tracking, mock donation, donor/contributor ranking view, ad slot placeholder를 포함합니다. UI를 붙일 때도 실제 결제처럼 보이게 만들지 말고 `mock`, `support`, `attention boost`, `contribution` 프레이밍을 유지하세요.
- AIO Multi-LLM MVP는 `Gemini + GPT`를 먼저 병렬 호출하고, 두 결과가 불일치하거나 confidence가 낮을 때만 `xAI Grok`을 타이브레이커로 호출하는 `adaptive_2_plus_1` 방식을 기준으로 합니다. KoGPT/한국어 특화 모델은 이후 4번째 모델 또는 별도 tie-breaker 후보입니다.
- 다음 AIO 코드 작업자는 Edge Function에서 provider별 raw verification을 `aio_llm_verifications`에 저장하고, aggregate metadata에는 `consensus_method = "adaptive_2_plus_1"`, `tie_breaker_called`, `provider_count`를 남겨야 합니다.
- Attention SEO 1차 작업이 적용되었습니다. `/a/[slug]`와 `/topic/[slug]`는 서버 `page.tsx`에서 `generateMetadata`를 만들고, 인터랙티브 UI는 각각 `AttentionPageClient.tsx`, `TopicPageClient.tsx`로 분리합니다. 신규 공개 상세 페이지도 이 패턴을 따라 검색엔진용 title/description/canonical/Open Graph/Twitter metadata를 서버에서 생성하세요.
- `/sitemap.xml`과 `/robots.txt`가 추가되었습니다. 사이트맵은 고정 라우트와 공개 `attention_clusters`, `topics`를 포함하며 기준 도메인은 `NEXT_PUBLIC_APP_URL`을 우선 사용합니다.

**Codex에게 보내는 메시지**:
이후 개발을 진행할 때 반드시 이 가이드라인과 `LeftSidebar`, `RightSidebar`, `EventCard` 등에 적용된 컴포넌트 코딩 스타일을 참고하여, 기존에 구축된 프리미엄한 룩앤필을 해치지 않도록 주의해 주세요.
