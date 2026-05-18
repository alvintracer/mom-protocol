# momment. hCaptcha + HMT 수익화 아키텍처

> 문서 버전: v1.0
> 최종 업데이트: 2026-05-19
> 관련 코드: `src/shared/components/captcha/`, `src/app/api/captcha/`, `supabase/migrations/20260519000000_hcaptcha_hmt_revenue.sql`

---

## 1. 핵심 원칙

```
hCaptcha/HMT 수익은 개별 유저에게 직접 지급하지 않는다.
모든 수익은 플랫폼 지갑으로 귀속된 후, 기존 Contribution Ratio 체계로 분배한다.
```

이유:
- 유저별 마이크로 결제(건당 ~$0.001) 처리 비용이 수익보다 큼
- Contribution Ratio 기반 통합 분배가 공정하고 단순
- HMT 토큰을 유저에게 직접 주면 증권법 이슈 가능성 존재

---

## 2. 전체 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│  유저 액션 (프론트엔드)                                          │
│                                                                 │
│  AIO 결과 제출  ─┐                                              │
│  AIO 챌린지     ─┤                                              │
│  어텐션 빌드    ─┼──▶  CaptchaGate 컴포넌트 (hCaptcha 위젯)     │
│  포스트 작성*   ─┘     └──▶ 유저가 hCaptcha 퍼즐 풀이            │
│                              └──▶ hCaptcha 응답 토큰 발급        │
│  * 포스트 작성은 리스크 기반 조건부 적용                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │ captcha 토큰
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  서버 검증 (POST /api/captcha/verify)                           │
│                                                                 │
│  1. hCaptcha API로 토큰 유효성 확인                              │
│  2. captcha_verifications 테이블에 기록                          │
│     (user_id, action_type, verified, created_at)                │
│  3. 검증 성공 → 원래 액션(AIO 제출 등) 진행 허용                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  hCaptcha → HMT 수익 발생 (hCaptcha 측에서 자동 처리)            │
│                                                                 │
│  hCaptcha는 유저의 퍼즐 풀이를 AI 라벨링 데이터로 활용            │
│  → Human Protocol 네트워크에서 HMT 토큰으로 보상 지급             │
│  → 보상은 hCaptcha 대시보드에 등록된 지갑으로 전송                │
│                                                                 │
│  ⚡ 핵심: 이 지갑이 momment. 플랫폼 지갑이어야 함               │
│  환경변수: HMT_PLATFORM_WALLET                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HMT 토큰
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  플랫폼 지갑 (HMT_PLATFORM_WALLET)                              │
│                                                                 │
│  - Ethereum/Polygon 네트워크의 플랫폼 소유 지갑                  │
│  - hCaptcha 대시보드 → Settings → Payout Wallet에 등록           │
│  - HMT 토큰이 주기적으로 이 지갑으로 입금됨                      │
│                                                                 │
│  관리 방법:                                                     │
│  - 멀티시그 지갑 (Gnosis Safe 등) 권장                           │
│  - 입금 모니터링: Polygon/Etherscan 알림 설정                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │ 정산 주기 (월 1회)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  HMT → 플랫폼 에너지 전환 (정산 프로세스)                        │
│                                                                 │
│  1. 정산 시점에 플랫폼 지갑의 HMT 잔액 확인                      │
│  2. HMT → USDC/KRW 환전 (DEX 또는 CEX 사용)                    │
│  3. 환전된 금액을 platform_hmt_revenue 테이블에 기록              │
│     - amount_hmt: 원본 HMT 수량                                │
│     - amount_usd: USD 환산 금액                                 │
│     - captcha_count: 해당 기간 captcha 검증 횟수                 │
│     - status: 'received' → 'converted' → 'distributed'         │
│  4. 환전 금액을 Reward Pool에 편입                               │
│     (기존 구독/광고/부스트 수익과 동일 풀)                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  Reward Pool 구성                                   │        │
│  │                                                     │        │
│  │  ✅ Creator Subscription 수수료                     │        │
│  │  ✅ Boost / Promote 수익                            │        │
│  │  ✅ Super Comment / Super Signal                    │        │
│  │  ✅ Paid Event Room 수수료                          │        │
│  │  ✅ Sponsored Campaign                              │        │
│  │  ✅ Event Ad Slot                                   │        │
│  │  🆕 hCaptcha/HMT 수익     ← 여기에 편입            │        │
│  │  🆕 디스플레이 광고 (AdSense/Brave)                 │        │
│  │  🆕 AI 라벨링 데이터 판매                           │        │
│  └─────────────────────────────────────────────────────┘        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Contribution Ratio 기반 분배                                    │
│                                                                 │
│  User Reward = Reward Pool × (User MOM Energy / Total Energy)   │
│                                                                 │
│  MOM Energy 구성:                                               │
│  - Prediction Accuracy (25%)                                    │
│  - Evidence Quality (20%)                                       │
│  - Content Impact (20%)                                         │
│  - Discussion Contribution (15%)                                │
│  - Follower Growth (10%)                                        │
│  - Verification Participation (5%)  ← hCaptcha 완료 포함        │
│  - Trust / Anti-abuse Score (5%)    ← hCaptcha 기여 반영        │
│                                                                 │
│  hCaptcha를 통한 기여 반영:                                      │
│  - captcha_verifications의 유저별 완료 횟수가                    │
│    Verification Participation 점수에 반영                        │
│  - 봇으로 의심되지 않는 정상 captcha 패턴이                      │
│    Trust Score에 긍정적 영향                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. hCaptcha 설정 가이드

