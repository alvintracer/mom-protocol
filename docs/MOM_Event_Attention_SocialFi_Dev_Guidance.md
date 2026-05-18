# momment. Event Attention SocialFi 개발 가이던스

> 최신 네이밍 규칙: 서비스명은 `momment.`이고 심볼은 `MOM`이다. 사용자에게 보이는 브랜드명은 `momment.`를 사용한다. 단, `MOM Energy`, `MOM 포인트`, 토큰 심볼, 컨트랙트명처럼 심볼을 의미하는 표현은 `MOM`을 유지한다. 신규 UI는 한국어/영어/스페인어 언어팩 기반으로 작성하고 모바일 웹 뷰를 항상 우선 고려한다. 상세 규칙은 `docs/moment_Product_Implementation_Rules.md`를 따른다.

문서 버전: v0.1  
작성 목적: Codex/개발팀이 MOM 플랫폼 MVP를 바로 설계·구현할 수 있도록 제품 개념, 수익 모델, AIO 오라클 구조, 데이터 모델, 화면, API, 개발 우선순위를 정리한다.  
작성 기준: MOM AIO Design Document, Traverse 예측시장 소셜 피드 UI, Event Attention SocialFi 전략 업데이트

---

## 1. 제품 한 줄 정의

MOM은 사용자가 직접 베팅하는 예측시장이 아니라, 글로벌 예측시장과 현실 이벤트를 기반으로 예측·근거·토론·하입·광고·구독을 발생시키고, 그 과정에서 생성된 플랫폼 수익을 Contribution Ratio 기준으로 투명하게 분배하는 Event Attention SocialFi 플랫폼이다.

핵심 구조는 다음과 같다.

```txt
Global Prediction Markets / Real-world Events
        ↓
MOM Event Feed
        ↓
Users predict, analyze, post evidence, debate, follow creators
        ↓
Attention / Subscription / Ads / Boost / Campaign revenue generated
        ↓
MOM AIO verifies event facts and platform revenue data
        ↓
Reward Pool distributed by Contribution Ratio
```

---

## 2. 절대 원칙

### 2.1 MOM은 베팅 플랫폼이 아니다

MOM 안에서 사용자가 실제 금전을 걸고 YES/NO 포지션을 매수하지 않는다.

금지해야 할 UX:

```txt
YES 매수
NO 매수
진입가
청산가
배당률
베팅금
수익률 ROI
USDC 포지션 사이즈
틀리면 손실
맞히면 배당
```

MOM에서 허용되는 UX:

```txt
예측하기
의견 남기기
근거 제출하기
분석글 작성하기
댓글/토론 참여
크리에이터 팔로우
크리에이터 구독
이벤트룸 입장
게시글 부스트
슈퍼댓글
프리미엄 분석 열람
```

### 2.2 예측은 무료 또는 비환금 포인트 기반이어야 한다

사용자는 예측 자체에 돈을 걸지 않는다.

예측 참여 방식:

```txt
무료 포인트
MOM Energy
경험치 XP
레벨
평판 점수
카테고리 전문성 점수
```

예측 정확도는 현금 배당으로 직접 연결하지 않고, Contribution Ratio를 구성하는 하나의 요소로만 사용한다.

### 2.3 수익은 베팅금이 아니라 소비와 광고에서 발생해야 한다

MOM의 수익원은 다음을 중심으로 한다.

```txt
Creator Subscription
Boost / Promote
Super Comment / Super Signal
Event Room 유료 입장
Sponsored Campaign
Event Ad Slot
Premium Analytics
Data/API
```

---

## 3. 플랫폼 포지셔닝

### 3.1 기존 예측시장과의 차이

| 구분 | Polymarket/Kalshi | MOM |
|---|---|---|
| 핵심 행위 | 결과에 돈을 걸고 거래 | 이벤트에 대한 예측·분석·토론·구독·광고 |
| 수익 발생 | 거래 수수료 | 광고, 구독, 부스트, 유료방, 데이터/API |
| 유저 보상 | 맞히면 금전 수익 | Contribution Ratio 기반 리워드 |
| 법적 포지션 | 이벤트 계약/예측시장 | 이벤트 어텐션 소셜파이, 데이터/미디어 플랫폼 |
| 오라클 | 결과 정산용 | 사실 검증, 근거 검증, 수익 투명성 검증 |

### 3.2 MOM의 실제 역할

MOM은 예측시장 위의 소셜/미디어/오라클 레이어로 존재한다.

사용자는 MOM에서 특정 예측러를 팔로우하고, 분석을 구독하고, 이벤트 토론에 참여한다. 실제 금전 거래를 하고 싶은 사용자는 외부의 합법적 플랫폼 또는 해외 플랫폼을 각자의 판단으로 이용할 수 있다. MOM은 해당 외부 플랫폼에서의 거래를 중개하거나 주문을 실행하지 않는다.

