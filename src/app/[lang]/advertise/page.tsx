"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  RiAdvertisementLine,
  RiAuctionLine,
  RiBarChartBoxLine,
  RiEyeLine,
  RiFlashlightLine,
  RiMegaphoneLine,
  RiMouseLine,
  RiPauseLine,
  RiPlayLine,
  RiRefreshLine,
  RiShieldStarLine,
  RiTimeLine,
} from "react-icons/ri";

import { AuthGuard } from "@/shared/components/auth/AuthGuard";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import type { Database } from "@/shared/types/database";

type AttentionCluster = Database["public"]["Tables"]["attention_clusters"]["Row"];

export default function AdvertisePage() {
  return (
    <AuthGuard>
      {(userId) => (
        <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
          <AdvertiseContent userId={userId} />
        </Suspense>
      )}
    </AuthGuard>
  );
}

type Tab = "general" | "sponsor" | "dashboard";

function AdvertiseContent({ userId }: { userId: string }) {
  const { dictionary, t } = useI18n();
  const d = dictionary.advertisePage;
  const searchParams = useSearchParams();
  const sponsorSlug = searchParams.get("sponsor");
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    tabParam === "dashboard" ? "dashboard" : sponsorSlug ? "sponsor" : "general",
  );
  const [userEnergy, setUserEnergy] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("mom_energy")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data) setUserEnergy(Number(data.mom_energy));
      });
  }, [userId]);

  const tabs: { key: Tab; label: string; icon: typeof RiMegaphoneLine }[] = [
    { key: "general", label: t(d.tabs.general), icon: RiMegaphoneLine },
    { key: "sponsor", label: t(d.tabs.sponsor), icon: RiShieldStarLine },
    { key: "dashboard", label: t(d.tabs.dashboard), icon: RiBarChartBoxLine },
  ];

  return (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <RiAdvertisementLine className="size-5 text-blue-500" />
          <h1 className="text-lg font-black text-foreground tracking-tight">
            {t(d.title)}
          </h1>
        </div>
        <div className="flex border-b border-border">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-bold transition-colors relative ${
                  tab === item.key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                }`}
              >
                <Icon className="size-3.5" />
                {item.label}
                {tab === item.key && (
                  <span className="absolute bottom-0 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-full bg-blue-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Balance bar */}
      <div className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-border bg-zinc-50/50 px-4 py-2.5 dark:bg-zinc-900/30">
        <span className="text-[12px] font-bold text-muted-foreground">
          {t(d.yourBalance)}
        </span>
        <span className="text-[14px] font-black text-blue-600 dark:text-blue-400 tabular-nums">
          {userEnergy.toLocaleString()} MOM
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        {tab === "general" ? (
          <GeneralBidForm userId={userId} userEnergy={userEnergy} setUserEnergy={setUserEnergy} />
        ) : tab === "sponsor" ? (
          <SponsorshipForm userId={userId} userEnergy={userEnergy} setUserEnergy={setUserEnergy} defaultSlug={sponsorSlug} />
        ) : (
          <MyCampaignsDashboard userId={userId} />
        )}
      </div>
    </div>
  );
}

/* ── General Ad Bid Form ───────────────────────────────────── */

function GeneralBidForm({
  userId,
  userEnergy,
  setUserEnergy,
}: {
  userId: string;
  userEnergy: number;
  setUserEnergy: (v: number) => void;
}) {
  const { dictionary, t } = useI18n();
  const d = dictionary.advertisePage;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [destUrl, setDestUrl] = useState("");
  const [position, setPosition] = useState("sidebar");
  const [bidAmount, setBidAmount] = useState("");
  const [bidInputMode, setBidInputMode] = useState<"mom" | "usd">("mom");
  const [momRate, setMomRate] = useState(0.001);
  const [days, setDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rate")
      .then((r) => r.json())
      .then((d) => { if (d.rate) setMomRate(Number(d.rate)); })
      .catch(() => {});
  }, []);

  const positions = [
    { value: "sidebar", label: t(d.positions.sidebar) },
    { value: "feed_mid", label: t(d.positions.feedMid) },
    { value: "feed_top", label: t(d.positions.feedTop) },
  ];

  const handleSubmit = useCallback(async () => {
    if (!title || !destUrl || !bidAmount) return;
    setSubmitting(true);
    setResult(null);

    const supabase = createClient();
    const now = new Date();
    const end = new Date(now.getTime() + days * 86400000);

    // 1. Create campaign
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: campaign } = await (supabase as any)
      .from("ad_campaigns")
      .insert({
        advertiser_id: userId,
        advertiser_name: "User Campaign",
        title,
        body: body || null,
        destination_url: destUrl,
        positions: [position],
        status: "draft",
      })
      .select("id")
      .single();

    if (!campaign) {
      setResult("error");
      setSubmitting(false);
      return;
    }

    // 2. Submit bid — always submit in MOM
    const bidMom = bidInputMode === "usd" ? Math.round((parseFloat(bidAmount) || 0) / momRate) : (parseFloat(bidAmount) || 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("submit_ad_bid", {
      p_campaign_id: campaign.id,
      p_position: position,
      p_bid_amount: bidMom,
      p_starts_at: now.toISOString(),
      p_ends_at: end.toISOString(),
    });

    if (error) {
      setResult(error.message?.includes("insufficient") ? "insufficient" : "error");
    } else {
      setResult("success");
      setUserEnergy(userEnergy - bidMom);
    }
    setSubmitting(false);
  }, [title, body, destUrl, position, bidAmount, bidInputMode, momRate, days, userId, userEnergy, setUserEnergy]);

  return (
    <div className="space-y-5">
      {/* Info card */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex items-center gap-2">
          <RiAuctionLine className="size-4 text-blue-500" />
          <h3 className="text-[14px] font-black text-foreground">{t(d.generalTitle)}</h3>
        </div>
        <p className="mt-2 text-[12px] font-medium leading-relaxed text-muted-foreground">
          {t(d.generalDesc)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <EnergyTag label="80%" desc={t(d.adSpend)} />
          <EnergyTag label="20%" desc={t(d.platformEnergy)} accent />
        </div>
      </div>

      {/* Form */}
      <div className="space-y-3">
        <FormField label={t(d.adTitle)}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t(d.adTitlePlaceholder)}
            className="input-field"
          />
        </FormField>

        <FormField label={t(d.adBody)}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t(d.adBodyPlaceholder)}
            rows={2}
            className="input-field resize-none"
          />
        </FormField>

        <FormField label={t(d.destinationUrl)}>
          <input
            value={destUrl}
            onChange={(e) => setDestUrl(e.target.value)}
            placeholder="https://"
            className="input-field"
          />
        </FormField>

        <FormField label={t(d.selectPosition)}>
          <div className="flex flex-wrap gap-2">
            {positions.map((p) => (
              <button
                key={p.value}
                onClick={() => setPosition(p.value)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${
                  position === p.value
                    ? "bg-blue-600 text-white"
                    : "border border-border bg-background text-muted-foreground hover:border-blue-400"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t(d.bidAmountLabel)}>
            <div className="relative">
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={bidInputMode === "mom" ? "100" : "1.00"}
                min={bidInputMode === "mom" ? 1 : 0.01}
                step={bidInputMode === "usd" ? "0.01" : "1"}
                className="input-field pr-20"
              />
              <button
                type="button"
                onClick={() => {
                  const numVal = parseFloat(bidAmount) || 0;
                  if (bidInputMode === "mom") {
                    setBidInputMode("usd");
                    setBidAmount(numVal > 0 ? (numVal * momRate).toFixed(2) : "");
                  } else {
                    setBidInputMode("mom");
                    setBidAmount(numVal > 0 ? Math.round(numVal / momRate).toString() : "");
                  }
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg border border-border bg-zinc-100 px-2 py-1 text-[10px] font-black text-muted-foreground transition-colors hover:border-blue-400 hover:text-blue-600 dark:bg-zinc-800"
              >
                {bidInputMode === "mom" ? "MOM" : "USD"}
                <span className="text-[9px]">⇄</span>
              </button>
            </div>
            {parseFloat(bidAmount) > 0 && (
              <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                ≒ {bidInputMode === "mom"
                  ? `$${(parseFloat(bidAmount) * momRate).toFixed(2)} USD`
                  : `${Math.round(parseFloat(bidAmount) / momRate).toLocaleString()} MOM`}
              </p>
            )}
          </FormField>
          <FormField label={t(d.duration)}>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value) || 1)}
                min={1}
                max={90}
                className="input-field"
              />
              <span className="text-[12px] font-bold text-muted-foreground shrink-0">{t(d.days)}</span>
            </div>
          </FormField>
        </div>

        {result === "success" && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-3 text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
            ✓ {t(d.bidSuccess)}
          </div>
        )}
        {result === "insufficient" && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 p-3 text-[12px] font-bold text-rose-700 dark:text-rose-400">
            ✗ {t(d.insufficientEnergy)}
          </div>
        )}
        {result === "error" && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 p-3 text-[12px] font-bold text-rose-700 dark:text-rose-400">
            ✗ {t(d.bidError)}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !title || !destUrl || !bidAmount}
          className="w-full rounded-full bg-blue-600 py-3 text-[14px] font-black text-white transition-all hover:bg-blue-700 disabled:opacity-40 active:scale-[0.98]"
        >
          {submitting ? "..." : t(d.submitBid)}
        </button>
      </div>
    </div>
  );
}

/* ── Sponsorship Form ──────────────────────────────────────── */

function SponsorshipForm({
  userId,
  userEnergy,
  setUserEnergy,
  defaultSlug,
}: {
  userId: string;
  userEnergy: number;
  setUserEnergy: (v: number) => void;
  defaultSlug: string | null;
}) {
  const { dictionary, t } = useI18n();
  const d = dictionary.advertisePage;
  const [attentions, setAttentions] = useState<AttentionCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string>("");
  const [sponsorName, setSponsorName] = useState("");
  const [tagline, setTagline] = useState("");
  const [sponsorUrl, setSponsorUrl] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [bidAmount, setBidAmount] = useState("");
  const [bidInputMode, setBidInputMode] = useState<"mom" | "usd">("mom");
  const [momRate, setMomRate] = useState(0.001);
  const [days, setDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rate")
      .then((r) => r.json())
      .then((d) => { if (d.rate) setMomRate(Number(d.rate)); })
      .catch(() => {});
  }, []);

  // Load attention list
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("attention_clusters")
      .select("*")
      .order("attention_score", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          setAttentions(data);
          if (defaultSlug) {
            const match = data.find((a) => a.slug === defaultSlug);
            if (match) setSelectedCluster(match.id);
          }
        }
      });
  }, [defaultSlug]);

  const selectedAttention = attentions.find((a) => a.id === selectedCluster);

  const handleSubmit = useCallback(async () => {
    if (!selectedCluster || !sponsorName || !sponsorUrl || !bidAmount) return;
    setSubmitting(true);
    setResult(null);

    const supabase = createClient();
    const now = new Date();
    const end = new Date(now.getTime() + days * 86400000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bidMom = bidInputMode === "usd" ? Math.round((parseFloat(bidAmount) || 0) / momRate) : (parseFloat(bidAmount) || 0);
    const { data, error } = await (supabase as any).rpc("submit_attention_sponsorship", {
      p_cluster_id: selectedCluster,
      p_sponsor_name: sponsorName,
      p_sponsor_url: sponsorUrl,
      p_bid_amount: bidMom,
      p_starts_at: now.toISOString(),
      p_ends_at: end.toISOString(),
      p_sponsor_tagline: tagline || null,
      p_sponsor_color: color,
    });

    if (error) {
      setResult(error.message?.includes("insufficient") ? "insufficient" : "error");
    } else {
      setResult("success");
      setUserEnergy(userEnergy - bidMom);
    }
    setSubmitting(false);
  }, [selectedCluster, sponsorName, sponsorUrl, tagline, color, bidAmount, bidInputMode, momRate, days, userId, userEnergy, setUserEnergy]);

  const bidNum = bidInputMode === "usd" ? Math.round((parseFloat(bidAmount) || 0) / momRate) : (parseFloat(bidAmount) || 0);

  return (
    <div className="space-y-5">
      {/* Info card */}
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
        <div className="flex items-center gap-2">
          <RiShieldStarLine className="size-4 text-indigo-500" />
          <h3 className="text-[14px] font-black text-foreground">{t(d.sponsorTitle)}</h3>
        </div>
        <p className="mt-2 text-[12px] font-medium leading-relaxed text-muted-foreground">
          {t(d.sponsorDesc)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <EnergyTag label="60%" desc={t(d.attentionEnergy)} accent />
          <EnergyTag label="20%" desc={t(d.platformEnergy)} />
          <EnergyTag label="20%" desc={t(d.builderReward)} />
        </div>
      </div>

      {/* Form */}
      <div className="space-y-3">
        <FormField label={t(d.selectAttention)}>
          <select
            value={selectedCluster}
            onChange={(e) => setSelectedCluster(e.target.value)}
            className="input-field"
          >
            <option value="">{t(d.selectAttentionPlaceholder)}</option>
            {attentions.map((a) => (
              <option key={a.id} value={a.id}>
                a/{a.slug || a.title.slice(0, 30)} — {a.attention_score.toLocaleString()} energy
              </option>
            ))}
          </select>
        </FormField>

        {selectedAttention && (
          <div className="flex items-center gap-3 rounded-xl border border-indigo-400/30 bg-indigo-500/5 px-4 py-3">
            <RiFlashlightLine className="size-5 text-indigo-500" />
            <div>
              <p className="text-[13px] font-black text-foreground">{selectedAttention.title}</p>
              <p className="text-[11px] font-medium text-muted-foreground">
                {selectedAttention.attention_score.toLocaleString()} energy · {selectedAttention.post_count} posts
              </p>
            </div>
          </div>
        )}

        <FormField label={t(d.sponsorNameLabel)}>
          <input
            value={sponsorName}
            onChange={(e) => setSponsorName(e.target.value)}
            placeholder={t(d.sponsorNamePlaceholder)}
            className="input-field"
          />
        </FormField>

        <FormField label={t(d.sponsorTagline)}>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder={t(d.sponsorTaglinePlaceholder)}
            className="input-field"
          />
        </FormField>

        <FormField label={t(d.destinationUrl)}>
          <input
            value={sponsorUrl}
            onChange={(e) => setSponsorUrl(e.target.value)}
            placeholder="https://"
            className="input-field"
          />
        </FormField>

        <FormField label={t(d.brandColor)}>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-10 cursor-pointer rounded-lg border border-border"
            />
            <span className="text-[12px] font-mono font-bold text-muted-foreground">{color}</span>
          </div>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t(d.bidAmountLabel)}>
            <div className="relative">
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={bidInputMode === "mom" ? "100" : "1.00"}
                min={bidInputMode === "mom" ? 100 : 0.10}
                step={bidInputMode === "usd" ? "0.01" : "1"}
                className="input-field pr-20"
              />
              <button
                type="button"
                onClick={() => {
                  const numVal = parseFloat(bidAmount) || 0;
                  if (bidInputMode === "mom") {
                    setBidInputMode("usd");
                    setBidAmount(numVal > 0 ? (numVal * momRate).toFixed(2) : "");
                  } else {
                    setBidInputMode("mom");
                    setBidAmount(numVal > 0 ? Math.round(numVal / momRate).toString() : "");
                  }
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg border border-border bg-zinc-100 px-2 py-1 text-[10px] font-black text-muted-foreground transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:bg-zinc-800"
              >
                {bidInputMode === "mom" ? "MOM" : "USD"}
                <span className="text-[9px]">⇄</span>
              </button>
            </div>
            {parseFloat(bidAmount) > 0 && (
              <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                ≒ {bidInputMode === "mom"
                  ? `$${(parseFloat(bidAmount) * momRate).toFixed(2)} USD`
                  : `${Math.round(parseFloat(bidAmount) / momRate).toLocaleString()} MOM`}
              </p>
            )}
          </FormField>
          <FormField label={t(d.duration)}>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value) || 1)}
                min={1}
                max={365}
                className="input-field"
              />
              <span className="text-[12px] font-bold text-muted-foreground shrink-0">{t(d.days)}</span>
            </div>
          </FormField>
        </div>

        {/* Energy preview */}
        {bidNum > 0 && (
          <div className="rounded-xl border border-border bg-zinc-50/50 p-3 space-y-1.5 dark:bg-zinc-900/30">
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">{t(d.energyBreakdown)}</p>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">{t(d.attentionEnergy)} (60%)</span>
              <span className="font-black text-indigo-600 dark:text-indigo-400">+{Math.round(bidNum * 0.6)} MOM</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">{t(d.platformEnergy)} (20%)</span>
              <span className="font-black text-blue-600 dark:text-blue-400">+{Math.round(bidNum * 0.2)} MOM</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">{t(d.builderReward)} (20%)</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">+{Math.round(bidNum * 0.2)} MOM</span>
            </div>
            <div className="h-px bg-border my-1" />
            <div className="flex justify-between text-[12px]">
              <span className="font-bold text-muted-foreground">Total</span>
              <span className="font-black text-foreground">{bidNum.toLocaleString()} MOM ≒ ${(bidNum * momRate).toFixed(2)}</span>
            </div>
          </div>
        )}

        {result === "success" && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-3 text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
            ✓ {t(d.sponsorSuccess)}
          </div>
        )}
        {result === "insufficient" && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 p-3 text-[12px] font-bold text-rose-700 dark:text-rose-400">
            ✗ {t(d.insufficientEnergy)}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedCluster || !sponsorName || !sponsorUrl || !bidAmount}
          className="w-full rounded-full bg-indigo-600 py-3 text-[14px] font-black text-white transition-all hover:bg-indigo-700 disabled:opacity-40 active:scale-[0.98]"
        >
          {submitting ? "..." : t(d.submitSponsorship)}
        </button>
      </div>
    </div>
  );
}

/* ── My Campaigns Dashboard ────────────────────────────────── */

type CampaignRow = {
  id: string;
  title: string;
  status: string;
  positions: string[];
  budget_type: string;
  impression_count: number;
  click_count: number;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
};

type SponsorshipRow = {
  id: string;
  cluster_id: string;
  sponsor_name: string;
  sponsor_tagline: string | null;
  bid_amount: number;
  energy_granted: number;
  impression_count: number;
  click_count: number;
  status: string;
  starts_at: string;
  ends_at: string;
  attention_title?: string;
  attention_slug?: string;
};

function MyCampaignsDashboard({ userId }: { userId: string }) {
  const { dictionary, t } = useI18n();
  const d = dictionary.advertisePage;
  const dd = dictionary.advertisePage.dashboard;
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [sponsorships, setSponsorships] = useState<SponsorshipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"campaigns" | "sponsorships">("campaigns");

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function load() {
      // Load campaigns
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: campData } = await (supabase as any)
        .from("ad_campaigns")
        .select("id, title, status, positions, budget_type, impression_count, click_count, starts_at, ends_at, created_at")
        .eq("advertiser_id", userId)
        .order("created_at", { ascending: false });

      // Load sponsorships
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sponsorData } = await (supabase as any)
        .from("attention_sponsorships")
        .select("id, cluster_id, sponsor_name, sponsor_tagline, bid_amount, energy_granted, impression_count, click_count, status, starts_at, ends_at")
        .eq("sponsor_id", userId)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      setCampaigns((campData ?? []) as CampaignRow[]);

      // Enrich sponsorships with attention info
      const sponsorRows = (sponsorData ?? []) as SponsorshipRow[];
      if (sponsorRows.length > 0) {
        const clusterIds = [...new Set(sponsorRows.map((s) => s.cluster_id))];
        const { data: clusters } = await supabase
          .from("attention_clusters")
          .select("id, title, slug")
          .in("id", clusterIds);

        const clusterMap = new Map(
          (clusters ?? []).map((c: { id: string; title: string; slug: string | null }) => [c.id, c]),
        );

        for (const s of sponsorRows) {
          const cl = clusterMap.get(s.cluster_id);
          if (cl) {
            s.attention_title = cl.title;
            s.attention_slug = cl.slug ?? undefined;
          }
        }
      }

      setSponsorships(sponsorRows);
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [userId]);

  const handleToggleStatus = useCallback(
    async (campaignId: string, currentStatus: string) => {
      const supabase = createClient();
      const newStatus = currentStatus === "active" ? "paused" : "active";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("ad_campaigns")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", campaignId);

      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, status: newStatus } : c)),
      );
    },
    [],
  );

  if (loading) {
    return (
      <div className="py-12 text-center text-sm font-bold text-muted-foreground">
        Loading...
      </div>
    );
  }

  const totalImpressions = campaigns.reduce((s, c) => s + c.impression_count, 0)
    + sponsorships.reduce((s, c) => s + c.impression_count, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.click_count, 0)
    + sponsorships.reduce((s, c) => s + c.click_count, 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={RiEyeLine} label={t(dd.impressions)} value={totalImpressions.toLocaleString()} color="blue" />
        <StatCard icon={RiMouseLine} label={t(dd.clicks)} value={totalClicks.toLocaleString()} color="emerald" />
        <StatCard icon={RiBarChartBoxLine} label="CTR" value={`${avgCtr}%`} color="indigo" />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("campaigns")}
          className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition-all ${
            view === "campaigns"
              ? "bg-foreground text-background"
              : "border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
          }`}
        >
          {t(dd.adCampaigns)} ({campaigns.length})
        </button>
        <button
          onClick={() => setView("sponsorships")}
          className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition-all ${
            view === "sponsorships"
              ? "bg-foreground text-background"
              : "border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
          }`}
        >
          {t(dd.sponsorships)} ({sponsorships.length})
        </button>
      </div>

      {/* Campaign list */}
      {view === "campaigns" ? (
        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <EmptyState text={t(dd.noCampaigns)} />
          ) : (
            campaigns.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-border/80 bg-background p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.status} />
                      <p className="truncate text-[13px] font-black text-foreground">
                        {c.title}
                      </p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {c.positions.map((p) => (
                        <span
                          key={p}
                          className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground dark:bg-zinc-800"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-1.5 shrink-0">
                    {(c.status === "active" || c.status === "paused") && (
                      <button
                        onClick={() => handleToggleStatus(c.id, c.status)}
                        className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-blue-400 hover:text-blue-600"
                        title={c.status === "active" ? t(dd.pause) : t(dd.resume)}
                      >
                        {c.status === "active" ? (
                          <RiPauseLine className="size-3.5" />
                        ) : (
                          <RiPlayLine className="size-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-zinc-50/60 p-2.5 dark:bg-zinc-900/30">
                  <MetricCell label={t(dd.impressions)} value={c.impression_count.toLocaleString()} />
                  <MetricCell label={t(dd.clicks)} value={c.click_count.toLocaleString()} />
                  <MetricCell
                    label="CTR"
                    value={
                      c.impression_count > 0
                        ? `${((c.click_count / c.impression_count) * 100).toFixed(1)}%`
                        : "—"
                    }
                  />
                </div>

                {/* Dates */}
                <div className="mt-2 flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                  <RiTimeLine className="size-3" />
                  <span>{fmtDate(c.starts_at)}</span>
                  <span>→</span>
                  <span>{c.ends_at ? fmtDate(c.ends_at) : "∞"}</span>
                  {c.ends_at && isExpired(c.ends_at) && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400">
                      {t(dd.expired)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Sponsorship list */
        <div className="space-y-3">
          {sponsorships.length === 0 ? (
            <EmptyState text={t(dd.noSponsorships)} />
          ) : (
            sponsorships.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.02] p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={s.status} />
                      <p className="truncate text-[13px] font-black text-foreground">
                        {s.sponsor_name}
                      </p>
                    </div>
                    {s.attention_title && (
                      <p className="mt-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        a/{s.attention_slug || s.attention_title.slice(0, 20)}
                      </p>
                    )}
                    {s.sponsor_tagline && (
                      <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                        {s.sponsor_tagline}
                      </p>
                    )}
                  </div>
                  {/* Renew / extend */}
                  {s.status === "active" && (
                    <a
                      href={`/advertise?sponsor=${s.attention_slug || s.cluster_id}`}
                      className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-indigo-400 hover:text-indigo-600"
                      title={t(dd.renew)}
                    >
                      <RiRefreshLine className="size-3.5" />
                    </a>
                  )}
                </div>

                {/* Metrics */}
                <div className="mt-3 grid grid-cols-4 gap-2 rounded-xl bg-zinc-50/60 p-2.5 dark:bg-zinc-900/30">
                  <MetricCell label="MOM" value={s.bid_amount.toLocaleString()} accent />
                  <MetricCell label={t(dd.energy)} value={`+${s.energy_granted.toLocaleString()}`} />
                  <MetricCell label={t(dd.impressions)} value={s.impression_count.toLocaleString()} />
                  <MetricCell
                    label="CTR"
                    value={
                      s.impression_count > 0
                        ? `${((s.click_count / s.impression_count) * 100).toFixed(1)}%`
                        : "—"
                    }
                  />
                </div>

                {/* Dates */}
                <div className="mt-2 flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                  <RiTimeLine className="size-3" />
                  <span>{fmtDate(s.starts_at)}</span>
                  <span>→</span>
                  <span>{fmtDate(s.ends_at)}</span>
                  {isExpired(s.ends_at) && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400">
                      {t(dd.expired)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Dashboard Sub-components ──────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof RiEyeLine;
  label: string;
  value: string;
  color: "blue" | "emerald" | "indigo";
}) {
  const colorMap = {
    blue: "text-blue-600 dark:text-blue-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    indigo: "text-indigo-600 dark:text-indigo-400",
  };
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-center">
      <Icon className={`mx-auto size-4 ${colorMap[color]}`} />
      <p className={`mt-1 text-[16px] font-black tabular-nums ${colorMap[color]}`}>{value}</p>
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    paused: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    draft: "bg-zinc-100 text-muted-foreground dark:bg-zinc-800",
    completed: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    expired: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    rejected: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    outbid: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  );
}

function MetricCell({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-[13px] font-black tabular-nums ${accent ? "text-indigo-600 dark:text-indigo-400" : "text-foreground"}`}>
        {value}
      </p>
      <p className="text-[9px] font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-10 text-center">
      <RiAdvertisementLine className="mx-auto size-8 text-muted-foreground/40" />
      <p className="mt-2 text-[13px] font-bold text-muted-foreground">{text}</p>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(iso));
}

function isExpired(iso: string) {
  return new Date(iso) < new Date();
}

/* ── Shared UI ─────────────────────────────────────────────── */

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-black text-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function EnergyTag({ label, desc, accent = false }: { label: string; desc: string; accent?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
      accent
        ? "bg-blue-600/10 text-blue-700 dark:text-blue-400"
        : "bg-zinc-100 text-muted-foreground dark:bg-zinc-800"
    }`}>
      <RiTimeLine className="size-2.5" />
      {label} {desc}
    </span>
  );
}
