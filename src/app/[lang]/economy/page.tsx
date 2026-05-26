"use client";

import { useState } from "react";
import { useI18n } from "@/shared/i18n/LanguageProvider";

type Tab = "overview" | "earning" | "royalty" | "referral" | "spending" | "withdrawal";

export default function EconomyPage() {
  const { dictionary: d, t } = useI18n();
  const ep = d.economyPage;
  const [tab, setTab] = useState<Tab>("overview");

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t(ep.tabs.overview) },
    { key: "earning", label: t(ep.tabs.earning) },
    { key: "royalty", label: t(ep.tabs.royalty) },
    { key: "referral", label: t(ep.tabs.referral) },
    { key: "spending", label: t(ep.tabs.spending) },
    { key: "withdrawal", label: t(ep.tabs.withdrawal) },
  ];

  return (
    <div className="w-full">
      <div className="border-b border-border bg-background px-4 pt-5 pb-0 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-[20px] font-black text-foreground sm:text-[24px]">
            {t(ep.title)}
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground sm:text-[13px]">
            {t(ep.subtitle)}
          </p>
          <nav className="mt-4 -mb-px flex gap-0 overflow-x-auto scrollbar-none">
            {tabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`relative shrink-0 px-3 py-2.5 text-[13px] font-semibold transition-colors sm:px-4 ${
                  tab === item.key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
                {tab === item.key && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-blue-600" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "earning" && <EarningTab />}
        {tab === "royalty" && <RoyaltyTab />}
        {tab === "referral" && <ReferralTab />}
        {tab === "spending" && <SpendingTab />}
        {tab === "withdrawal" && <WithdrawalTab />}
      </main>
    </div>
  );
}

/* ─── Shared Components ──────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-[22px] font-black text-foreground mb-2">{children}</h1>;
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-muted-foreground mb-6 leading-relaxed">{children}</p>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-background p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h, i) => (
              <th key={i} className="py-2 px-3 text-left font-bold text-muted-foreground text-[11px] uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="py-2.5 px-3 text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ children, variant = "blue" }: { children: React.ReactNode; variant?: "blue" | "green" | "amber" | "red" }) {
  const colors = {
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    red: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${colors[variant]}`}>
      {children}
    </span>
  );
}

/* ─── Tab Content ────────────────────────────────── */

