"use client";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { RiArrowRightLine, RiFireLine, RiBankLine, RiExchangeDollarLine, RiCoinsLine, RiTrophyLine, RiShieldCheckLine } from "react-icons/ri";
import Link from "next/link";

export default function EconomyPage() {
  const { language } = useI18n();
  const isKo = language === "ko";

  return (
    <div className="flex-1 min-w-0 bg-zinc-50/30 dark:bg-zinc-950/20">
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto pb-20">
        
        <header className="mb-10 text-center">
          <p className="text-sm font-black text-blue-600 dark:text-blue-400 tracking-widest uppercase mb-2">
            Documentation
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
            {isKo ? "momment. 소셜파이 구조" : "momment. Social-fi Structure"}
          </h1>
          <p className="mt-4 text-[15px] font-medium text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {isKo
              ? "Social-fi (소셜파이): 당신의 평범한 소셜 활동이 곧 자산이 됩니다. 포스트 작성, 정보 공유, 그리고 어텐션 테이킹(Attention Taking) 활동이 플랫폼의 가치를 키우고, 그 성장은 온전히 당신의 실질적인 수익으로 직결됩니다."
              : "Social-fi: Your everyday social activities become digital assets. Posting, sharing info, and Attention Taking activities grow the platform's value, translating directly into your own monetization."}
          </p>
        </header>

        <div className="space-y-6">
          
          {/* Core Formula */}
          <section className="rounded-3xl border border-blue-200/50 bg-gradient-to-br from-blue-50 to-white p-6 sm:p-8 dark:border-blue-900/30 dark:from-blue-950/20 dark:to-zinc-950 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                <RiExchangeDollarLine className="size-5" />
              </div>
              <h2 className="text-xl font-black text-foreground">
                {isKo ? "핵심 공식: 변동 환율제" : "Core Formula: Dynamic Rate"}
              </h2>
            </div>
            <p className="mb-5 text-[14px] font-medium text-muted-foreground">
              {isKo
              ? "MOM의 가치는 플랫폼 볼트(Vault)에 쌓인 달러와 시장에 풀린 전체 MOM 유통 에너지에 의해 실시간으로 결정됩니다."
              : "The value of MOM is determined in real-time by the USD accumulated in the Vault and the total MOM supply."}
            </p>
            <div className="rounded-2xl border border-blue-200/50 bg-white/60 p-4 sm:p-6 backdrop-blur-sm dark:border-blue-800/30 dark:bg-zinc-900/60 font-mono text-sm sm:text-[15px] font-bold text-blue-900 dark:text-blue-200 flex flex-col items-center text-center gap-2">
              <p>MOM Rate ($) = Vault USD / Total MOM Supply</p>
              <span className="text-xs text-blue-500/70 dark:text-blue-400/50">Minimum Rate Floor: $0.001</span>
            </div>
          </section>

          {/* Virtuous Cycle */}
          <section className="rounded-3xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-white p-6 sm:p-8 dark:border-emerald-900/30 dark:from-emerald-950/20 dark:to-zinc-950 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                <RiFireLine className="size-5" />
              </div>
              <h2 className="text-xl font-black text-foreground">
                {isKo ? "생태계 선순환 메커니즘" : "Virtuous Cycle Mechanism"}
              </h2>
            </div>
            
            <div className="mt-6 relative px-4 py-8 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl bg-white/50 dark:bg-zinc-900/30 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 text-center">
                <div>
                  <h3 className="font-black text-emerald-700 dark:text-emerald-400">1. {isKo ? "유저 활동" : "User Activity"}</h3>
                  <p className="mt-2 text-sm text-muted-foreground font-medium">
                    {isKo ? "양질의 포스트, 토론, 확산을 통해 MOM이 발행됩니다." : "MOM is minted through quality posts, discussions, and reach."}
                  </p>
                </div>
                <div className="hidden md:flex items-center justify-center text-emerald-300">
                  <RiArrowRightLine className="size-6" />
                </div>
                <div>
                  <h3 className="font-black text-emerald-700 dark:text-emerald-400">2. {isKo ? "트래픽 & 수익" : "Traffic & Revenue"}</h3>
                  <p className="mt-2 text-sm text-muted-foreground font-medium">
                    {isKo ? "트래픽이 증가하여 광고 및 스폰서십 수익($)이 볼트에 쌓입니다." : "Increased traffic generates ad & sponsorship revenue ($) for the Vault."}
                  </p>
                </div>
                <div className="hidden md:flex items-center justify-center text-emerald-300">
                  <RiArrowRightLine className="size-6" />
                </div>
                <div>
                  <h3 className="font-black text-emerald-700 dark:text-emerald-400">3. {isKo ? "가치 상승" : "Value Appreciation"}</h3>
                  <p className="mt-2 text-sm text-muted-foreground font-medium">
                    {isKo ? "볼트 달러(Vault USD) 증가와 스폰서 비딩 소각으로 MOM 환율이 상승합니다." : "Vault USD grows and ad bids burn MOM, driving up the MOM exchange rate."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* AIO Oracle System */}
          <section className="rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50 to-white p-6 sm:p-8 dark:border-indigo-900/30 dark:from-indigo-950/20 dark:to-zinc-950 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                <RiShieldCheckLine className="size-5" />
              </div>
              <h2 className="text-xl font-black text-foreground">
                {isKo ? "AIO (Agentic interoperable Oracle) 검증" : "AIO Agentic Verification"}
              </h2>
            </div>
            <p className="mb-5 text-[14px] font-medium text-muted-foreground leading-relaxed">
              {isKo
                ? "momment.의 모든 정보는 AI Agent들에 의해 빠르고 정확하게 자율 검증됩니다. 어텐션 토론장이 커질수록, 정확한 근거 링크를 제출하여 확정(Finalize)에 기여한 유저는 어텐션 점수에 비례하는 막대한 MOM 에너지를 즉시 획득합니다."
                : "Information on momment. is autonomously verified by AI Agents. As attention clusters grow, users who submit valid evidence URLs and contribute to finalization receive massive, real-time MOM Energy rewards scaling with attention score."}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 mt-6">
              <div className="rounded-2xl border border-indigo-100 bg-white/60 p-5 dark:border-indigo-900/30 dark:bg-zinc-900/40">
                <h3 className="text-[14px] font-black text-indigo-700 dark:text-indigo-400">
                  {isKo ? "1. 근거 제출 및 자동 추출" : "1. Submit & Auto-Extract"}
                </h3>
                <p className="mt-2 text-[13px] font-medium text-muted-foreground leading-relaxed">
                  {isKo ? "언론사나 공식 데이터 링크를 제출하면, 시스템이 즉시 원본 데이터를 스크랩하여 AI 검증을 준비합니다." : "Submit a news or official data link. The system immediately scrapes raw data to prepare for AI verification."}
                </p>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-white/60 p-5 dark:border-indigo-900/30 dark:bg-zinc-900/40">
                <h3 className="text-[14px] font-black text-indigo-700 dark:text-indigo-400">
                  {isKo ? "2. 멀티 LLM 교차 검증" : "2. Multi-LLM Consensus"}
                </h3>
                <p className="mt-2 text-[13px] font-medium text-muted-foreground leading-relaxed">
                  {isKo ? "서로 다른 최상위 AI 모델들이 데이터를 교차 검증하고, 만장일치로 통과되면 즉시 안건이 확정되며 보상이 지급됩니다." : "Top-tier AI models cross-verify the data. Upon consensus, the outcome is instantly finalized and rewards are distributed."}
                </p>
              </div>
            </div>
          </section>

          {/* Revenue Tracks */}
          <section className="rounded-3xl border border-border bg-background p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <RiBankLine className="size-5" />
              </div>
              <h2 className="text-xl font-black text-foreground">
                {isKo ? "수익 및 소각 구조" : "Revenue & Burn Structure"}
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card 
                title={isKo ? "광고 비딩 (General Ads)" : "Ad Bidding"}
                desc={isKo ? "광고주가 MOM으로 플랫폼 슬롯을 입찰합니다. 입찰된 MOM은 100% 소각(Burn)되어 총 발행량이 감소하고, 환율이 상승합니다." : "Advertisers bid for slots using MOM. 100% of the MOM is burned, decreasing supply and increasing the rate."}
              />
              <Card 
                title={isKo ? "어텐션 스폰서십" : "Attention Sponsorship"}
                desc={isKo ? "스폰서가 특정 어텐션에 MOM을 투자합니다. 25%는 빌더, 25%는 기여자에게 분배되며 나머지 50%는 소각됩니다." : "Sponsors invest MOM into Attentions. 25% goes to builders, 25% to contributors, and 50% is burned."}
              />
              <Card 
                title={isKo ? "에너지 결제 구매" : "Energy Purchases"}
                desc={isKo ? "유저가 결제를 통해 MOM 에너지를 충전하면, 해당 결제 대금(USD)은 전액 플랫폼 볼트(Vault)에 적립됩니다." : "When users purchase MOM Energy, the USD payment goes entirely into the Platform Vault."}
              />
              <Card 
                title={isKo ? "도네이션 (응원)" : "Donations"}
                desc={isKo ? "팬이 어텐션을 후원하면 클러스터 점수가 크게 상승하며, 도너는 기여의 증표로 일정 비율의 MOM을 보상받습니다." : "Fans donate to Attentions to boost scores, receiving a small MOM reward as proof of contribution."}
              />
            </div>
          </section>

          {/* Withdrawals */}
          <section className="rounded-3xl border border-border bg-background p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <RiCoinsLine className="size-5" />
              </div>
              <h2 className="text-xl font-black text-foreground">
                {isKo ? "수시 출금 시스템" : "On-Demand Withdrawals"}
              </h2>
            </div>
            <p className="mb-5 text-[14px] font-medium text-muted-foreground leading-relaxed">
              {isKo 
                ? "월말 정산을 기다릴 필요 없이, 원할 때 언제든 보유한 MOM을 시장 환율에 맞게 달러(USDC)로 출금 요청할 수 있습니다." 
                : "No need to wait for month-end settlements. Withdraw your MOM for USD(C) at the current market rate whenever you want."}
            </p>
            <ul className="space-y-3 text-sm font-semibold text-foreground bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-2xl border border-border">
              <li className="flex justify-between items-center pb-3 border-b border-border/50">
                <span className="text-muted-foreground">{isKo ? "최소 출금액" : "Minimum Withdrawal"}</span>
                <span>1,000 MOM</span>
              </li>
              <li className="flex justify-between items-center pb-3 border-b border-border/50">
                <span className="text-muted-foreground">{isKo ? "일일 한도 (유저당)" : "Daily Limit (Per User)"}</span>
                <span>50,000 MOM</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-muted-foreground">{isKo ? "월간 한도 (유저당)" : "Monthly Limit (Per User)"}</span>
                <span>200,000 MOM (기본)</span>
              </li>
            </ul>
          </section>

          {/* CR Tiers */}
          <section className="rounded-3xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-white p-6 sm:p-8 dark:border-amber-900/30 dark:from-amber-950/10 dark:to-zinc-950 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                <RiTrophyLine className="size-5" />
              </div>
              <h2 className="text-xl font-black text-foreground">
                {isKo ? "기여자 등급 (Contribution Tiers)" : "Contribution Tiers"}
              </h2>
            </div>
            <p className="mb-5 text-[14px] font-medium text-muted-foreground leading-relaxed">
              {isKo 
                ? "플랫폼에 기여하여 높은 Contribution Ratio(CR) 순위를 달성할수록 출금 수수료(Spread) 할인을 받고, 월간 출금 한도가 증가합니다." 
                : "Achieve higher Contribution Ratio (CR) rankings to unlock reduced withdrawal spreads and higher monthly withdrawal limits."}
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TierCard 
                tier="🥇 Gold" 
                desc={isKo ? "상위 5% 이내" : "Top 5%"} 
                spread="3%" 
                limit="500,000 MOM" 
              />
              <TierCard 
                tier="🥈 Silver" 
                desc={isKo ? "상위 20% 이내" : "Top 20%"} 
                spread="4%" 
                limit="300,000 MOM" 
              />
              <TierCard 
                tier="⚡ Member" 
                desc={isKo ? "일반 기여자" : "Regular"} 
                spread="5%" 
                limit="200,000 MOM" 
              />
            </div>
          </section>

          <div className="pt-6 flex justify-center">
            <Link 
              href="/rewards" 
              className="inline-flex h-12 items-center justify-center rounded-full bg-blue-600 px-8 text-[15px] font-black text-white shadow-lg shadow-blue-600/20 transition-all hover:scale-105 hover:bg-blue-700"
            >
              {isKo ? "Vault 대시보드 보기" : "View Vault Dashboard"}
              <RiArrowRightLine className="ml-2 size-5" />
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}

function Card({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 hover:border-blue-200 hover:bg-blue-50/30 transition-colors dark:hover:border-blue-900/30 dark:hover:bg-blue-900/10">
      <h3 className="text-[15px] font-black text-foreground">{title}</h3>
      <p className="mt-2 text-[13px] font-medium text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function TierCard({ tier, desc, spread, limit }: { tier: string; desc: string; spread: string; limit: string }) {
  return (
    <div className="rounded-2xl border border-amber-200/40 bg-white/60 p-5 text-center dark:border-amber-700/30 dark:bg-zinc-900/50">
      <p className="text-[16px] font-black text-amber-600 dark:text-amber-500">{tier}</p>
      <p className="text-[12px] font-bold text-muted-foreground mt-1">{desc}</p>
      <div className="mt-4 space-y-1.5 text-[13px] font-bold">
        <p className="text-foreground flex justify-between">
          <span className="text-muted-foreground">Spread</span> {spread}
        </p>
        <p className="text-foreground flex justify-between">
          <span className="text-muted-foreground">Limit</span> {limit}
        </p>
      </div>
    </div>
  );
}