MOM의 역할:

```txt
이벤트 발견
예측러 발견
분석 콘텐츠 소비
근거/증거 검증
커뮤니티 토론
광고/캠페인 집행
크리에이터 수익화
오라클 기반 투명 정산
```

---

## 4. 핵심 수익 모델

아래 6개 모델을 MVP 이후 핵심 수익 모델로 설계한다.

---

### 4.1 Creator Subscription

예측러, 분석가, 카테고리 전문가가 유료 구독 상품을 운영한다.

예시:

```txt
퀀티김의 금리/FOMC 예측 노트
서울알파의 정치 이벤트 브리핑
COYS박의 EPL 라인업 분석
K-pop 컴백 캘린더 알파룸
크립토 상장 루머 검증방
```

수익 구조:

```txt
구독료: 월 3,900원 ~ 49,000원
크리에이터 정산: 70~80%
MOM 플랫폼 수수료: 20~30%
일부 수수료는 MOM Reward Pool로 편입 가능
```

개발 요구사항:

```txt
Creator Profile
Subscription Plan
Subscriber-only Posts
Subscriber-only Event Room
Payment History
Creator Settlement
Platform Fee Accounting
```

---

### 4.2 Boost / Promote

유저 또는 크리에이터가 자기 글, 예측, 분석, 이벤트룸을 더 많이 노출시키기 위해 비용을 지불한다.

예시 상품:

```txt
3,000원: 카테고리 피드 1,000회 추가 노출
10,000원: 이벤트 카드 내 추천 분석 6시간 노출
50,000원: 메인 트렌딩 하단 추천 노출
100,000원: 특정 이벤트룸 내 고정 노출
```

법적 성격:

```txt
예측 결과에 대한 금전 배당이 아니라 콘텐츠 광고/노출권 구매이다.
```

개발 요구사항:

```txt
Boost Product
Boost Order
Impression Tracking
Click Tracking
Budget Exhaustion Logic
Boosted Ranking Logic
Ad Disclosure Label
```

---

### 4.3 Super Comment / Super Signal

유튜브 슈퍼챗처럼 특정 이벤트 토론방에서 자신의 의견을 강조하는 유료 기능이다.

예시:

```txt
댓글 상단 고정
댓글 하이라이트
근거 카드 강조
특정 크리에이터 예측에 후원
라이브 이벤트룸 내 Super Signal 표시
```

핵심 포인트:

```txt
유저는 돈을 걸지 않는다.
돈은 자기 의견과 콘텐츠 노출을 위해 소비한다.
```

개발 요구사항:

```txt
Comment Highlight Payment
Pinned Comment Queue
Super Signal Badge
Creator Tip Settlement
Moderation / Abuse Control
Refund Policy
```

---

### 4.4 Paid Event Room

핫한 이벤트마다 유료 입장 가능한 이벤트룸을 만든다.

예시:

```txt
대선 개표 라이브 예측룸
FOMC 금리 발표 라이브룸
챔피언스리그 결승 분석룸
BTS 컴백 카운트다운룸
업비트 상장 루머 검증룸
```

제공 기능:

```txt
실시간 채팅
AI 이벤트 요약
글로벌 확률 변화
상위 예측러 코멘트
MOM AIO 근거 검증 결과
라이브 투표
구독자 전용 분석 카드
```

수익 구조:

```txt
입장료: 1,000원 ~ 19,900원
크리에이터 또는 룸 호스트 정산 가능
MOM 수수료: 20~30%
일부 수익은 Reward Pool로 편입
```

개발 요구사항:

```txt
Event Room
Room Ticket
Room Access Control
Live Chat
Pinned Analysis
AI Summary
Host Revenue Share
```

---

### 4.5 Sponsored Campaign

브랜드 또는 광고주가 특정 이벤트를 스폰서링한다.

예시:

```txt
치킨 브랜드: 월드컵 한국 16강 진출 이벤트
OTT: 드라마 글로벌 1위 달성 이벤트
증권사: FOMC/금리 이벤트 브리핑
게임사: LCK 우승팀 예측 이벤트
엔터사: 아이돌 컴백 하입 캠페인
크립토 프로젝트: 메인넷 런칭 이벤트
```

유저 행동:

```txt
예측 참여
댓글 작성
근거 제출
공유
친구 초대
브랜드 미션 수행
캠페인 페이지 방문
```

수익 구조:

```txt
광고주 캠페인비 선결제
일부는 MOM 매출
일부는 Reward Pool
일부는 이벤트별 Contributor 보상
```

개발 요구사항:

```txt
Campaign Admin
Sponsor Profile
Campaign Budget
Mission Template
Reward Pool Allocation
Campaign Analytics
Fraud Detection
```

---

### 4.6 Event Ad Slot

각 이벤트 페이지, 이벤트룸, 결과 리포트에 광고 슬롯을 판매한다.