function OverviewTab() {
  const { dictionary: d, t } = useI18n();
  const ep = d.economyPage;
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>{t(ep.overview.whatIsMom)}</SectionTitle>
        <SectionDesc>{t(ep.overview.whatIsMomDesc)}</SectionDesc>
      </div>
      <Card>
        <h3 className="text-[15px] font-bold text-foreground mb-3">{t(ep.overview.dynamicRate)}</h3>
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900/50 p-4 font-mono text-[14px] text-center">
          <span className="text-muted-foreground">$/MOM = </span>
          <span className="font-bold text-blue-600">Vault USD</span>
          <span className="text-muted-foreground"> ÷ </span>
          <span className="font-bold text-blue-600">Total MOM Supply</span>
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">{t(ep.overview.dynamicRateDesc)}</p>
      </Card>
      <Card>
        <h3 className="text-[15px] font-bold text-foreground mb-4">{t(ep.overview.energyFlow)}</h3>
        <div className="flex flex-col gap-3 text-[12px]">
          <div className="flex items-center gap-3">
            <Badge variant="green">MINT</Badge>
            <span className="text-muted-foreground">→</span>
            <span className="text-foreground font-medium">{t(ep.overview.mintDesc)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="red">BURN</Badge>
            <span className="text-muted-foreground">→</span>
            <span className="text-foreground font-medium">{t(ep.overview.burnDesc)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="blue">VALUE</Badge>
            <span className="text-muted-foreground">→</span>
            <span className="text-foreground font-medium">{t(ep.overview.valueDesc)}</span>
          </div>
        </div>
      </Card>

      {/* Burn = Ecosystem Return */}
      <Card className="border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10">
        <div className="flex gap-3">
          <div className="shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[16px] dark:bg-emerald-900/50">
            🔥
          </div>
          <div>
            <h3 className="text-[15px] font-black text-foreground mb-2">
              {t(ep.overview.burnExplainerTitle)}
            </h3>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
              {t(ep.overview.burnExplainerBody)}
            </p>
            <div className="rounded-lg bg-white/60 dark:bg-zinc-900/40 border border-emerald-200/50 dark:border-emerald-800/30 px-4 py-3">
              <p className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400 text-center leading-relaxed">
                {t(ep.overview.burnExplainerFormula)}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EarningTab() {
  const { dictionary: d, t } = useI18n();
  const ep = d.economyPage;
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>{t(ep.earning.directAction)}</SectionTitle>
        <SectionDesc>{t(ep.overview.whatIsMomDesc)}</SectionDesc>
      </div>
      <Card>
        <DataTable
          headers={[t(ep.earning.directAction), "MOM Energy", ""]}
          rows={[
            [t(ep.earning.post), <Badge key="p" variant="green">+2.0</Badge>, t(ep.earning.postDesc)],
            [t(ep.earning.repost), <Badge key="r" variant="green">+1.5</Badge>, t(ep.earning.repostDesc)],
            [t(ep.earning.comment), <Badge key="c" variant="green">+1.0</Badge>, t(ep.earning.commentDesc)],
            [t(ep.earning.comment) + " (" + t(ep.royalty.subReplyMyComment) + ")", <Badge key="sr" variant="green">+1.0</Badge>, t(ep.earning.commentDesc)],
            [t(ep.earning.reaction), <Badge key="l" variant="green">+0.05</Badge>, t(ep.earning.reactionDesc)],
          ]}
        />
      </Card>
    </div>
  );
}

function RoyaltyTab() {
  const { dictionary: d, t } = useI18n();
  const ep = d.economyPage;
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>{t(ep.royalty.title)}</SectionTitle>
        <SectionDesc>{t(ep.royalty.desc)}</SectionDesc>
      </div>
      <Card>
        <h3 className="text-[14px] font-bold text-foreground mb-1">{t(ep.royalty.builderRoyalty)}</h3>
        <p className="text-[12px] text-muted-foreground mb-3">{t(ep.royalty.builderDesc)}</p>
        <DataTable
          headers={[t(ep.royalty.trigger), t(ep.royalty.reward), t(ep.royalty.condition)]}
          rows={[
            [t(ep.royalty.postInAttention), <Badge key="1" variant="green">+0.4 MOM</Badge>, t(ep.royalty.notSelf)],
            [t(ep.royalty.repostInAttention), <Badge key="2" variant="green">+0.2 MOM</Badge>, t(ep.royalty.notSelf)],
            [t(ep.royalty.commentInAttention), <Badge key="3" variant="green">+0.1 MOM</Badge>, t(ep.royalty.notSelf)],
          ]}
        />
        <div className="mt-3 text-[11px] text-muted-foreground">
          {t(ep.royalty.dailyCap)}: <Badge variant="amber">80 MOM</Badge> · {t(ep.royalty.accountAge)}
        </div>
      </Card>
      <Card>
        <h3 className="text-[14px] font-bold text-foreground mb-1">{t(ep.royalty.authorRoyalty)}</h3>
        <p className="text-[12px] text-muted-foreground mb-3">{t(ep.royalty.authorDesc)}</p>
        <DataTable
          headers={[t(ep.royalty.trigger), t(ep.royalty.reward), t(ep.royalty.condition)]}
          rows={[
            [t(ep.royalty.repostMyPost), <Badge key="4" variant="green">+0.3 MOM</Badge>, t(ep.royalty.notSelf)],
            [t(ep.royalty.commentMyPost), <Badge key="5" variant="green">+0.2 MOM</Badge>, t(ep.royalty.notSelf)],
            [t(ep.royalty.reactionMyPost), <Badge key="6" variant="green">+0.01 MOM</Badge>, t(ep.royalty.notSelf)],
          ]}
        />
        <div className="mt-3 text-[11px] text-muted-foreground">
          {t(ep.royalty.dailyCap)}: <Badge variant="amber">40 MOM</Badge> · {t(ep.royalty.accountAge)}
        </div>
      </Card>
      <Card>
        <h3 className="text-[14px] font-bold text-foreground mb-1">{t(ep.royalty.commentRoyalty)}</h3>
        <p className="text-[12px] text-muted-foreground mb-3">{t(ep.royalty.commentRoyaltyDesc)}</p>
        <DataTable
          headers={[t(ep.royalty.trigger), t(ep.royalty.reward), t(ep.royalty.condition)]}
          rows={[
            [t(ep.royalty.subReplyMyComment), <Badge key="7" variant="green">+0.1 MOM</Badge>, t(ep.royalty.notSelf)],
          ]}
        />
        <div className="mt-3 text-[11px] text-muted-foreground">
          {t(ep.royalty.accountAge)}
        </div>
      </Card>
    </div>
  );
}

function ReferralTab() {
  const { dictionary: d, t } = useI18n();
  const ep = d.economyPage;
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>{t(ep.referral.title)}</SectionTitle>
        <SectionDesc>{t(ep.referral.desc)}</SectionDesc>
      </div>
      <Card>
        <DataTable
          headers={["", ""]}
          rows={[
            [t(ep.referral.signupBonus), <span key="1"><Badge variant="green">+30 MOM</Badge> {t(ep.referral.each)}</span>],
            [t(ep.referral.revenueShare), t(ep.referral.revenueShareDesc)],
            [t(ep.referral.duration), "60 days"],
            [t(ep.referral.maxInvites), t(ep.referral.maxInvitesDesc)],
            [t(ep.referral.dailyCap), <Badge key="2" variant="amber">15 MOM/day</Badge>],
          ]}
        />
      </Card>
      <Card className="border-emerald-200 dark:border-emerald-900/50">
        <h3 className="text-[14px] font-bold text-foreground mb-2">{t(ep.referral.howItWorks)}</h3>
        <div className="space-y-2 text-[12px] text-muted-foreground">
          <p>{t(ep.referral.step1)}: <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[11px]">momment.xyz/?ref=YOUR_CODE</code></p>
          <p>{t(ep.referral.step2)} <Badge variant="green">+30 MOM</Badge></p>
          <p>{t(ep.referral.step3)}</p>
          <p>{t(ep.referral.step4)}</p>
        </div>
      </Card>
    </div>
  );
}

