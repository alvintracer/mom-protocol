import { text, type LocalizedText } from "@/shared/i18n/config";

export type ExploreAttention = {
  id: string;
  slug?: string | null;
  title: LocalizedText;
  summary: LocalizedText | null;
  category: "economics" | "politics" | "crypto" | "sports" | "entertainment" | "ai";
  urgency: "breaking" | "hot" | "steady";
  referenceSignal: number;
  attentionScore: number;
  participantCount: number;
  postCount: number;
  sourceCount: number;
  sources: string[];
  topics: string[];
  outcomes: string[];
  endsInLabel: LocalizedText;
  ruleStatus: "ready" | "draft";
  sponsor?: {
    name: string;
    logoUrl?: string | null;
    tagline?: string | null;
    url: string;
    color?: string | null;
  } | null;
  resolvedOutcome?: string | null;
};

export type ExploreTopic = {
  slug: string;
  label: string;
  count: number;
  trend: string;
};

export const exploreAttentions: ExploreAttention[] = [
  {
    id: "fed-june-path",
    title: text(
      "6월 FOMC 이후 기준금리 방향성",
      "Interest-rate direction after the June FOMC",
      "Direccion de tasas despues del FOMC de junio",
    ),
    summary: text(
      "Polymarket, Kalshi, 공개 경제 캘린더의 같은 금리 이벤트를 하나의 어텐션으로 묶었습니다.",
      "A unified attention combining related rate-event references from Polymarket, Kalshi, and public economic calendars.",
      "Una attention unificada con referencias de tasas de Polymarket, Kalshi y calendarios economicos publicos.",
    ),
    category: "economics",
    urgency: "breaking",
    referenceSignal: 71,
    attentionScore: 96,
    participantCount: 12840,
    postCount: 384,
    sourceCount: 4,
    sources: ["momment.", "Polymarket", "Kalshi", "Manifold"],
    topics: ["FOMC", "Inflation", "Rates"],
    outcomes: ["25bp Cut", "Hold", "25bp Hike"],
    endsInLabel: text("27일 남음", "27d left", "faltan 27d"),
    ruleStatus: "ready",
  },
  {
    id: "korea-election-turnout",
    title: text(
      "전국 단위 선거 투표율 65% 돌파 여부",
      "Whether national election turnout crosses 65%",
      "Si la participacion electoral nacional supera 65%",
    ),
    summary: text(
      "선관위 공개 데이터와 글로벌 정치 이벤트 출처를 연결한 정치 어텐션입니다.",
      "A politics attention connecting election commission data with global political event references.",
      "Una attention politica que conecta datos electorales oficiales con referencias globales.",
    ),
    category: "politics",
    urgency: "hot",
    referenceSignal: 62,
    attentionScore: 91,
    participantCount: 9340,
    postCount: 242,
    sourceCount: 3,
    sources: ["momment.", "Kalshi", "PredictIt"],
    topics: ["Election", "Korea", "Turnout"],
    outcomes: ["YES", "NO"],
    endsInLabel: text("12일 남음", "12d left", "faltan 12d"),
    ruleStatus: "ready",
  },
  {
    id: "bitcoin-etf-flow",
    title: text(
      "비트코인 ETF 주간 순유입 전환",
      "Bitcoin ETF weekly net inflow reversal",
      "Cambio a entradas netas semanales en ETF de Bitcoin",
    ),
    summary: text(
      "온체인 흐름, ETF 공시, 외부 참고 신호를 통합해 추적합니다.",
      "Tracks on-chain flows, ETF disclosures, and external reference signals together.",
      "Rastrea flujos on-chain, reportes ETF y referencias externas.",
    ),
    category: "crypto",
    urgency: "breaking",
    referenceSignal: 58,
    attentionScore: 89,
    participantCount: 7010,
    postCount: 198,
    sourceCount: 3,
    sources: ["momment.", "Polymarket", "Manifold"],
    topics: ["Bitcoin", "ETF", "On-chain"],
    outcomes: ["YES", "NO"],
    endsInLabel: text("5일 남음", "5d left", "faltan 5d"),
    ruleStatus: "draft",
  },
  {
    id: "lck-finals-roster",
    title: text(
      "LCK 결승 선발 로스터 변경 여부",
      "Whether the LCK finals starting roster changes",
      "Si cambia el roster inicial de la final LCK",
    ),
    summary: text(
      "팀 공지, 기자단 소식, 팬 커뮤니티 근거를 한 어텐션으로 모읍니다.",
      "Combines team notices, reporter signals, and fan-community evidence in one attention.",
      "Combina anuncios de equipos, senales de periodistas y evidencia de fans.",
    ),
    category: "sports",
    urgency: "hot",
    referenceSignal: 64,
    attentionScore: 84,
    participantCount: 5880,
    postCount: 176,
    sourceCount: 2,
    sources: ["momment.", "Manifold"],
    topics: ["LCK", "Roster", "Finals"],
    outcomes: ["YES", "NO"],
    endsInLabel: text("3일 남음", "3d left", "faltan 3d"),
    ruleStatus: "ready",
  },
  {
    id: "kpop-comeback-window",
    title: text(
      "대형 K-pop 컴백 티저 공개",
      "Major K-pop comeback teaser release",
      "Lanzamiento de teaser de comeback K-pop",
    ),
    summary: text(
      "기획사 공지, 유통 메타데이터, 글로벌 팬덤 토픽을 연결합니다.",
      "Connects agency notices, distribution metadata, and global fandom topics.",
      "Conecta avisos de agencias, metadatos de distribucion y fandom global.",
    ),
    category: "entertainment",
    urgency: "steady",
    referenceSignal: 76,
    attentionScore: 82,
    participantCount: 9230,
    postCount: 311,
    sourceCount: 2,
    sources: ["momment.", "Manifold"],
    topics: ["K-pop", "Comeback", "Fandom"],
    outcomes: ["YES", "NO"],
    endsInLabel: text("14일 남음", "14d left", "faltan 14d"),
    ruleStatus: "draft",
  },
  {
    id: "openai-model-release",
    title: text(
      "주요 AI 모델 공개 일정",
      "Major AI model release timing",
      "Fecha de lanzamiento de un modelo importante de IA",
    ),
    summary: text(
      "공식 블로그, 개발자 이벤트, 외부 예측 신호를 통합하는 AI 어텐션입니다.",
      "An AI attention combining official blogs, developer events, and external reference signals.",
      "Una attention de IA que combina blogs oficiales, eventos dev y senales externas.",
    ),
    category: "ai",
    urgency: "breaking",
    referenceSignal: 69,
    attentionScore: 87,
    participantCount: 6480,
    postCount: 205,
    sourceCount: 3,
    sources: ["momment.", "Polymarket", "Manifold"],
    topics: ["AI", "Model", "Release"],
    outcomes: ["YES", "NO"],
    endsInLabel: text("21일 남음", "21d left", "faltan 21d"),
    ruleStatus: "ready",
  },
];

export const exploreTopics: ExploreTopic[] = [
  { slug: "fomc", label: "FOMC", count: 128, trend: "+24%" },
  { slug: "election", label: "Election", count: 94, trend: "+18%" },
  { slug: "bitcoin", label: "Bitcoin", count: 87, trend: "+15%" },
  { slug: "kpop", label: "K-pop", count: 76, trend: "+12%" },
  { slug: "ai-model", label: "AI Model", count: 69, trend: "+9%" },
  { slug: "lck", label: "LCK", count: 52, trend: "+7%" },
];