광고 슬롯 예시:

```txt
이벤트 상세 상단 배너
이벤트 카드 네이티브 광고
결과 확정 리포트 중간 광고
이벤트룸 스폰서 영역
카테고리 리더보드 스폰서
크리에이터 프로필 스폰서
```

초기에는 광고 슬롯을 NFT 또는 수익권 토큰으로 만들지 않는다. 법적 리스크를 줄이기 위해 단순 광고 인벤토리/기간 한정 노출권으로 처리한다.

개발 요구사항:

```txt
Ad Slot Inventory
Ad Booking
Sponsor Creative Upload
Impression / Click Tracking
Campaign Period
Ad Review
Revenue Accounting
```

---

### 4.7 hCaptcha + HMT (봇 방지 + 소액 수익)

유저의 주요 액션(AIO 제출, 어텐션 빌드, 포스트 작성)에 hCaptcha 검증을 넣어 봇을 방지하고, Human Protocol(HMT) 토큰 수익을 플랫폼 지갑으로 받는다.

핵심 원칙:

```txt
HMT 수익은 개별 유저에게 직접 지급하지 않는다.
모든 수익은 플랫폼 지갑으로 귀속 → Reward Pool에 편입 → Contribution Ratio로 분배.
```

적용 범위:

```txt
항상 적용: AIO 결과 제출, AIO 챌린지, 어텐션 빌드
조건부 적용: 포스트 작성 (신규 유저, 빈도 초과, 저활동 계정)
미적용: 댓글, 좋아요, 예측 참여
```

수익 플로우:

```txt
유저 captcha 풀이 → hCaptcha가 AI 라벨링 데이터로 활용
→ Human Protocol에서 HMT 토큰 보상
→ 플랫폼 지갑(Polygon)으로 입금
→ 월 1회 정산: HMT → USDC 환전
→ Reward Pool에 편입
→ Contribution Ratio 기반 분배
```

상세 아키텍처: `docs/moment_hCaptcha_HMT_Architecture.md` 참조

개발 요구사항:

```txt
CaptchaGate 컴포넌트 (구현 완료)
서버 검증 API /api/captcha/verify (구현 완료)
captcha_verifications 테이블 (마이그레이션 작성 완료)
platform_hmt_revenue 테이블 (마이그레이션 작성 완료)
Smart Captcha 조건 로직 (포스트 작성용, 미구현)
정산 자동화 스크립트 (미구현)
```

---

### 4.8 디스플레이 광고 (AdSense / Brave / Adshares)

자체 광고 슬롯이 미판매 상태일 때 폴백으로 외부 광고 네트워크를 노출한다.

```txt
광고 우선순위:
1순위: 자체 캠페인 (ad_campaigns에서 active + 예산 잔여)
2순위: Google AdSense (범용 폴백)
3순위: Brave/Adshares (Web3 광고주, 크립토 어텐션에 적합)
4순위: 빈 슬롯 → 자체 프로모션 또는 숨김
```

---

### 4.9 AI 라벨링 데이터 판매

Evidence + LLM Verification 데이터를 구조화하여 AI 학습 데이터로 판매한다.

```txt
유저 Evidence 제출 → LLM 검증 → 품질 점수 태깅
→ 데이터 익스포트 파이프라인 (data_export_batches)
→ AI 학습 데이터로 판매 → Reward Pool에 편입
```

---

## 5. MOM Energy와 Contribution Ratio

### 5.1 개념

MOM Energy는 유저가 플랫폼의 attention, 데이터 품질, 토론, 확산, 수익화에 얼마나 기여했는지를 계량하는 점수이다.

Contribution Ratio는 특정 정산 기간 동안 전체 MOM Energy 중 해당 유저가 차지하는 비율이다.

```txt
User Contribution Ratio = User MOM Energy / Total MOM Energy of Period
```

예시:

```txt
이번 주 전체 MOM Energy: 10,000,000
내 MOM Energy: 52,400
내 Contribution Ratio: 0.524%
이번 주 Reward Pool: 30,000 USDC
내 예상 보상: 157.2 USDC
```

### 5.2 MOM Energy 구성 요소

MOM Energy는 단일 지표가 아니라 복합 지표여야 한다.

권장 초기 가중치:

| 구성 요소 | 설명 | 가중치 |
|---|---|---:|
| Prediction Accuracy | 무료 예측의 정확도 | 25% |
| Evidence Quality | 제출한 근거의 품질과 신뢰도 | 20% |
| Content Impact | 분석글 조회수, 좋아요, 저장, 공유 | 20% |
| Discussion Contribution | 댓글, 토론, 반박, 인용 | 15% |
| Follower / Subscriber Growth | 팔로워 증가, 구독 전환 | 10% |
| Verification Participation | 이벤트 검증 참여, 신고, 반박 | 5% |
| Trust / Anti-abuse Score | 봇 방지, 신고 이력, 장기 신뢰도 | 5% |

