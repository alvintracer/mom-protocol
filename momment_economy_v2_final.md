# momment. Economy v2 — 최종 구조

> 확정: 2026-05-20 · 이전 분석: [energy_system_audit.md](file:///Users/milkyway/.gemini/antigravity-ide/brain/e9071db8-1c05-47b7-8584-39c02f8732e2/energy_system_audit.md) · [energy_economy_v2.md](file:///Users/milkyway/.gemini/antigravity-ide/brain/e9071db8-1c05-47b7-8584-39c02f8732e2/energy_economy_v2.md)

---

## 핵심 공식

```
환율 = vault_usd / total_mom_supply

vault_usd  = Σ(platform_revenue_ledger.gross_amount × vault_share_rate)
             - Σ(withdrawal_requests.usd_amount WHERE completed)

total_mom  = Σ(profiles.mom_energy WHERE > 0)

최소 환율  = $0.001 (floor)
```

---

## 전체 흐름도

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MOM이 "생기는" 곳                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [활동 보상] 무에서 생성              [구매] $→MOM                   │
│  포스트(분석): +1.5 MOM               $X → $X/rate MOM 획득         │
│  포스트(근거): +2.0 MOM               vault_usd += $X               │
│  댓글:         +1.0 MOM               NowPayments 크립토 결제       │
│  리포스트:     +1.5 MOM                                             │
│  리액션:       +0.05 MOM              [스폰서십 수혜]               │
│  페이지뷰:     +0.1 MOM (unique/day)  빌더: 스폰서비드 × 25%        │
│  체류시간:     max +1.0 MOM/세션      기여자: 스폰서비드 × 25%      │
│                                       (activity_ledger 비례)        │
│  (DB trigger 자동)                                                  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                     MOM이 "사라지는" 곳 (소각 → 환율↑)              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [광고 비딩]                          [스폰서십]                    │
│  유저 -X MOM → 100% 소각              유저 -X MOM                   │
│  → total_mom ↓ → rate ↑               → 25% 빌더 직접 지급          │
│                                       → 25% 기여자 비례 분배        │
│  [출금]                               → 50% 소각 → rate ↑           │
│  유저 -Y MOM (즉시 차감)                                            │
│  → Y × rate × 0.95 = $Z USDC          [AIO Challenge 실패]         │
│  → 큐 → 배치처리                      → 25 MOM 소각                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                     $ 수익이 "쌓이는" 곳 (vault)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  platform_revenue_ledger:                                           │
│  ├── NowPayments 에너지 구매 ($)                                    │
│  ├── Google AdSense ($) — 수동/반자동 입력                          │
│  ├── 직접 광고주 입금 ($)                                           │
│  ├── 도네이션 (₩ → $ 환산) — 향후 실결제                            │
│  └── 기타 수익                                                      │
│                                                                     │
│  vault_usd ↑ → rate ↑ → 모든 MOM 보유자 이득                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 선순환 메커니즘

```
유저 활동 ──→ MOM 생성 (rate ⬇️)
    │              BUT
    └──→ 트래픽 ↑ ──→ 광고수익 ↑ ──→ vault_usd ↑ (rate ⬆️)
                              │
    광고주 MOM 소각 ←─────────┘ (total_mom ↓ → rate ⬆️)
              │
              └──→ MOM 가치 ↑ ──→ 더 열심히 활동 ──→ 🔄
```

> **수익 성장 > MOM 공급 성장이면 환율 상승** — 플랫폼이 성장할수록 유저의 MOM 가치가 올라감.

---

## 3대 수익화 트랙

### 1. 광고 비딩 (General Ad Bids)

```
광고주가 MOM으로 플랫폼 슬롯 입찰 (sidebar, feed_top, feed_mid)
→ 100% MOM 소각 (누구도 받지 않음)
→ total_mom_supply ↓ → rate ↑ → 모든 홀더 이득
→ 가장 높은 비더가 슬롯 차지
```

### 2. 어텐션 스폰서십 (Attention Sponsorship)

```
스폰서가 특정 어텐션 클러스터에 MOM 투자
→ 25% 빌더 (어텐션 생성자) 직접 지급
→ 25% 기여자 비례 분배 (attention_activity_ledger 기반, 상위 50명)
→ 50% 소각 → rate ↑
→ attention_score += bid × 60% (별도 점수, MOM과 무관, 노출 부스트)
→ 스폰서 브랜드 배지가 어텐션 페이지에 독점 표시
```

### 3. 도네이션 (Attention Donation)

```
팬이 ₩원으로 어텐션에 응원 (현재 mock, 향후 실결제)
→ ₩1,000당 +10 attention_score (클러스터 점수)
→ 도너에게 +2 MOM 보상
→ 실결제 시 revenue_ledger에 기록 → vault_usd ↑
```

---

## 출금 시스템 (MOM → USDC)

### 플로우

```
유저 → 프로필 → "출금 요청" → request_withdrawal() RPC
→ 현재 환율 조회 → MOM × rate × (1-5%) = $USDC
→ profiles.mom_energy 즉시 차감 (이중 요청 방지)
→ withdrawal_requests 테이블에 'queued'
→ 배치 처리 (주 1~2회, 수동 → 향후 자동화)
→ USDC 전송 → status: 'completed'
```

### 제한

| 항목 | 값 |
|------|:--:|
| 최소 출금 | 1,000 MOM |
| 일일 한도 (유저) | 50,000 MOM |
| 월간 한도 (유저, rolling 30일) | 200,000 MOM |
| 플랫폼 일일 한도 | vault의 10% |
| 출금 스프레드 | 5% |
| 취소 | 'queued' 상태에서만 가능 → MOM 환급 |

---

## Contribution Ratio (CR) — 명예 + 혜택 티어

### 역할 변경

```
이전: CR = 보상 분배 비율 (매월 1일 분배)
지금: CR = 명예 등급 + 출금 혜택 차등 (향후 구현)
```

### 티어 설계 (향후)

| CR 순위 | 티어 | 출금 스프레드 | 월간 한도 |
|---------|------|:----------:|:---------:|
| 상위 5% | 🏆 Gold | 3% | 500,000 MOM |
| 상위 20% | 🥈 Silver | 4% | 300,000 MOM |
| 나머지 | ⚡ Member | 5% | 200,000 MOM |

> CR은 `attention_contributor_rankings` 뷰에서 이미 계산됨. 티어 혜택 적용은 Phase 2.

---

## 현재 상태 (시드 데이터)

```
vault_usd     = $720 (이미 입력됨)
total_mom     = profiles.mom_energy 합계
current_rate  = $720 / total_mom (최소 $0.001)
```

---

## 구현 완료 항목

### SQL 마이그레이션

[20260520020000_dynamic_rate_economy_v2.sql](file:///Users/milkyway/Desktop/Dev/mom-attention-socialfi/supabase/migrations/20260520020000_dynamic_rate_economy_v2.sql)

| # | 내용 |
|---|------|
| 1 | `get_mom_rate()` — 동적 환율 계산 함수 |
| 2 | `platform_vault_overview` 뷰 재구성 (vault_usd, total_mom, rate) |
| 3 | `withdrawal_requests` 테이블 재구성 (mom_amount, rate_at_request, usd_amount, spread) |
| 4 | `request_withdrawal()` — 출금 요청 RPC (제한 포함) |
| 5 | `submit_ad_bid()` — 100% 소각으로 변경 |
| 6 | `submit_attention_sponsorship()` — 25/25/50 분배 + 기여자 비례 |
| 7 | `cancel_withdrawal()` — 출금 취소 + MOM 환급 |
| 8 | `redeemable_energy` 컬럼 삭제 |

### 코드 변경

| 파일 | 변경 |
|------|------|
| [/api/rate/route.ts](file:///Users/milkyway/Desktop/Dev/mom-attention-socialfi/src/app/api/rate/route.ts) | **NEW** — 공개 환율 API |
| [LeftSidebar.tsx](file:///Users/milkyway/Desktop/Dev/mom-attention-socialfi/src/shared/components/layout/LeftSidebar.tsx) | 하드코딩 `/100` → 동적 환율 |
| [nowpayments/route.ts](file:///Users/milkyway/Desktop/Dev/mom-attention-socialfi/src/app/api/payments/nowpayments/route.ts) | `MOM_ENERGY_PER_USD=100` → `get_mom_rate()` |
| [profile/page.tsx](file:///Users/milkyway/Desktop/Dev/mom-attention-socialfi/src/app/%5Blang%5D/profile/page.tsx) | BuyMom 환율 동적화 + 예상가치 표시 |
| [dictionaries.ts](file:///Users/milkyway/Desktop/Dev/mom-attention-socialfi/src/shared/i18n/dictionaries.ts) | `sidebar.rate` 키 추가 |

### ⬜ 미구현 (Phase 2)

| 항목 | 상태 |
|------|------|
| 프로필 출금 UI | ⬜ |
| Admin 출금 큐 관리 패널 | ⬜ |
| CR 티어 → 스프레드 차등 적용 | ⬜ |
| Rewards 페이지 vault/rate 리뉴얼 | ⬜ |
| 도네이션 실결제 연동 | ⬜ |
| 환율 히스토리 차트 | ⬜ |
