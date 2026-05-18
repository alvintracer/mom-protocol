import type {
  ContributionBreakdown,
  Creator,
  Event,
  Evidence,
  Prediction,
  RewardPool,
} from "@/shared/types/domain";
import { dictionary } from "@/shared/i18n/dictionaries";
import { text } from "@/shared/i18n/config";

export const events: Event[] = [
  {
    id: "mock-event-id",
    title: text(
      "6월 FOMC 이후 기준금리 방향성",
      "Interest-rate direction after the June FOMC",
      "Direccion de tasas despues del FOMC de junio",
    ),
    summary: text(
      "연준 발언, 고용 지표, 물가 흐름을 근거로 다음 금리 경로를 예측하고 토론하는 이벤트입니다.",
      "An event for predicting and discussing the next rate path using Fed comments, labor data, and inflation signals.",
      "Un evento para predecir y debatir la proxima ruta de tasas con comentarios de la Fed, empleo e inflacion.",
    ),
    category: "경제",
    status: "open",
    attentionScore: 94,
    participantCount: 12840,
    evidenceCount: 42,
    predictionCount: 3180,
    endsAt: "2026-06-12T23:59:00+09:00",
    sourceName: text(
      "글로벌 이벤트 데이터",
      "Global event data",
      "Datos globales de eventos",
    ),
    sourceUrl: "https://example.com/events/fomc",
    oracleState: "검증 중",
    tags: [
      text("FOMC", "FOMC", "FOMC"),
      text("물가", "Inflation", "Inflacion"),
      text("고용", "Labor", "Empleo"),
    ],
  },
  {
    id: "kpop-comeback-calendar",
    title: text(
      "상반기 K-pop 대형 컴백 일정 공개 여부",
      "Whether a major K-pop comeback schedule will be announced in H1",
      "Si se anunciara un gran calendario de comeback K-pop en el primer semestre",
    ),
    summary: text(
      "기획사 공지, 음원 유통 메타데이터, 팬 커뮤니티 근거를 모아 컴백 일정 가능성을 분석합니다.",
      "Analyzes comeback schedule signals from agency notices, music distribution metadata, and fan-community evidence.",
      "Analiza senales de comeback desde comunicados, metadatos de distribucion musical y evidencia de comunidades de fans.",
    ),
    category: "엔터",
    status: "open",
    attentionScore: 88,
    participantCount: 9230,
    evidenceCount: 36,
    predictionCount: 2114,
    endsAt: "2026-05-30T18:00:00+09:00",
    sourceName: text(
      "공개 뉴스 및 커뮤니티 신호",
      "Public news and community signals",
      "Noticias publicas y senales comunitarias",
    ),
    sourceUrl: "https://example.com/events/kpop",
    oracleState: "대기",
    tags: [
      text("K-pop", "K-pop", "K-pop"),
      text("컴백", "Comeback", "Comeback"),
      text("캘린더", "Calendar", "Calendario"),
    ],
  },
  {
    id: "crypto-listing-signal",
    title: text(
      "주요 거래소 신규 자산 상장 발표 가능성",
      "Possible new-asset listing announcement by a major exchange",
      "Posible anuncio de listado de nuevo activo por un exchange principal",
    ),
    summary: text(
      "공개 저장소 변경, 지갑 이동, 공지 패턴을 근거로 상장 발표 가능성을 추적합니다.",
      "Tracks listing-announcement signals through public repository changes, wallet movement, and notice patterns.",
      "Rastrea senales de anuncio mediante cambios en repositorios publicos, movimientos de wallet y patrones de avisos.",
    ),
    category: "크립토",
    status: "verifying",
    attentionScore: 81,
    participantCount: 7050,
    evidenceCount: 27,
    predictionCount: 1655,
    endsAt: "2026-05-24T23:59:00+09:00",
    sourceName: text(
      "온체인 및 공개 공지",
      "On-chain and public notices",
      "On-chain y avisos publicos",
    ),
    sourceUrl: "https://example.com/events/listing",
    oracleState: "검증 중",
    tags: [
      text("상장", "Listing", "Listado"),
      text("온체인", "On-chain", "On-chain"),
      text("공지", "Notice", "Aviso"),
    ],
  },
];