중요: Prediction Accuracy만으로 보상을 분배하면 예측 배당처럼 보일 수 있다. 반드시 콘텐츠, 근거, 토론, 확산, 신뢰도 지표를 함께 반영해야 한다.

### 5.3 Energy 계산 예시

```ts
energy =
  predictionAccuracyScore * 0.25 +
  evidenceQualityScore * 0.20 +
  contentImpactScore * 0.20 +
  discussionScore * 0.15 +
  followerGrowthScore * 0.10 +
  verificationScore * 0.05 +
  trustScore * 0.05
```

### 5.4 Reward Pool

Reward Pool은 플랫폼이 실제로 번 수익 중 일부를 유저 보상으로 배정한 풀이다.

편입 가능 수익:

```txt
Creator Subscription 플랫폼 수수료 일부
Boost 매출 일부
Super Comment 매출 일부
Paid Event Room 수수료 일부
Sponsored Campaign 예산 일부
Event Ad Slot 매출 일부
Premium Analytics 매출 일부
Data/API 매출 일부
```

초기 권장 정책:

```txt
월 플랫폼 순매출의 10~30%를 Reward Pool로 배정
캠페인별 스폰서 예산은 별도 Campaign Reward Pool로 운영 가능
```

---

## 6. MOM AIO 모델 포함 설계

MOM AIO는 플랫폼의 두 가지 문제를 해결한다.

1. 이벤트 결과가 실제로 무엇인지 검증한다.
2. 플랫폼 수익과 Reward Pool이 투명하게 계산되었는지 검증한다.

즉, MOM AIO는 단순 결과 오라클이 아니라 Event Truth Oracle + Revenue Transparency Oracle이다.

---

### 6.1 MOM AIO 한 줄 정의

```txt
MOM AIO = 유저 Claim 제출 + Evidence Lite + Multi-LLM 검증 + 온체인 기록 + Challenge Period + 최종 확정
```

기존 문서의 핵심 문장:

```txt
AI가 읽고, 인간이 확인하고, 체인이 기록한다.
Read by AI. Verified by Humans. Sealed on Chain.
```

---

### 6.2 MOM AIO가 검증하는 대상

#### A. Event Outcome Verification

예시:

```txt
BTS가 6월 내 공식 컴백을 발표했는가?
한국은행이 6월 금통위에서 기준금리를 인하했는가?
손흥민이 EPL 15골 이상을 기록했는가?
오세훈 서울시장이 재선에 성공했는가?
```

#### B. Evidence Verification

유저가 제출한 기사, 공시, 공식 발표, SNS, 커뮤니티 글이 claim을 실제로 뒷받침하는지 확인한다.

검증 항목:

```txt
RELEVANCE: claim과 관련 있는가
SUPPORT: claim을 뒷받침하는가
RECENCY: 최신 근거인가
CONSISTENCY: 다른 근거와 모순되지 않는가
SOURCE TRUST: 출처 신뢰도가 충분한가
```

#### C. Revenue Transparency Verification

플랫폼이 특정 기간에 발생시킨 수익을 투명하게 공개하고, Reward Pool 편입액을 검증한다.

예시:

```txt
2026년 6월 1주차 Platform Gross Revenue
Creator Subscription Revenue
Boost Revenue
Super Comment Revenue
Paid Event Room Revenue
Sponsored Campaign Revenue
Event Ad Slot Revenue
Premium Analytics Revenue
Data/API Revenue
Reward Pool Allocation Amount
Distribution Merkle Root
```

---

### 6.3 Evidence Lite

MOM은 기사 전문을 저장하지 않고, 증거 존재와 무결성만 증명한다.

저장 항목:

```txt
URL
제목
발행사
발행일
콘텐츠 해시 SHA-256
스크린샷 썸네일
OG 메타데이터
캡처 노드 서명
캡처 시각
```

저장 위치:

```txt
핵심 메타데이터: 온체인
스크린샷/OG JSON: IPFS 또는 삭제 가능한 객체 스토리지
해시/서명: 온체인
```

---

### 6.4 Multi-LLM Verification

여러 LLM이 독립적으로 근거와 주장을 검증한다.

초기 구현은 실제 4개 LLM을 모두 붙이지 않아도 된다. MVP에서는 adapter 구조만 만들고, 하나의 LLM provider로 시작할 수 있다.

권장 인터페이스:

```ts
interface LLMVerificationResult {
  modelId: string;
  promptVersion: string;
  claimId: string;
  evidenceIds: string[];
  relevance: number;
  support: number;
  recency: number;
  consistency: number;
  confidence: number;
  verdict: 'YES' | 'NO' | 'AMBIGUOUS' | 'INSUFFICIENT_EVIDENCE';
  reasoningHash: string;
  inputHash: string;
  outputHash: string;
  createdAt: string;
}
```

