# momment. Codex 작업 가이드: 프로젝트 설치 이후 6번부터

> 최신 네이밍 규칙: 서비스명은 `momment.`이고 심볼은 `MOM`이다. 사용자에게 보이는 브랜드명은 `momment.`를 사용한다. 단, `MOM Energy`, `MOM 포인트`, 토큰 심볼, 컨트랙트명처럼 심볼을 의미하는 표현은 `MOM`을 유지한다. 신규 UI는 `src/shared/i18n` 언어팩을 사용하고 모바일 웹 뷰를 항상 우선 고려한다. 상세 규칙은 `docs/moment_Product_Implementation_Rules.md`를 따른다.

문서 버전: v0.1  
대상: Codex / Antigravity / Cursor류 AI 개발 에이전트  
전제: Next.js 프로젝트 생성, 패키지 설치, shadcn/ui 초기화, `.env.local` 생성까지 완료된 상태

---

## 0. 현재 상태 전제

현재 프로젝트는 아래 상태라고 가정한다.

```txt
mom-attention-socialfi/
  docs/
    MOM_Event_Attention_SocialFi_Dev_Guidance.md
  src/
    app/
    ...
  .env.local
  package.json
```

이 문서는 `docs/MOM_Codex_Workflow_After_Setup.md`로 저장하고, Codex에게 반드시 두 문서를 먼저 읽게 한다.

```txt
docs/MOM_Event_Attention_SocialFi_Dev_Guidance.md
docs/MOM_Codex_Workflow_After_Setup.md
```

---

## 1. Codex에게 최초로 줄 시스템성 지시문

Codex 작업을 시작할 때 아래 프롬프트를 먼저 입력한다.

```md
You are the coding agent for the MOM Event Attention SocialFi project.

Before editing code, read these documents:

1. `docs/MOM_Event_Attention_SocialFi_Dev_Guidance.md`
2. `docs/MOM_Codex_Workflow_After_Setup.md`

Core product rule:
MOM is not a betting platform. Users do not place real-money bets inside MOM. MOM is an Event Attention SocialFi and AI Oracle Layer above global prediction markets and real-world events.

Use these product terms:
- Event
- Creator
- Prediction
- Evidence
- MOM Energy
- Contribution Ratio
- Reward Pool
- Oracle Verification
- Creator Subscription
- Super Comment
- Event Room
- Boost

Avoid these betting terms in UI and code labels unless they appear only as external source metadata:
- bet
- wager
- gambling
- payout from prediction
- position
- ROI
- odds as betting odds
- stake as betting stake

Technical stack:
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- thirdweb
- GIWA Sepolia
- Zustand if needed
- React Query if needed

Development style:
- Make small, reviewable commits or changes.
- Do not build everything at once.
- First make a working UI with mock data.
- Then add Supabase.
- Then add wallet connection.
- Then add reward calculation.
- Then add AIO oracle mock.
- Then add GIWA testnet contracts or contract integration placeholders.
```

---

## 2. Sprint 1: 기본 화면과 mock data 구축

### 목표

베팅 앱처럼 보이지 않는 Event Attention SocialFi 화면을 먼저 만든다.

### Codex 프롬프트

