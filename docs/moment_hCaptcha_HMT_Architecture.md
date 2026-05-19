# momment. hCaptcha 봇 방지 아키텍처

> 문서 버전: v2.0
> 최종 업데이트: 2026-05-19
> 관련 코드: `src/shared/components/captcha/`, `src/app/api/captcha/`, `supabase/migrations/20260519000000_hcaptcha_captcha_verifications.sql`

---

> [!WARNING]
> **hCaptcha 퍼블리셔 보상(HMT 수익)은 2023년에 종료되었습니다.**
> hCaptcha는 봇 방지 도구로만 사용합니다. HMT 토큰 수익은 발생하지 않습니다.
> 수익화는 별도 채널(AdSense, Brave Creators, Adshares 등)로 진행합니다.

---

## 1. 핵심 목적

```
hCaptcha = 봇 방지 도구 (수익 도구 아님)

사용 이유:
  ✅ 오라클 스팸 제출 차단 (AIO 결과 오염 방지)
  ✅ 스팸 어텐션/포스트 생성 차단
  ✅ reCAPTCHA보다 프라이버시 친화적
  ✅ 무료 퍼블리셔 플랜
  ✅ Trust Score / Contribution Ratio에 반영 가능

수익 기대:
  ❌ HMT 토큰 수익 → 2023년 종료
  ❌ 퍼블리셔 보상 → 없음
```

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
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. hCaptcha 설정 가이드

### 3.1 퍼블리셔 계정 생성

```
1. https://dashboard.hcaptcha.com/signup?type=publisher 접속
2. "Add hCaptcha to my website or app" 선택
3. 이메일 + 비밀번호 입력 → 이메일 인증 완료
```

### 3.2 사이트 등록

```
대시보드 로그인 후:
  1. Sites → New Site
  2. Site Name: momment.
  3. Hostnames: 프로덕션 도메인 + localhost (개발용)
  4. Difficulty: Auto
  5. Save → sitekey 발급
```

### 3.3 키 발급

```
발급되는 두 가지:
  sitekey:   프론트엔드에 사용 (공개 가능)
  secretkey: 백엔드에만 사용 (절대 공개 금지)
```

### 3.4 환경변수 설정

```env
# .env.local

# 프로덕션 키
NEXT_PUBLIC_HCAPTCHA_SITEKEY=<대시보드에서 발급받은 sitekey>
HCAPTCHA_SECRET=<대시보드에서 복사한 secret key>

# 개발 테스트용 (항상 성공 반환)
NEXT_PUBLIC_HCAPTCHA_SITEKEY=10000000-ffff-ffff-ffff-000000000001
HCAPTCHA_SECRET=0x0000000000000000000000000000000000000000
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
  - captcha_verifications 테이블에 기록
```

### 4.3 데이터베이스

```sql
-- 개별 검증 기록
captcha_verifications
  - id, user_id, action_type, verified, created_at
  - 용도: 유저별 captcha 빈도 분석, Smart Captcha 결정, Trust Score 반영
```

---

## 5. CaptchaGate 적용 매트릭스

| 액션 | 적용 방식 | 이유 |
|------|----------|------|
| AIO 결과 제출 | **항상 필수** | 오라클 결과 오염 방지 (가장 고가치) |
| AIO 챌린지 | **항상 필수** | 스팸 챌린지 방지 |
| 어텐션 빌드 | **항상 필수** | 스팸 어텐션 생성 방지 |
| 포스트 작성 | **조건부** | 아래 조건 중 하나라도 해당 시 |
| 댓글/좋아요 | 미적용 | UX 마찰이 가치보다 큼 |
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

## 6. Trust Score 반영

captcha 검증 데이터는 MOM Energy의 Trust Score에 반영됩니다.

```
MOM Energy 구성:
  - Prediction Accuracy (25%)
  - Evidence Quality (20%)
  - Content Impact (20%)
  - Discussion Contribution (15%)
  - Follower Growth (10%)
  - Verification Participation (5%)  ← hCaptcha 정상 완료 횟수
  - Trust / Anti-abuse Score (5%)    ← 봇 의심 패턴 없음 확인
```

---

## 7. 수익화는 별도 채널로

hCaptcha에서 수익이 발생하지 않으므로, 플랫폼 수익화는 다음 채널로 진행:

```
현재 가능한 수익 채널:

1. Brave Creators (BAT 수령)
   https://publishers.basicattentiontoken.org/
   → Brave 브라우저 유저 방문 시 BAT 토큰 수령
   → 설정 10분, 즉시 가동

2. Google AdSense
   https://adsense.google.com/
   → 범용 디스플레이 광고, RPM $1~5
   → 승인 필요 (트래픽 기반)

3. Adshares (Web3 광고)
   https://adshares.net/
   → 크립토/Web3 광고주 타겟
   → momment. 유저 특성에 적합

4. 자체 광고 슬롯 (Event Ad Slot)
   → Dev Guidance 4.6절 참조
   → 직접 판매 또는 셀프서브

5. 기존 수익 모델
   → 구독, 부스트, 슈퍼코멘트, 이벤트룸
   → Dev Guidance 4.1~4.5절 참조
```

---

## 8. 체크리스트

### 프로덕션 런칭 전 필수

- [ ] hCaptcha 퍼블리셔 계정 생성
- [ ] 사이트 등록 + sitekey/secret 발급
- [ ] `.env.local` 테스트 키 → 프로덕션 키 교체
- [ ] captcha_verifications 테이블 마이그레이션 실행
- [ ] 포스트 작성 Smart Captcha 조건 구현
- [ ] Brave Creators 등록 (BAT 수익)
- [ ] Google AdSense 승인 신청

### 완료된 것

- [x] CaptchaGate 컴포넌트 구현
- [x] `/api/captcha/verify` 엔드포인트 구현
- [x] AIO Assertion Form에 captcha 연동
- [x] 어텐션 빌드 페이지에 captcha 연동
- [x] i18n 다국어 지원 (ko/en/es)