---

### 6.5 Challenge Period

이벤트 결과 또는 revenue distribution에 대해 일정 기간 이의제기할 수 있어야 한다.

이벤트 결과 challenge:

```txt
다른 유저가 counter-evidence 제출
MOM AIO가 동일하게 검증
불일치 시 human review 또는 governance review
```

수익 분배 challenge:

```txt
유저가 자기 Energy 계산, 구독 매출, 부스트 매출, 분배액에 이의제기
시스템은 calculation trace와 merkle proof 제공
관리자/감사 노드가 검토
```

---

### 6.6 온체인 기록 대상

MVP에서는 모든 데이터를 온체인에 올릴 필요는 없다. 우선 해시와 root 중심으로 기록한다.

온체인 기록 권장 항목:

```txt
Event Outcome Finalization Hash
Evidence Bundle Hash
LLM Verification Bundle Hash
Revenue Report Hash
Reward Pool Amount
Distribution Merkle Root
Prompt Version Hash
Publisher Trust Registry Root
```

---

## 7. 주요 사용자 유형

### 7.1 Regular User

기본 유저.

가능 행동:

```txt
이벤트 보기
무료 예측 참여
댓글 작성
좋아요/저장/공유
크리에이터 팔로우
프리미엄 콘텐츠 구매
이벤트룸 입장
```

### 7.2 Predictor / Creator

예측과 분석을 통해 팔로워를 모으는 유저.

가능 행동:

```txt
분석글 작성
구독 플랜 생성
유료 이벤트룸 운영
Super Comment 수익 수령
팔로워 기반 수익화
MOM Energy 적립
Reward Pool 분배 수령
```

### 7.3 Reporter / Verifier

근거를 빠르게 제출하고 이벤트 결과를 검증하는 유저.

가능 행동:

```txt
Evidence 제출
Claim 제출
Counter-evidence 제출
검증 투표
출처 신뢰도 평가
```

### 7.4 Sponsor / Advertiser

이벤트 attention을 구매하는 브랜드 또는 광고주.

가능 행동:

```txt
Sponsored Campaign 생성
Event Ad Slot 구매
Mission 설정
광고 소재 업로드
캠페인 성과 조회
```

### 7.5 Admin / Oracle Operator

플랫폼 운영자.

가능 행동:

```txt
이벤트 소스 관리
외부 마켓 데이터 수집 관리
MOM AIO 검증 모니터링
광고 심사
정산 승인
Revenue Report 발행
Distribution Root 발행
```

---

## 8. 핵심 화면 구성

### 8.1 Home Feed

목적: 사용자가 지금 뜨는 이벤트와 예측러 콘텐츠를 소비하게 한다.

구성:

```txt
추천 피드
팔로잉 피드
카테고리 필터
이벤트 카드
분석글 카드
광고/스폰서 카드
외부 확률 데이터 카드
```

이벤트 카드 표시 항목:

```txt
이벤트 제목
카테고리
외부 시장 확률, 표시 가능할 경우
MOM 커뮤니티 예측 분포
AI 요약
검증 상태
참여자 수
댓글 수
관련 크리에이터
스폰서 여부
```

금지 표시:

```txt
매수/매도 버튼
실제 베팅금
실제 수익률
실제 거래 실행 CTA
```

---

### 8.2 Event Detail Page

구성:

```txt
이벤트 제목
설명
예측 참여 위젯
MOM 커뮤니티 예측 분포
외부 시장 참고 데이터
AI Summary
Top Creator Analysis
Evidence Timeline
MOM AIO Verification Status
Comments / Debate
Ad Slot
Related Events
```

예측 CTA:

```txt
내 예측 남기기
근거 제출하기
분석글 쓰기
이벤트룸 입장
크리에이터 보기
```

---

### 8.3 Creator Profile

구성:

```txt
프로필 정보
카테고리 전문성
MOM Energy
Prediction Accuracy
Follower Count
Subscriber Count
Top Predictions
유료 구독 플랜
최근 분석글
수익/정산 대시보드, 본인에게만 표시
```

---

### 8.4 Reward Dashboard

구성:

```txt
이번 주 Reward Pool
내 MOM Energy
내 Contribution Ratio
예상 분배액
확정 분배액
기여도 상세 breakdown
지난 정산 내역
Distribution Merkle Proof
Revenue Report Hash
```

시각화 예시:

```txt
전체 Energy 100 중 내 위치
카테고리별 Energy
예측 정확도 차트
콘텐츠 반응 차트
수익 풀 성장 차트
```

---

### 8.5 Campaign / Sponsor Dashboard

구성:

```txt
캠페인 생성
예산 설정
타겟 카테고리 선택
미션 설정
광고 소재 업로드
성과 리포트
Reward Pool 편입액 설정
```