export const creators: Creator[] = [
  {
    id: "creator-quantikim",
    handle: "mock-handle",
    name: text("퀀티김", "Quanti Kim", "Quanti Kim"),
    specialty: text("금리/FOMC 분석", "Rates/FOMC analysis", "Analisis de tasas/FOMC"),
    bio: text(
      "거시 지표와 중앙은행 발언을 연결해 이벤트별 핵심 근거를 정리합니다.",
      "Connects macro indicators and central-bank comments into concise evidence for each event.",
      "Conecta indicadores macro y comentarios de bancos centrales en evidencia clara para cada evento.",
    ),
    trustScore: 91,
    momEnergy: 18400,
    contributionRatio: 12.8,
    subscriberCount: 4820,
    avatarInitials: "QK",
  },
  {
    id: "creator-seoulalpha",
    handle: "seoul-alpha",
    name: text("서울알파", "Seoul Alpha", "Seoul Alpha"),
    specialty: text("정치 이벤트 브리핑", "Political event briefings", "Briefings de eventos politicos"),
    bio: text(
      "여론 흐름, 일정, 공개 발언을 구조화해 검증 가능한 예측 노트를 만듭니다.",
      "Structures polling movement, schedules, and public comments into verifiable prediction notes.",
      "Estructura encuestas, calendarios y declaraciones publicas en notas predictivas verificables.",
    ),
    trustScore: 87,
    momEnergy: 14220,
    contributionRatio: 9.6,
    subscriberCount: 3190,
    avatarInitials: "SA",
  },
  {
    id: "creator-signalpark",
    handle: "signal-park",
    name: text("시그널박", "Signal Park", "Signal Park"),
    specialty: text("크립토 공개 신호", "Crypto public signals", "Senales publicas cripto"),
    bio: text(
      "거래소 공지 패턴과 온체인 흐름에서 과장 없는 근거 카드를 선별합니다.",
      "Selects grounded evidence cards from exchange notice patterns and on-chain flows.",
      "Selecciona tarjetas de evidencia solidas desde patrones de avisos de exchanges y flujos on-chain.",
    ),
    trustScore: 84,
    momEnergy: 12950,
    contributionRatio: 8.4,
    subscriberCount: 2710,
    avatarInitials: "SP",
  },
];

export const predictions: Prediction[] = [
  {
    id: "prediction-fomc-soft",
    eventId: "mock-event-id",
    creatorHandle: "mock-handle",
    label: text(
      "동결 후 완화적 발언 가능성",
      "Possible dovish remarks after holding rates",
      "Posibles comentarios expansivos despues de mantener tasas",
    ),
    confidence: 67,
    rationale: text(
      "최근 물가 둔화 속도는 충분하지 않지만 고용 냉각 신호가 누적되어 발언 톤은 완화될 가능성이 있습니다.",
      "Inflation has not slowed enough, but accumulating labor cooling signals may soften the tone.",
      "La inflacion no se ha desacelerado lo suficiente, pero las senales de enfriamiento laboral pueden suavizar el tono.",
    ),
    momEnergyUsed: 320,
    createdAt: "2026-05-15T09:30:00+09:00",
  },
  {
    id: "prediction-kpop-announcement",
    eventId: "kpop-comeback-calendar",
    creatorHandle: "seoul-alpha",
    label: text(
      "월말 전 티저 일정 공개",
      "Teaser schedule before month-end",
      "Calendario teaser antes de fin de mes",
    ),
    confidence: 72,
    rationale: text(
      "유통사 등록 주기와 최근 소셜 채널 이미지 변경이 기존 컴백 전개와 유사합니다.",
      "Distribution registration timing and recent social-channel image changes resemble prior comeback rollouts.",
      "El registro de distribucion y cambios recientes en redes se parecen a lanzamientos previos.",
    ),
    momEnergyUsed: 210,
    createdAt: "2026-05-14T21:10:00+09:00",
  },
  {
    id: "prediction-listing-watch",
    eventId: "crypto-listing-signal",
    creatorHandle: "signal-park",
    label: text(
      "검증 후 발표 가능성 유지",
      "Announcement remains possible after verification",
      "El anuncio sigue siendo posible tras verificacion",
    ),
    confidence: 58,
    rationale: text(
      "지갑 이동은 포착됐지만 공식 공지 직전 패턴과 일치하는 추가 근거는 아직 부족합니다.",
      "Wallet movement was detected, but additional signals matching pre-notice patterns are still limited.",
      "Se detecto movimiento de wallet, pero aun faltan senales adicionales que coincidan con patrones previos.",
    ),
    momEnergyUsed: 180,
    createdAt: "2026-05-15T14:45:00+09:00",
  },
];