### 3.1 hCaptcha 계정 생성

1. https://dashboard.hcaptcha.com 에서 계정 생성
2. 새 사이트 등록 → sitekey 발급
3. Settings → Secret Key 복사

### 3.2 환경변수 설정

```env
# .env.local

# hCaptcha 키
NEXT_PUBLIC_HCAPTCHA_SITEKEY=<대시보드에서 발급받은 sitekey>
HCAPTCHA_SECRET=<대시보드에서 복사한 secret key>

# HMT 수익 수령 지갑 (Polygon 네트워크)
HMT_PLATFORM_WALLET=0x... <플랫폼 소유 멀티시그 지갑 주소>
```

### 3.3 HMT Payout 설정

1. hCaptcha Dashboard → Settings → Earnings
2. "Enable HMT Rewards" 활성화
3. Payout Wallet에 `HMT_PLATFORM_WALLET` 주소 입력
4. Payout Network: Polygon (가스비 저렴)
5. Minimum Payout Threshold: 기본값 유지

### 3.4 테스트 키 (개발용)

```env
# 개발환경에서는 hCaptcha 테스트 키 사용
NEXT_PUBLIC_HCAPTCHA_SITEKEY=10000000-ffff-ffff-ffff-000000000001
HCAPTCHA_SECRET=0x0000000000000000000000000000000000000000
# 테스트 키는 항상 인증 성공 반환, HMT 수익 없음
```

---

## 4. 코드 구조

### 4.1 프론트엔드

```
src/shared/components/captcha/
  └── CaptchaGate.tsx          # 재사용 가능한 render-prop 캡차 래퍼

사용처:
  src/shared/components/aio/AioAssertionForm.tsx   # AIO 결과 제출 시 필수
  src/app/attentions/new/page.tsx                  # 어텐션 빌드 시 필수
  (향후) src/app/posts/new/page.tsx                # 포스트 작성 시 조건부
```

### 4.2 백엔드

```
src/app/api/captcha/verify/route.ts    # 서버사이드 hCaptcha 토큰 검증
  - POST body: { token, action }
  - hCaptcha API 호출 → 토큰 유효성 확인
  - 향후: captcha_verifications 테이블에 기록
```

### 4.3 데이터베이스

```sql
-- 개별 검증 기록
captcha_verifications
  - id, user_id, action_type, verified, created_at
  - 용도: 유저별 captcha 빈도 분석, Smart Captcha 결정, Contribution 점수

-- 플랫폼 HMT 수익 장부
platform_hmt_revenue
  - id, source, amount_hmt, amount_usd, period_start, period_end
  - captcha_count, wallet_address, tx_hash, status
  - 용도: 정산 추적, Reward Pool 편입 기록
```

---

## 5. CaptchaGate 적용 매트릭스

| 액션 | 적용 방식 | 이유 |
|------|----------|------|
| AIO 결과 제출 | **항상 필수** | 오라클 결과 오염 방지 (가장 고가치) |
| AIO 챌린지 | **항상 필수** | 스팸 챌린지 방지 |
| 어텐션 빌드 | **항상 필수** | 스팸 어텐션 생성 방지 |
| 포스트 작성 | **조건부** | 아래 조건 중 하나라도 해당 시 |
| 댓글/좋아요 | 미적용 | UX 마찰이 수익보다 큼 |
| 예측 참여 | 미적용 | 무료 포인트 행위, 마찰 불필요 |

### 포스트 작성 Smart Captcha 조건