---

### 8.6 Oracle Admin Dashboard

구성:

```txt
Pending Claims
Evidence Queue
LLM Verification Results
Disputed Events
Finalization Queue
Revenue Report Queue
Distribution Root Queue
Publisher Trust Registry
Prompt Version Management
```

---

## 9. 데이터 모델 초안

아래는 PostgreSQL 기준 초기 모델이다.

### 9.1 users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  role VARCHAR(30) DEFAULT 'user',
  trust_score NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 9.2 events

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(50),
  source_type VARCHAR(50), -- polymarket, kalshi, manual, news, sponsor
  external_url TEXT,
  external_market_id TEXT,
  status VARCHAR(30) DEFAULT 'open', -- open, pending_resolution, resolved, disputed
  resolution_criteria TEXT,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  resolved_at TIMESTAMP,
  outcome VARCHAR(50),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 9.3 predictions

```sql
CREATE TABLE predictions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  event_id UUID REFERENCES events(id),
  predicted_outcome VARCHAR(50) NOT NULL,
  confidence NUMERIC,
  point_amount NUMERIC DEFAULT 0, -- non-cash/free point only
  rationale TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, event_id)
);
```

### 9.4 posts

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  event_id UUID REFERENCES events(id),
  type VARCHAR(30) DEFAULT 'analysis', -- analysis, evidence, comment, signal
  title TEXT,
  body TEXT,
  visibility VARCHAR(30) DEFAULT 'public', -- public, subscribers_only, paid
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 9.5 evidence

```sql
CREATE TABLE evidence (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  submitted_by UUID REFERENCES users(id),
  url TEXT NOT NULL,
  title TEXT,
  publisher TEXT,
  published_at TIMESTAMP,
  captured_at TIMESTAMP,
  content_hash TEXT,
  metadata_hash TEXT,
  screenshot_url TEXT,
  source_trust_score NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);
```

### 9.6 aio_claims

```sql
CREATE TABLE aio_claims (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  submitted_by UUID REFERENCES users(id),
  claim_text TEXT NOT NULL,
  claimed_outcome VARCHAR(50),
  status VARCHAR(30) DEFAULT 'pending', -- pending, verified, rejected, disputed, finalized
  evidence_bundle_hash TEXT,
  llm_bundle_hash TEXT,
  onchain_tx_hash TEXT,
  challenge_ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 9.7 llm_verifications

```sql
CREATE TABLE llm_verifications (
  id UUID PRIMARY KEY,
  claim_id UUID REFERENCES aio_claims(id),
  model_id TEXT,
  prompt_version TEXT,
  input_hash TEXT,
  output_hash TEXT,
  verdict VARCHAR(50),
  confidence NUMERIC,
  relevance NUMERIC,
  support NUMERIC,
  recency NUMERIC,
  consistency NUMERIC,
  reasoning TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

### 9.8 subscriptions

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  subscriber_id UUID REFERENCES users(id),
  creator_id UUID REFERENCES users(id),
  plan_id UUID,
  status VARCHAR(30) DEFAULT 'active',
  price_amount NUMERIC NOT NULL,
  currency VARCHAR(10) DEFAULT 'KRW',
  started_at TIMESTAMP DEFAULT now(),
  renews_at TIMESTAMP,
  canceled_at TIMESTAMP
);
```

### 9.9 monetization_orders

```sql
CREATE TABLE monetization_orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type VARCHAR(50), -- boost, super_comment, event_room_ticket, premium, subscription
  target_type VARCHAR(50),
  target_id UUID,
  gross_amount NUMERIC NOT NULL,
  platform_fee NUMERIC DEFAULT 0,
  creator_share NUMERIC DEFAULT 0,
  reward_pool_share NUMERIC DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'KRW',
  status VARCHAR(30) DEFAULT 'paid',
  created_at TIMESTAMP DEFAULT now()
);
```

### 9.10 reward_periods

```sql
CREATE TABLE reward_periods (
  id UUID PRIMARY KEY,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  gross_revenue NUMERIC DEFAULT 0,
  reward_pool_amount NUMERIC DEFAULT 0,
  total_energy NUMERIC DEFAULT 0,
  revenue_report_hash TEXT,
  distribution_merkle_root TEXT,
  onchain_tx_hash TEXT,
  status VARCHAR(30) DEFAULT 'draft', -- draft, published, challenged, finalized, distributed
  created_at TIMESTAMP DEFAULT now()
);
```

### 9.11 user_energy_snapshots

```sql
CREATE TABLE user_energy_snapshots (
  id UUID PRIMARY KEY,
  reward_period_id UUID REFERENCES reward_periods(id),
  user_id UUID REFERENCES users(id),
  prediction_score NUMERIC DEFAULT 0,
  evidence_score NUMERIC DEFAULT 0,
  content_score NUMERIC DEFAULT 0,
  discussion_score NUMERIC DEFAULT 0,
  follower_score NUMERIC DEFAULT 0,
  verification_score NUMERIC DEFAULT 0,
  trust_score NUMERIC DEFAULT 0,
  total_energy NUMERIC DEFAULT 0,
  contribution_ratio NUMERIC DEFAULT 0,
  estimated_reward NUMERIC DEFAULT 0,
  finalized_reward NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);
