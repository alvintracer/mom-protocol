import type { LocalizedText } from "@/shared/i18n/config";

export type EventStatus = "open" | "verifying" | "resolved";

export type EventCategory =
  | "정치"
  | "경제"
  | "크립토"
  | "스포츠"
  | "엔터";

export const eventCategoryLabels: Record<EventCategory, LocalizedText> = {
  정치: { ko: "정치", en: "Politics", es: "Politica" },
  경제: { ko: "경제", en: "Economics", es: "Economia" },
  크립토: { ko: "크립토", en: "Crypto", es: "Cripto" },
  스포츠: { ko: "스포츠", en: "Sports", es: "Deportes" },
  엔터: { ko: "엔터", en: "Entertainment", es: "Entretenimiento" },
};

export type Event = {
  id: string;
  slug?: string | null;
  title: LocalizedText;
  summary: LocalizedText;
  category: EventCategory;
  status: EventStatus;
  attentionScore: number;
  participantCount: number;
  evidenceCount: number;
  predictionCount: number;
  endsAt: string;
  sourceName: LocalizedText;
  sourceUrl: string;
  oracleState: "대기" | "검증 중" | "검증 완료";
  tags: LocalizedText[];
  sponsor?: {
    name: string;
    logoUrl?: string | null;
    tagline?: string | null;
    url: string;
    color?: string | null;
  } | null;
};

export type Creator = {
  id: string;
  handle: string;
  name: LocalizedText;
  specialty: LocalizedText;
  bio: LocalizedText;
  trustScore: number;
  momEnergy: number;
  contributionRatio: number;
  subscriberCount: number;
  avatarInitials: string;
};

export type Prediction = {
  id: string;
  eventId: string;
  creatorHandle: string;
  label: LocalizedText;
  confidence: number;
  rationale: LocalizedText;
  momEnergyUsed: number;
  createdAt: string;
};

export type Evidence = {
  id: string;
  eventId: string;
  submittedByHandle: string;
  title: LocalizedText;
  sourceName: LocalizedText;
  url: string;
  summary: LocalizedText;
  verificationScore: number;
  submittedAt: string;
};

export type RewardPool = {
  id: string;
  title: LocalizedText;
  monthlyLabel: LocalizedText;
  totalAmountLabel: string;
  monthlyAmountLabel: string;
  cumulativeAmountLabel: string;
  distributedAmountLabel: string;
  period: string;
  nextDistributionDate: string;
  fillPercent: number;
  activeContributors: number;
  sourceMix: {
    label: LocalizedText;
    percent: number;
    amountLabel: string;
    colorClass: string;
  }[];
  status: LocalizedText;
};

export type ContributionBreakdown = {
  id: string;
  creatorHandle: string;
  predictionAccuracy: number;
  evidenceQuality: number;
  discussionImpact: number;
  attentionSpread: number;
  contributionRatio: number;
};

export type PostProcessingStatus = "stored" | "queued" | "ready";

export type SocialPost = {
  id: string;
  authorId: string;
  title: string | null;
  body: string;
  originalLanguage: "ko" | "en" | "es";
  authorName: LocalizedText;
  authorHandle: string;
  avatarInitials: string;
  createdAtLabel: LocalizedText;
  createdAt: string;
  linkedEventId: string | null;
  selectedOutcome: string | null;
  postKind: "post" | "reply" | "repost" | "quote";
  repostOf:
    | {
        id: string;
        authorName: LocalizedText;
        authorHandle: string;
        body: string;
        mediaItems?: {
          name: string;
          type: string;
          size: number;
          previewUrl?: string;
        }[];
      }
    | null;
  replyCount: number;
  repostCount: number;
  likeCount: number;
  viewCount: number;
  userTags: string[];
  autoTags: string[];
  externalUrl: string | null;
  mediaItems?: {
    name: string;
    type: string;
    size: number;
    previewUrl?: string;
  }[];
  externalPreview:
    | {
        sourceName: string;
        title: LocalizedText;
        description: LocalizedText;
        imageUrl?: string | null;
      }
    | null;
  translationStatus: PostProcessingStatus;
  autoTagStatus: PostProcessingStatus;
  isPremium?: boolean;
  premiumEnergyCost?: number | null;
  contentFormat?: string;
  isPinned?: boolean;
};