```md
Sprint 1: Build the core UI with mock data.

Tasks:
1. Create this folder structure if missing:
   - `src/shared/components/layout`
   - `src/shared/components/cards`
   - `src/shared/data`
   - `src/shared/types`
   - `src/features/events`
   - `src/features/creators`
   - `src/features/rewards`
   - `src/features/oracle`

2. Create mock data in `src/shared/data/mock.ts` for:
   - events
   - creators
   - predictions
   - evidence
   - rewardPool
   - contributionBreakdown

3. Create TypeScript types in `src/shared/types/domain.ts`:
   - Event
   - Creator
   - Prediction
   - Evidence
   - RewardPool
   - ContributionBreakdown

4. Create layout components:
   - `AppShell`
   - `LeftSidebar`
   - `RightSidebar`
   - `TopBar`

5. Create card components:
   - `EventCard`
   - `CreatorCard`
   - `EvidenceCard`
   - `RewardPoolCard`
   - `ContributionBreakdownCard`
   - `SponsoredCampaignCard`

6. Create pages:
   - `/`
   - `/events`
   - `/events/[eventId]`
   - `/creators/[handle]`
   - `/rewards`
   - `/oracle`

7. Design requirements:
   - white background
   - black text
   - blue accent
   - clean card-based layout
   - Korean-first UI copy
   - Noto Sans KR preferred if easy

8. Product copy requirements:
   - Use “이벤트”, “예측”, “근거”, “크리에이터”, “MOM Energy”, “Contribution Ratio”, “Reward Pool”.
   - Do not use “베팅”, “배당”, “포지션”, “ROI”, “도박”, “수익률”.

9. Add a clear disclaimer in the UI:
   “MOM은 사용자가 금전을 걸고 베팅하는 예측시장이 아닙니다. 예측·근거·토론·확산 기여도를 기반으로 플랫폼 수익 일부가 리워드 풀로 분배되는 Event Attention SocialFi입니다.”

Do not integrate Supabase yet. Use mock data only.
```

### 완료 기준

```txt
npm run dev
```

실행 시 다음 페이지가 깨지지 않아야 한다.

```txt
/
/events
/events/mock-event-id
/creators/mock-handle
/rewards
/oracle
```

---

## 3. Sprint 2: Supabase Auth와 DB 타입 연결

> 업데이트: Sprint 2부터 사용자 게시물/댓글 원문 보존 및 LLM 번역 캐시 구조를 함께 고려한다. 적용 기준은 `docs/moment_Supabase_Content_Translation_Plan.md`와 `supabase/migrations/20260516000000_initial_moment_schema.sql`이다.

### 목표

앱 계정의 기준은 Supabase로 잡고, 지갑은 별도 연결 정보로 관리한다.

### Supabase SQL 초안