```

---

## 10. API 초안

### 10.1 Event API

```txt
GET    /api/events
GET    /api/events/:id
POST   /api/events
PATCH  /api/events/:id
GET    /api/events/:id/predictions
GET    /api/events/:id/posts
GET    /api/events/:id/evidence
```

### 10.2 Prediction API

```txt
POST   /api/events/:id/predictions
PATCH  /api/predictions/:id
GET    /api/users/:id/predictions
```

### 10.3 Post / Social API

```txt
POST   /api/posts
GET    /api/posts/:id
POST   /api/posts/:id/like
POST   /api/posts/:id/share
POST   /api/posts/:id/comments
POST   /api/posts/:id/boost
POST   /api/posts/:id/super-comment
```

### 10.4 Creator Monetization API

```txt
POST   /api/creators/:id/subscribe
GET    /api/creators/:id/plans
POST   /api/creators/:id/plans
GET    /api/me/subscriptions
GET    /api/me/creator-revenue
```

### 10.5 Event Room API

```txt
POST   /api/event-rooms
GET    /api/event-rooms/:id
POST   /api/event-rooms/:id/buy-ticket
POST   /api/event-rooms/:id/messages
GET    /api/event-rooms/:id/messages
```

### 10.6 AIO API

```txt
POST   /api/aio/claims
POST   /api/aio/claims/:id/evidence
POST   /api/aio/claims/:id/verify
POST   /api/aio/claims/:id/challenge
POST   /api/aio/claims/:id/finalize
GET    /api/aio/claims/:id
GET    /api/aio/events/:eventId/status
```

### 10.7 Reward API

```txt
GET    /api/rewards/current
GET    /api/rewards/periods/:id
GET    /api/me/energy
GET    /api/me/rewards
POST   /api/admin/rewards/calculate
POST   /api/admin/rewards/publish-report
POST   /api/admin/rewards/finalize
```

---

## 11. MVP 개발 우선순위

### Sprint 1: 기본 소셜 이벤트 피드

목표:

```txt
유저가 이벤트를 보고, 무료 예측하고, 글/댓글을 작성할 수 있다.
```

구현:

```txt
Auth
User Profile
Event List
Event Detail
Prediction Submit
Post / Comment
Like / Share
Basic Feed
```

---

### Sprint 2: Creator Layer

목표:

```txt
예측러가 팔로워를 모으고 구독 상품을 만들 수 있다.
```

구현:

```txt
Creator Profile
Follow
Subscription Plan
Subscriber-only Post
Payment Mock or PG Integration Stub
Creator Dashboard
```

---

### Sprint 3: Monetization Layer

목표:

```txt
플랫폼이 실제 소비 매출을 만들 수 있다.
```

구현:

```txt
Boost
Super Comment
Paid Event Room
Monetization Orders
Revenue Accounting
```

---

### Sprint 4: MOM Energy / Reward Dashboard

목표:

```txt
유저가 자신의 기여도와 예상 보상을 볼 수 있다.
```

구현:

```txt
Energy Calculation Batch
Reward Period
Contribution Ratio
Reward Dashboard
Revenue Pool Visualization
```

---

### Sprint 5: AIO MVP

목표:

```txt
이벤트 결과와 근거를 AIO 방식으로 검증할 수 있다.
```

구현:

```txt
Claim Submission
Evidence Capture
LLM Verification Adapter
AIO Status
Challenge Period
Finalization
Evidence Hash
Verification Hash
```

---

### Sprint 6: Sponsor / Ad Slot

목표:

```txt
광고주가 이벤트 기반 캠페인을 집행할 수 있다.
```

구현:

```txt
Sponsor Account
Campaign Create
Ad Slot Booking
Mission Template
Campaign Dashboard
Ad Impression Tracking
Campaign Reward Pool
```

---

## 12. 외부 예측시장 데이터 활용 방식

MOM은 Polymarket, Kalshi, 기타 예측시장 데이터를 거래 기능으로 사용하지 않고, 이벤트 discovery와 참고 확률 데이터로 사용한다.

표시 방식:

```txt
외부 시장 참고 확률
외부 시장 링크
확률 변동 차트
MOM 커뮤니티 예측 분포와 비교
AI 요약
```

주의사항:

```txt
MOM 내 매수/매도 버튼 제공 금지
MOM 내 주문 라우팅 금지
MOM 내 베팅금 예치 금지
외부 플랫폼 이용은 사용자의 독립적 판단 영역으로 표시
상업적 API/데이터 재사용은 각 플랫폼 약관 검토 필요
```

권장 CTA:

```txt
외부 시장 보기
관련 데이터 보기
이 이벤트에 대한 내 예측 남기기
이 이벤트 분석글 보기
크리에이터 의견 보기
```

비권장 CTA:

```txt
지금 베팅하기
YES 매수
NO 매수
수익 내기
```

---

## 13. 규제/법무 안전장치

### 13.1 필수 문구

서비스 소개에 아래 취지를 반영한다.

```txt
MOM은 예측시장 또는 베팅 서비스를 제공하지 않습니다.
MOM 내 예측 기능은 커뮤니티 의견, 평판, 콘텐츠 추천, 리워드 산정 참고를 위한 비금전성 참여 기능입니다.
MOM은 외부 플랫폼의 거래를 중개, 권유, 대행하지 않습니다.
MOM의 리워드는 예측 적중 배당이 아니라, 콘텐츠·근거·토론·검증·확산 기여도에 기반한 플랫폼 보상 프로그램입니다.
```

### 13.2 UX 금지사항

```txt
베팅, 배당, 도박, 투자수익, 원금, 수익률, 지분, 배당권, 수익권 표현 금지
유저 예치금을 결과에 따라 나누는 구조 금지
적중자에게만 금전 보상하는 구조 금지
유료 시즌패스 금액을 상금풀처럼 직접 재분배하는 구조 금지
```

### 13.3 보상 설계 안전장치

```txt
Reward Pool은 플랫폼 수익 일부를 재량적으로 배정하는 크리에이터/커뮤니티 보상 프로그램으로 설계
Contribution Ratio는 예측 정확도 외에도 콘텐츠, 근거, 토론, 확산, 신뢰도 등 복합 지표로 산정
유저가 돈을 걸거나 잃는 구조 제거
수익권 토큰/NFT 형태는 초기 단계에서 지양
```

---

## 14. Codex 개발 지시용 요약 프롬프트

아래 내용을 Codex에게 그대로 전달해도 된다.

```txt
Build an MVP for MOM Event Attention SocialFi.