```
다음 중 하나라도 해당하면 captcha 표시:
  - 가입 후 24시간 이내
  - 직전 5분 내 포스트 2개 이상
  - MOM Energy < 100 (신규/저활동 유저)
  - 신고 이력 있는 계정
```

---

## 6. 수익 시뮬레이션

```
MAU 10,000 기준:
  AIO 제출:       ~20건/일  ×  30일  =  ~600건/월
  어텐션 빌드:    ~50건/일  ×  30일  =  ~1,500건/월
  포스트 (조건부): ~200건/일 ×  30일  =  ~6,000건/월
  회원가입:       ~100건/일 ×  30일  =  ~3,000건/월
  ─────────────────────────────────────────
  총 captcha:                             ~11,100건/월

  hCaptcha 수익: ~$0.001/건 × 11,100 = ~$11/월
  HMT 추가 보상: 변동 (Human Protocol 시세에 따라)

MAU 100,000 기준:
  총 captcha: ~111,000건/월
  hCaptcha 수익: ~$111/월 + HMT 추가

MAU 1,000,000 기준:
  총 captcha: ~1,110,000건/월
  hCaptcha 수익: ~$1,110/월 + HMT 추가

⚠️ hCaptcha 수익 자체는 작지만, 핵심 가치는:
  1. 봇 방지 → 플랫폼 데이터 품질 보호
  2. Contribution Ratio의 Trust Score에 기여
  3. AI 라벨링 데이터 파이프라인의 기초
```

---

## 7. 정산 프로세스 (수동 → 자동화)

### 초기 (수동)

```
1. 매월 1일에 hCaptcha Dashboard → Earnings 확인
2. HMT 입금 내역을 Polygonscan으로 확인
3. HMT → USDC 환전 (QuickSwap 등 Polygon DEX)
4. 환전 금액을 platform_hmt_revenue에 INSERT
   INSERT INTO platform_hmt_revenue
     (source, amount_hmt, amount_usd, period_start, period_end,
      captcha_count, wallet_address, tx_hash, status)
   VALUES
     ('hcaptcha', 150.0, 12.50, '2026-05-01', '2026-05-31',
      11100, '0x...', '0x...', 'converted');
5. Reward Pool 합계에 $12.50 추가
6. Contribution Ratio 정산 실행
```

### 향후 (자동화)

```
Supabase Edge Function (cron) 또는 별도 워커:
  1. Polygonscan API로 HMT_PLATFORM_WALLET 입금 감지
  2. 1inch/QuickSwap API로 HMT → USDC 자동 스왑
  3. platform_hmt_revenue 자동 기록
  4. Reward Pool 자동 업데이트
  5. status: 'received' → 'converted' → 'distributed' 자동 전환
```

---

## 8. hCaptcha 대시보드 → 플랫폼 에너지 연결 다이어그램

```
┌──────────────┐    HMT 토큰    ┌──────────────┐
│  hCaptcha    │ ──────────────▶│  Platform    │
│  Dashboard   │    (자동 지급) │  Wallet      │
│              │                │  (Polygon)   │
└──────────────┘                └──────┬───────┘
                                       │
                                       │ 월 1회 정산
                                       ▼
                                ┌──────────────┐
                                │  HMT → USDC  │
                                │  환전         │
                                │  (DEX)       │
                                └──────┬───────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │  Reward Pool │
                                │  편입         │
                                │  (DB 기록)   │
                                └──────┬───────┘
                                       │
                                       │ Contribution Ratio
                                       ▼
                                ┌──────────────┐
                                │  유저별      │
                                │  MOM Energy  │
                                │  분배         │
                                └──────────────┘
```

---

## 9. 체크리스트

### 프로덕션 런칭 전 필수

- [ ] hCaptcha 프로덕션 sitekey 발급
- [ ] hCaptcha secret key 설정
- [ ] 플랫폼 멀티시그 지갑 생성 (Polygon)
- [ ] hCaptcha Dashboard에 지갑 주소 등록
- [ ] HMT Rewards 활성화
- [ ] `.env.local` 테스트 키 → 프로덕션 키 교체
- [ ] captcha_verifications 테이블 마이그레이션 실행
- [ ] platform_hmt_revenue 테이블 마이그레이션 실행
- [ ] 서버 API `/api/captcha/verify`에 captcha_verifications INSERT 로직 추가
- [ ] 포스트 작성 Smart Captcha 조건 구현

### 정산 프로세스

- [ ] 월간 정산 SOP 문서 작성
- [ ] HMT 환전 경로 확정 (DEX or CEX)
- [ ] Reward Pool 편입 자동화 스크립트 작성
- [ ] 어드민 대시보드에 HMT 수익 현황 표시