export const evidence: Evidence[] = [
  {
    id: "evidence-cpi-trend",
    eventId: "mock-event-id",
    submittedByHandle: "mock-handle",
    title: text(
      "최근 CPI 세부 항목 둔화 흐름",
      "Recent cooling in CPI subcomponents",
      "Enfriamiento reciente en componentes del CPI",
    ),
    sourceName: text(
      "공개 경제 캘린더",
      "Public economic calendar",
      "Calendario economico publico",
    ),
    url: "https://example.com/evidence/cpi",
    summary: text(
      "주거비와 서비스 물가의 방향성이 엇갈려 금리 경로 판단에 추가 확인이 필요합니다.",
      "Shelter and services inflation are moving unevenly, so the rate path needs more confirmation.",
      "Vivienda y servicios se mueven de forma desigual, por lo que la ruta de tasas requiere mas confirmacion.",
    ),
    verificationScore: 86,
    submittedAt: "2026-05-15T10:00:00+09:00",
  },
  {
    id: "evidence-dotplot-comments",
    eventId: "mock-event-id",
    submittedByHandle: "seoul-alpha",
    title: text(
      "위원 발언에서 반복된 데이터 의존 문구",
      "Repeated data-dependence language in member remarks",
      "Lenguaje repetido de dependencia de datos en comentarios",
    ),
    sourceName: text(
      "공개 연설 기록",
      "Public speech records",
      "Registros publicos de discursos",
    ),
    url: "https://example.com/evidence/fed-comments",
    summary: text(
      "최근 세 차례 발언에서 정책 경로를 확정하지 않는 표현이 반복되었습니다.",
      "The last three remarks repeatedly avoided locking in a policy path.",
      "Los ultimos tres comentarios evitaron fijar una ruta de politica.",
    ),
    verificationScore: 79,
    submittedAt: "2026-05-15T11:20:00+09:00",
  },
  {
    id: "evidence-exchange-wallet",
    eventId: "crypto-listing-signal",
    submittedByHandle: "signal-park",
    title: text(
      "거래소 관련 지갑의 테스트 전송",
      "Test transfer from an exchange-linked wallet",
      "Transferencia de prueba desde wallet vinculada a exchange",
    ),
    sourceName: text(
      "공개 온체인 탐색기",
      "Public on-chain explorer",
      "Explorador on-chain publico",
    ),
    url: "https://example.com/evidence/wallet",
    summary: text(
      "소액 테스트 전송은 확인되지만 단독 근거로 확정하기에는 신뢰도가 제한적입니다.",
      "A small test transfer is visible, but it is not strong enough as standalone evidence.",
      "Hay una pequena transferencia de prueba, pero no basta como evidencia independiente.",
    ),
    verificationScore: 72,
    submittedAt: "2026-05-15T15:10:00+09:00",
  },
];

export const rewardPool: RewardPool = {
  id: "reward-pool-may-2026",
  title: text(
    "2026년 5월 momment vault",
    "May 2026 momment vault",
    "momment vault de mayo 2026",
  ),
  monthlyLabel: text(
    "이번 달 분배 예정 vault",
    "This month's scheduled vault",
    "Vault programado de este mes",
  ),
  totalAmountLabel: "126,400,000 MOM",
  monthlyAmountLabel: "24,800,000 MOM",
  cumulativeAmountLabel: "126,400,000 MOM",
  distributedAmountLabel: "78,300,000 MOM",
  period: "2026.05.01 - 2026.05.31",
  nextDistributionDate: "2026.06.01",
  fillPercent: 72,
  activeContributors: 18420,
  status: text("집계 중", "Collecting", "En recopilacion"),
  sourceMix: [
    {
      label: text("크리에이터 구독", "Creator subscriptions", "Suscripciones de creadores"),
      percent: 38,
      amountLabel: "9.4M",
      colorClass: "bg-blue-600",
    },
    {
      label: text("어텐션 부스트", "Attention boosts", "Boosts de attention"),
      percent: 27,
      amountLabel: "6.7M",
      colorClass: "bg-sky-500",
    },
    {
      label: text("슈퍼 댓글", "Super comments", "Super comentarios"),
      percent: 18,
      amountLabel: "4.5M",
      colorClass: "bg-cyan-500",
    },
    {
      label: text("스폰서 캠페인", "Sponsored campaigns", "Campanas patrocinadas"),
      percent: 17,
      amountLabel: "4.2M",
      colorClass: "bg-indigo-500",
    },
  ],
};

export const contributionBreakdown: ContributionBreakdown[] = [
  {
    id: "contribution-quantikim",
    creatorHandle: "mock-handle",
    predictionAccuracy: 31,
    evidenceQuality: 28,
    discussionImpact: 19,
    attentionSpread: 22,
    contributionRatio: 12.8,
  },
  {
    id: "contribution-seoulalpha",
    creatorHandle: "seoul-alpha",
    predictionAccuracy: 26,
    evidenceQuality: 24,
    discussionImpact: 25,
    attentionSpread: 25,
    contributionRatio: 9.6,
  },
  {
    id: "contribution-signalpark",
    creatorHandle: "signal-park",
    predictionAccuracy: 22,
    evidenceQuality: 34,
    discussionImpact: 16,
    attentionSpread: 28,
    contributionRatio: 8.4,
  },
];

export const disclaimer = dictionary.disclaimer;