MOM is not a betting or prediction market platform. Users do not buy YES/NO shares or stake real money on outcomes. Instead, users participate in event predictions with non-cash points, write analysis posts, submit evidence, comment, follow creators, subscribe to creators, boost posts, send super comments, and join paid event rooms.

The platform monetizes through creator subscriptions, boost/promote, super comments, paid event rooms, sponsored campaigns, event ad slots, premium analytics, and data/API. A portion of platform revenue forms a Reward Pool. Users receive rewards based on MOM Energy and Contribution Ratio, which are calculated from prediction accuracy, evidence quality, content impact, discussion contribution, follower/subscriber growth, verification participation, and trust score. Prediction accuracy must not be the only reward factor.

Include an AIO module. MOM AIO verifies event outcomes and revenue transparency. It uses claim submission, evidence capture, Evidence Lite metadata/hash storage, LLM verification, challenge period, and finalization. Store evidence hashes, LLM verification hashes, revenue report hashes, and reward distribution Merkle roots for auditability.

Prioritize these modules:
1. Auth and user profiles
2. Event feed and event detail pages
3. Free/non-cash predictions
4. Posts, comments, likes, shares
5. Creator profiles and subscriptions
6. Boost and super comments
7. Paid event rooms
8. MOM Energy calculation and Reward Dashboard
9. AIO claim/evidence/LLM verification module
10. Sponsored campaign and ad slot dashboard

Avoid any UI language such as betting, buy YES, buy NO, wagering, payout odds, ROI from bets, position size, or real-money outcome trading. Use language such as predict, contribute, analyze, evidence, creator, attention, MOM Energy, Contribution Ratio, Reward Pool, and event verification.
```

---

## 15. 최종 제품 내러티브

MOM은 예측시장 자체가 아니라 예측시장과 현실 이벤트 위에 존재하는 어텐션·크리에이터·오라클 레이어이다.

예측러는 MOM에서 자신의 의견과 분석을 홍보하고, 팔로워를 모으고, 유료 구독자와 이벤트룸을 운영한다. 일반 유저는 이들의 예측과 분석을 참고해 외부 플랫폼에서 각자 판단할 수 있지만, MOM은 거래를 중개하지 않는다.

MOM은 이벤트를 중심으로 attention을 만들고, 그 attention을 광고·구독·부스트·캠페인·데이터 매출로 전환한다. 그리고 MOM AIO는 이벤트의 진실과 플랫폼 수익, 리워드 분배를 투명하게 검증한다.

최종적으로 MOM은 다음과 같이 정의된다.

```txt
MOM = Event Feed + Prediction Creator Economy + Attention Monetization + AIO Oracle + Transparent Reward Distribution
```