Supabase SQL Editor에서 먼저 실행한다.

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  bio text,
  trust_score numeric default 0,
  mom_energy numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  address text not null,
  chain_id integer,
  wallet_type text check (wallet_type in ('thirdweb_in_app', 'external', 'tookwallet')),
  is_primary boolean default false,
  created_at timestamptz default now(),
  unique(address, chain_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  source_platform text,
  source_url text,
  external_market_id text,
  status text default 'open' check (status in ('draft', 'open', 'resolved', 'disputed', 'archived')),
  resolution text,
  starts_at timestamptz,
  ends_at timestamptz,
  resolved_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  side text not null,
  confidence integer check (confidence >= 0 and confidence <= 100),
  rationale text,
  created_at timestamptz default now(),
  unique(event_id, user_id)
);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  submitted_by uuid references public.profiles(id),
  url text not null,
  title text,
  publisher text,
  published_at timestamptz,
  content_hash text,
  screenshot_url text,
  ai_confidence numeric,
  status text default 'submitted' check (status in ('submitted', 'verified', 'rejected', 'disputed')),
  created_at timestamptz default now()
);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  type text not null,
  energy numeric not null default 0,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists public.reward_pools (
  id uuid primary key default gen_random_uuid(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_revenue_usdc numeric not null default 0,
  reward_rate numeric not null default 0,
  reward_amount_usdc numeric generated always as (total_revenue_usdc * reward_rate) stored,
  merkle_root text,
  status text default 'draft' check (status in ('draft', 'calculated', 'published', 'claimable', 'closed')),
  created_at timestamptz default now()
);

create table if not exists public.reward_allocations (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references public.reward_pools(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  contribution_energy numeric not null default 0,
  contribution_ratio numeric not null default 0,
  reward_usdc numeric not null default 0,
  status text default 'pending' check (status in ('pending', 'approved', 'claimable', 'paid', 'rejected')),
  tx_hash text,
  created_at timestamptz default now(),
  unique(pool_id, user_id)
);
```

### Codex 프롬프트

```md
Sprint 2: Add Supabase Auth and DB integration.

Tasks:
1. Create Supabase clients:
   - `src/shared/lib/supabase/client.ts`
   - `src/shared/lib/supabase/server.ts`
   - `src/shared/lib/supabase/middleware.ts` if needed

2. Create auth pages:
   - `/auth/login`
   - `/auth/callback` if needed for OAuth

3. Implement login options:
   - email magic link placeholder
   - Google OAuth placeholder

4. Create user profile creation flow:
   - After login, create a row in `profiles` if missing.
   - Generate a default handle if missing.

5. Create a protected check for:
   - `/rewards`
   - `/oracle`

6. Do not make wallet connection required for normal browsing.

7. Keep all UI Korean-first.

8. Add clear architecture comments:
   - Supabase Auth is the app account identity.
   - Wallets are linked separately for GIWA/USDC/oracle actions.

Do not add thirdweb yet in this sprint.
```

### 완료 기준

- `/auth/login` 접근 가능
- 로그인 후 `profiles` row 생성
- `/rewards`에서 로그인 상태 확인 가능
- 지갑 연결 없이도 피드 탐색 가능

---

## 4. Sprint 3: thirdweb + GIWA Sepolia 지갑 연결

### 목표

thirdweb으로 지갑 연결을 붙이고, 연결된 주소를 Supabase `wallets` 테이블에 저장한다.

### Codex 프롬프트

```md
Sprint 3: Add thirdweb wallet integration with GIWA Sepolia.

Tasks:
1. Create `src/shared/lib/thirdweb/client.ts`.
2. Create `src/shared/lib/giwa/chain.ts`.
3. Define GIWA Sepolia:
   - chainId: 91342
   - rpc: https://sepolia-rpc.giwa.io
   - explorer: https://sepolia-explorer.giwa.io
   - native currency: ETH

4. Create `WalletConnectPanel` component.

5. Add wallet UI to:
   - `/rewards`
   - `/oracle`
   - top bar or right sidebar as compact status

6. User flow:
   - Logged-in user connects wallet.
   - App detects connected address and chain.
   - User can save wallet to Supabase `wallets` table.
   - Wallet type can be one of:
     - `thirdweb_in_app`
     - `external`
     - `tookwallet`

7. Add TookWallet placeholder:
   - Do not implement TookWallet internals yet.
   - Add button/section: “TookWallet 연결 예정”.
   - Add architecture note that TookWallet will be used later as an advanced non-custodial/compliance wallet option.

8. Do not transfer USDC yet.
9. Do not deploy contracts yet.
10. Do not require wallet for reading content.

Expected files:
- `src/shared/lib/thirdweb/client.ts`
- `src/shared/lib/giwa/chain.ts`
- `src/features/wallet/components/WalletConnectPanel.tsx`
- `src/features/wallet/actions/save-wallet.ts` or API route
```

### 완료 기준

- 지갑 연결 UI 표시
- GIWA Sepolia chain 정보 표시
- 연결 주소 저장 가능
- TookWallet은 placeholder로만 표시

---

## 5. Sprint 4: MOM Energy와 Contribution Ratio 계산

### 목표

리워드 구조의 핵심을 구현한다. 아직 실제 USDC 지급은 하지 않는다.

### 리워드 설계 원칙

```txt
금지: 예측 맞힘 → 바로 USDC 배당
허용: 예측/근거/토론/확산/구독자 영향력 → MOM Energy → Contribution Ratio → 플랫폼 Reward Pool 분배
```

### Contribution 구성 예시

```txt
prediction_accuracy: 25%
evidence_quality: 20%
creator_attention: 20%
discussion_impact: 15%
share_referral: 10%
validation_activity: 10%
```

### Codex 프롬프트

```md
Sprint 4: Implement off-chain MOM Energy and reward allocation logic.

Core rule:
Rewards are based on platform contribution, not direct prediction betting outcomes.

Tasks:
1. Create reward calculation utilities:
   - `src/features/rewards/lib/calculateMomEnergy.ts`
   - `src/features/rewards/lib/calculateContributionRatio.ts`
   - `src/features/rewards/lib/calculateRewardAllocation.ts`

2. Create calculation types:
   - ContributionSource
   - EnergyBreakdown
   - RewardAllocationPreview

3. Use these contribution sources:
   - prediction_accuracy
   - evidence_quality
   - creator_attention
   - discussion_impact
   - share_referral
   - validation_activity
   - trust_score_bonus

4. Build `/rewards` page sections:
   - Current Reward Pool
   - My MOM Energy
   - My Contribution Ratio
   - Estimated USDC Reward
   - Energy Breakdown
   - Reward Rule Disclaimer

5. Use mock weekly pool:
   - total platform revenue: 50,000 USDC
   - reward rate: 20%
   - reward pool: 10,000 USDC

6. Add disclaimer:
   “예상 리워드는 예측 적중 배당이 아니라, 플랫폼 내 콘텐츠·근거·토론·확산 기여도를 기준으로 산정되는 크리에이터/커뮤니티 보상입니다.”

7. Do not enable real claim yet.
8. Show status as `pending` or `preview`.
```

### 완료 기준

`/rewards`에서 다음이 보여야 한다.

```txt
Reward Pool: 10,000 USDC
My MOM Energy: 예시 값
My Contribution Ratio: 예시 %
Estimated Reward: 예시 USDC
Breakdown by activity
```

---

## 6. Sprint 5: MOM AIO Oracle Mock 구현

### 목표

AIO 모델의 MVP를 오프체인 mock으로 먼저 구현한다.

MOM AIO의 핵심은 다음이다.

```txt
User submits claim + evidence
AI reads evidence
Humans/community can challenge
Chain later records verification hash
```

### Codex 프롬프트

```md
Sprint 5: Implement MOM AIO Oracle mock flow.

Concept:
MOM AIO is an Agentic-Interoperable Oracle model.
It verifies real-world event facts using evidence, AI, and transparent records.

MVP scope:
No real on-chain write yet. Build off-chain mock + API route structure.

Tasks:
1. Create `/oracle` page with:
   - Event selector
   - Claim input
   - Outcome selector: YES / NO / AMBIGUOUS
   - Evidence URL input
   - Submit Evidence button
   - AI Verification Result panel
   - Challenge Period status panel

2. Create oracle types:
   - OracleClaim
   - EvidenceRecord
   - LLMVerificationResult
   - OracleResolution

3. Create mock verification API:
   - `src/app/api/oracle/verify/route.ts`

4. The API should accept:
   - eventId
   - claim
   - outcome
   - evidenceUrls[]

5. The API should return mock result:
   - relevanceScore
   - supportScore
   - recencyScore
   - consistencyScore
   - confidence
   - suggestedResolution
   - reasoning
   - modelId
   - promptVersion
   - inputHash placeholder
   - outputHash placeholder

6. Create `EvidenceCard` display:
   - URL
   - publisher
   - title
   - submittedBy
   - AI confidence
   - status

7. Add AIO explanation copy:
   “AI가 근거를 읽고, 커뮤니티가 검증하고, 체인이 기록합니다.”

8. Include these concepts in code comments:
   - Evidence Lite
   - Multi-LLM verification
   - LLM Provenance
   - Challenge Period
   - On-chain finalization later

9. Do not call real OpenAI/xAI APIs yet unless explicitly configured.
10. Keep all output deterministic mock for now.
```

### 완료 기준

- `/oracle`에서 claim/evidence 입력 가능
- mock AI 검증 결과 표시
- challenge/finalization 상태 placeholder 표시

---

## 7. Sprint 6: 수익 모델 화면화

### 목표

이 플랫폼이 돈을 어떻게 버는지 UI와 데이터 모델로 보여준다.

우선 구현할 수익 모델은 6개다.

```txt
2. Creator Subscription
3. Boost / Promote
4. Super Comment / Super Signal
5. Event Room
7. Sponsored Campaign
8. Event Ad Slot
```

### Codex 프롬프트

```md
Sprint 6: Add monetization surfaces.

Implement UI only first. No real payment processing yet.

Revenue models to represent:
1. Creator Subscription
2. Boost / Promote
3. Super Comment / Super Signal
4. Paid Event Room
5. Sponsored Campaign
6. Event Ad Slot

Tasks:
1. Create folder:
   - `src/features/monetization`

2. Create types:
   - CreatorSubscriptionPlan
   - BoostPackage
   - SuperComment
   - EventRoom
   - SponsoredCampaign
   - EventAdSlot

3. Create components:
   - `CreatorSubscribeButton`
   - `BoostPostDialog`
   - `SuperCommentBox`
   - `EventRoomCard`
   - `SponsoredCampaignCard`
   - `EventAdSlotCard`

4. Add to event detail page:
   - sponsored campaign area
   - ad slot area
   - super comment area
   - paid event room card

5. Add to creator profile page:
   - subscription plan card
   - creator revenue preview
   - follower/energy stats

6. Add copy explaining:
   - Users do not pay to bet.
   - Users may pay for subscriptions, boosted visibility, super comments, premium event rooms, and creator content.
   - Part of platform revenue can enter Reward Pool.

7. Payment should be mocked:
   - button text: “결제 연동 예정”
   - status: `mock_only`

8. Do not add Stripe, crypto payment, or USDC transfer yet.
```

### 완료 기준

- 이벤트 상세 페이지에서 광고/스폰서/부스트/슈퍼댓글/이벤트룸이 보임
- 크리에이터 프로필에서 구독 모델이 보임
- 수익 일부가 Reward Pool로 들어간다는 설명이 보임

---

## 8. Sprint 7: Polymarket/Kalshi 외부 이벤트 레이어 설계

### 목표

외부 예측시장 데이터를 “거래 기능”이 아니라 “이벤트/토론/분석 소재”로 가져오는 구조를 만든다.

### Codex 프롬프트

```md
Sprint 7: Add external market reference layer.

Core rule:
MOM does not let users bet on external markets inside the app.
External prediction markets are used only as event references, probability signals, and discussion sources.

Tasks:
1. Add source fields to Event type:
   - sourcePlatform: `polymarket` | `kalshi` | `manifold` | `manual` | `news`
   - sourceUrl
   - externalMarketId
   - externalProbability
   - externalProbabilityUpdatedAt

2. Create `ExternalMarketReferenceCard` component.

3. On event detail page, show:
   - external source platform
   - external probability signal
   - source link
   - disclaimer

4. Disclaimer text:
   “외부 예측시장 정보는 이벤트 참고 및 토론 목적으로만 제공됩니다. MOM 내에서는 금전 베팅 또는 포지션 매매를 제공하지 않습니다.”

5. Add mock Polymarket/Kalshi-style events without real API integration.

6. Do not scrape or call external APIs yet.
7. Keep source URL as metadata only.
```

### 완료 기준

- MOM 이벤트가 외부 예측시장 이벤트를 참조할 수 있음
- 거래 버튼 없음
- 외부 이동 링크는 있어도 MOM 내부 결제/베팅 없음

---

## 9. Sprint 8: GIWA 온체인 기록 준비

### 목표

실제 컨트랙트 배포 전, 어떤 데이터를 GIWA에 기록할지 구조를 잡는다.

### 온체인 기록 대상

```txt
1. Oracle claim hash
2. Evidence bundle hash
3. LLM result hash
4. Final resolution hash
5. Reward pool summary hash
6. Reward allocation Merkle root
```

### Codex 프롬프트

```md
Sprint 8: Prepare GIWA on-chain record architecture.

Do not deploy contract yet unless asked.
Create contract interface placeholders and frontend integration stubs.

Tasks:
1. Create folder:
   - `src/features/giwa`

2. Create files:
   - `src/features/giwa/contracts/MOMAIOOracle.abi.ts`
   - `src/features/giwa/contracts/MOMRewardDistributor.abi.ts`
   - `src/features/giwa/lib/hashOracleClaim.ts`
   - `src/features/giwa/lib/hashRewardPool.ts`
   - `src/features/giwa/components/OnChainRecordPreview.tsx`

3. Implement hash helpers using deterministic JSON stringify + placeholder hash logic or viem keccak256 if straightforward.

4. On `/oracle`, show OnChainRecordPreview:
   - claimHash
   - evidenceBundleHash
   - llmResultHash
   - finalResolutionHash
   - chain: GIWA Sepolia
   - status: not submitted

5. On `/rewards`, show OnChainRecordPreview:
   - rewardPoolHash
   - merkleRoot placeholder
   - chain: GIWA Sepolia
   - status: not submitted

6. Do not write transactions yet.
7. Do not ask users to sign anything yet.
```

### 완료 기준

- `/oracle`과 `/rewards`에서 “GIWA에 기록될 데이터” 미리보기 가능
- 아직 트랜잭션 실행 없음

---

## 10. Sprint 9: Mock USDC 리워드 클레임 설계

### 목표

실제 USDC 전송 전, 리워드 claim UX를 만든다.

### Codex 프롬프트

```md
Sprint 9: Add mock USDC reward claim UX.

Core rule:
USDC reward is not a prediction payout. It is a creator/community contribution reward from platform revenue.

Tasks:
1. Add reward allocation statuses:
   - preview
   - pending_approval
   - approved
   - claimable_mock
   - paid_mock

2. On `/rewards`, add Claim panel:
   - connected wallet address
   - selected chain: GIWA Sepolia
   - estimated reward
   - approved reward
   - claim status

3. Claim button behavior:
   - If wallet not connected: ask to connect wallet
   - If not approved: disabled with explanation
   - If mock claimable: simulate claim and mark as `paid_mock`

4. Add disclaimer:
   “현재는 테스트/데모용 리워드 표시이며, 실제 지급은 운영 승인 및 관련 규정 검토 이후 진행됩니다.”

5. Do not transfer real USDC.
6. Do not deploy mock USDC yet.
```

### 완료 기준

- 지갑 연결 상태에 따라 claim UX가 달라짐
- 실제 전송 없이 mock paid 처리 가능

---

## 11. Sprint 10: 개발용 README 업데이트

### Codex 프롬프트

```md
Sprint 10: Update README for developers.

Add or update `README.md` with:
1. Project definition
2. Product rules
3. Tech stack
4. Environment variables
5. Local dev commands
6. Folder structure
7. Supabase setup
8. thirdweb/GIWA setup
9. Reward model explanation
10. AIO oracle model explanation
11. What not to implement:
    - real-money betting
    - internal position trading
    - direct prediction payout
    - unstated financial product claims

Keep the README practical for a new developer.
```

---

## 12. 개발 중 에러 대응 원칙

Codex가 너무 많은 파일을 한 번에 고치면 중단시킨다.

권장 작업 단위:

```txt
1 prompt = 1 sprint or smaller
1 sprint = maximum 10~20 files
```

에러가 나면 아래처럼 요청한다.

```md
The app has a build/runtime error.
Please do not add new features.
Only fix the current error.
Explain the likely cause, then modify the minimum files necessary.
After fixing, tell me which command to run.
```

타입 에러가 많으면 아래처럼 요청한다.

```md
Please run a TypeScript cleanup pass.
Do not change product behavior.
Fix type errors by adding proper types, narrowing nullable values, and removing any unsafe `any` unless unavoidable.
```

UI가 베팅 앱처럼 보이면 아래처럼 요청한다.

```md
Revise UI copy and labels to avoid betting-market framing.
This is an Event Attention SocialFi platform, not a betting app.
Replace betting-like terms with creator, event, evidence, energy, contribution, and reward-pool language.
```

---

## 13. 개발 우선순위 요약

```txt
현재 완료:
1. Sprint 1 mock/core UI 기반
2. Supabase Auth 이메일/비밀번호/OTP 로그인 기반
3. profiles 기본 편집/공개 프로필 기반
4. Topic > Attention > Post 구조 전환
5. Explore(`/explore`) 어텐션 탐색 화면
6. Attention Builder(`/attentions/new`) 만들기/가져오기, 케이스/옵션, AIO rule draft
7. Attention Detail(`/a/[slug]`) 상세, Join, 케이스, 출처, 관련 포스트
8. 통합 Post Composer(`/posts/new`)와 Post Detail(`/posts/[postId]`)
9. Supabase Storage `post-media` 기반 이미지/오디오 업로드
10. momment vault(`/rewards`) mock 대시보드
11. AIO/Challenge 정책 mock UI(`/oracle`)
12. 한국어/영어/스페인어 i18n 사전 기반 UI
13. Antigravity 추가 DB 작업: Tier 1 Attention monetization
    - page view / dwell time tracking
    - mock donation
    - donor ranking view
    - contributor ranking view
    - ad slot placeholder

다음 추천 순서:
1. AIO Edge Function 구현
   - Evidence Lite metadata capture
   - Gemini/GPT/xAI Grok 3-provider verification
   - adaptive 2+1 consensus aggregator
   - `aio_llm_verifications` 저장
2. AIO assertion 제출 UI와 `/oracle` dashboard 확장
3. Challenge/Finalize 상태 머신 UI
4. 포스트/댓글 번역 테이블을 실제 렌더링 fallback에 연결
5. 링크 미리보기 Route Handler/OG metadata 파싱
6. 포스트 작성 후 Topic/Attention 자동 추천 큐 적재
7. 어텐션 상세에 monetization stats/page view/donation UI 연결
8. 프로필/유저 페이지의 실제 활동 데이터 연결
9. 알림/북마크/메시지 placeholder 정리
10. thirdweb/GIWA는 이후 스프린트에서 지갑 연결 정보만 분리해 추가
11. README 정리
```

---

## 14. 최종 제품 방향 메모

서비스명은 `momment.`이고 심볼은 `MOM`이다. `MOM Energy`, `MOM 포인트`처럼 심볼을 의미할 때만 `MOM`을 쓴다.

momment.는 예측시장을 직접 운영하지 않는다. momment.는 Polymarket, Kalshi, Manifold, 뉴스, 스포츠, K-pop, 정치, 금융 이벤트 위에 존재하는 어텐션·크리에이터·오라클 레이어다.

유저는 momment.에서 돈을 걸지 않는다. 대신 예측, 근거, 분석, 포스트, 리플라이, 확산, 검증 활동을 통해 MOM Energy를 쌓는다. 플랫폼은 구독, 부스트, 슈퍼댓글, 이벤트룸, 광고 슬롯, 스폰서 캠페인, 데이터/API에서 수익을 만들고, 그 일부를 momment vault에 넣는다. vault는 Contribution Ratio에 따라 분배된다.

momment. AIO는 이벤트의 사실 여부와 리워드 정산의 투명성을 검증한다.

현재 핵심 계층은 아래와 같다.

```txt
Topic
  -> Attention
      -> Post / Reply / Source / Case / AIO Rule
```

`Attention`은 Reddit subreddit처럼 장기 커뮤니티가 아니라 Polymarket market처럼 질문형 이벤트 + 검증 시점 + 케이스/옵션이 결합된 단위다. 장기 관심사 클러스터링은 `Topic`이 담당한다.

포스트 작성은 `/posts/new`로 통합한다. 어텐션 상세에서 작성할 때는 `/posts/new?attention=<attention_id>`로 이동해 어텐션과 케이스를 자동 선택한다.

신규 UI 문구는 반드시 `src/shared/i18n/dictionaries.ts`에 한국어/영어/스페인어로 추가한다. `src/app`과 `src/shared/components`에 한국어 UI 문자열을 직접 쓰지 않는다.

AIO Multi-LLM MVP는 `Gemini + GPT`를 먼저 병렬 호출하고, 두 결과가 불일치하거나 confidence가 낮을 때만 `xAI Grok`을 타이브레이커로 호출한다. aggregate verdict는 `adaptive_2_plus_1` 방식으로 만들며, xAI Grok을 호출한 경우에는 사실상 `2 of 3` 합의가 된다. KoGPT/한국어 특화 모델은 MVP 필수값이 아니라 향후 4번째 모델 또는 별도 tie-breaker로 확장한다.

```txt
AI가 읽고
인간이 검증하고
GIWA가 기록한다
```