function SpendingTab() {
  const { dictionary: d, t } = useI18n();
  const ep = d.economyPage;
  return (
    <div className="space-y-6">
      <SectionTitle>{t(ep.spending.title)}</SectionTitle>
      <Card>
        <h3 className="text-[14px] font-bold text-foreground mb-3">{t(ep.spending.costs)}</h3>
        <DataTable
          headers={[t(ep.spending.action), t(ep.spending.cost), t(ep.spending.note)]}
          rows={[
            [t(ep.spending.oracleAssertion), <Badge key="1" variant="red">-5 MOM</Badge>, t(ep.spending.oracleNote)],
            [t(ep.spending.premiumPost), t(ep.spending.variable), t(ep.spending.premiumNote)],
            [t(ep.spending.sponsorship), "Min 100 MOM", t(ep.spending.sponsorshipNote)],
            [t(ep.spending.adBid), t(ep.spending.variable), t(ep.spending.adBidNote)],
          ]}
        />
      </Card>
      <Card>
        <h3 className="text-[14px] font-bold text-foreground mb-3">{t(ep.spending.burnMechanisms)}</h3>
        <DataTable
          headers={[t(ep.spending.source), t(ep.spending.burnRate), t(ep.spending.effect)]}
          rows={[
            [t(ep.spending.adBid), <Badge key="1" variant="red">100%</Badge>, t(ep.spending.adBidBurn)],
            [t(ep.spending.sponsorship), <Badge key="2" variant="red">50%</Badge>, t(ep.spending.sponsorBurn)],
            [t(ep.spending.premiumPost), <Badge key="3" variant="red">15%</Badge>, t(ep.spending.premiumBurn)],
            [t(ep.spending.withdrawal), <Badge key="4" variant="red">5%</Badge>, t(ep.spending.withdrawBurn)],
          ]}
        />
        <p className="mt-3 text-[11px] text-muted-foreground">
          {t(ep.spending.burnBenefit)}
        </p>
      </Card>
    </div>
  );
}

function WithdrawalTab() {
  const { dictionary: d, t } = useI18n();
  const ep = d.economyPage;
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>{t(ep.withdrawal.title)}</SectionTitle>
        <SectionDesc>{t(ep.withdrawal.desc)}</SectionDesc>
      </div>
      <Card>
        <DataTable
          headers={["", ""]}
          rows={[
            [t(ep.withdrawal.minAmount), "$5 USD"],
            [t(ep.withdrawal.spread), <Badge key="1" variant="amber">5%</Badge>],
            [t(ep.withdrawal.currency), "MOM → mUSDC (Giwa Sepolia)"],
          ]}
        />
      </Card>
      <Card className="border-amber-200 dark:border-amber-900/50">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-[10px] font-bold">!</div>
          <div className="text-[12px] text-muted-foreground leading-relaxed">
            <p className="font-bold text-foreground mb-1">{t(ep.withdrawal.denomination)}</p>
            <p>{t(ep.withdrawal.denominationDesc)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
