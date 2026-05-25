"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RiEyeLine,
  RiFlashlightFill,
  RiFlashlightLine,
  RiGroupLine,
  RiHeartFill,
  RiMedalFill,
  RiShieldStarFill,
  RiSparkling2Fill,
  RiTeamLine,
  RiTrophyFill,
  RiUserStarFill,
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

type Contributor = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_energy: number;
  contribution_ratio: number;
  role_badge: string;
  rank: number;
  post_count: number;
  comment_count: number;
  evidence_count: number;
  donation_count: number;
};

// ────────────────────────────────────────────
// 1. Attention Energy Gauge
// ────────────────────────────────────────────

export function AttentionEnergyGauge({
  attentionScore,
  viewCount = 0,
  donationTotal = 0,
}: {
  attentionScore: number;
  viewCount?: number;
  donationTotal?: number;
}) {
  const { dictionary, t } = useI18n();
  const m = dictionary.attentionMonetization;

  // Energy level color
  const energyColor =
    attentionScore >= 1000
      ? "text-amber-500"
      : attentionScore >= 500
        ? "text-blue-500"
        : attentionScore >= 100
          ? "text-emerald-500"
          : "text-muted-foreground";

  const energyBg =
    attentionScore >= 1000
      ? "from-amber-500/20 to-amber-500/5"
      : attentionScore >= 500
        ? "from-blue-500/20 to-blue-500/5"
        : attentionScore >= 100
          ? "from-emerald-500/20 to-emerald-500/5"
          : "from-zinc-500/10 to-zinc-500/5";

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm">
      <div className={`bg-gradient-to-b ${energyBg} px-4 py-4`}>
        <div className="flex items-center gap-2">
          <RiFlashlightFill className={`size-5 ${energyColor}`} />
          <p className="text-sm font-black text-foreground">
            {t(m.energyGauge.label)}
          </p>
        </div>
        <p className={`mt-2 text-3xl font-black tabular-nums ${energyColor}`}>
          {formatNumber(attentionScore)}
        </p>
      </div>
      <div className="flex divide-x divide-border border-t border-border">
        <MiniStat
          icon={<RiEyeLine className="size-3.5" />}
          value={formatCompact(viewCount)}
          label={t(m.energyGauge.views)}
        />
        
        <MiniStat
          icon={<RiHeartFill className="size-3.5 text-rose-400" />}
          value={`${formatCompact(donationTotal)} MOM`}
          label={t(m.energyGauge.donations)}
        />
      </div>
    </section>
  );
}

function MiniStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 px-2 py-2.5">
      {icon}
      <p className="text-[13px] font-black tabular-nums text-foreground">
        {value}
      </p>
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

// ────────────────────────────────────────────
// 2. Contributor Leaderboard
// ────────────────────────────────────────────

export function AttentionLeaderboard({
  clusterId,
}: {
  clusterId: string;
}) {
  const { dictionary, t } = useI18n();
  const m = dictionary.attentionMonetization;
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("attention_contributor_rankings")
      .select("*")
      .eq("cluster_id", clusterId)
      .order("rank", { ascending: true })
      .limit(10)
      .then(({ data }: { data: unknown }) => {
        setContributors((data as Contributor[]) ?? []);
        setLoading(false);
      });
  }, [clusterId]);

  if (loading) {
    return (
      <section className="overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm">
        <div className="px-4 py-3 border-b border-border">
          <div className="h-5 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="space-y-3 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800/50" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <RiTrophyFill className="size-4 text-amber-500" />
        <h2 className="text-[15px] font-black text-foreground">
          {t(m.leaderboard.title)}
        </h2>
        {contributors.length > 0 && (
          <span className="ml-auto text-[11px] font-medium text-muted-foreground">
            {contributors.length} {t(m.leaderboard.totalContributors)}
          </span>
        )}
      </div>
      <div className="divide-y divide-border/50">
        {contributors.length > 0 ? (
          contributors.map((c) => (
            <ContributorRow key={c.user_id} contributor={c} />
          ))
        ) : (
          <p className="px-4 py-6 text-center text-sm font-medium text-muted-foreground">
            —
          </p>
        )}
      </div>
    </section>
  );
}

function ContributorRow({ contributor: c }: { contributor: Contributor }) {
  const { dictionary, t } = useI18n();
  const badge = dictionary.attentionMonetization.roleBadge;

  const badgeConfig = useMemo(() => {
    switch (c.role_badge) {
      case "builder":
        return { icon: <RiSparkling2Fill className="size-3" />, label: t(badge.builder), color: "text-amber-600 bg-amber-500/10" };
      case "analyst":
        return { icon: <RiUserStarFill className="size-3" />, label: t(badge.analyst), color: "text-blue-600 bg-blue-500/10" };
      case "verifier":
        return { icon: <RiShieldStarFill className="size-3" />, label: t(badge.verifier), color: "text-emerald-600 bg-emerald-500/10" };
      case "debater":
        return { icon: <RiTeamLine className="size-3" />, label: t(badge.debater), color: "text-purple-600 bg-purple-500/10" };
      case "supporter":
        return { icon: <RiHeartFill className="size-3" />, label: t(badge.supporter), color: "text-rose-600 bg-rose-500/10" };
      default:
        return { icon: <RiMedalFill className="size-3" />, label: t(badge.contributor), color: "text-zinc-600 bg-zinc-500/10" };
    }
  }, [c.role_badge, t, badge]);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30">
      <span className="w-5 text-center text-[12px] font-black tabular-nums text-muted-foreground">
        {c.rank <= 3 ? ["🥇", "🥈", "🥉"][c.rank - 1] : `#${c.rank}`}
      </span>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-[11px] font-black text-foreground overflow-hidden">
        {c.avatar_url ? (
          <img src={c.avatar_url} alt="" className="size-full object-cover" />
        ) : (
          (c.display_name?.[0] || c.handle?.[0] || "?").toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-foreground">
          {c.display_name || c.handle || "—"}
        </p>
        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-black ${badgeConfig.color}`}>
          {badgeConfig.icon}
          {badgeConfig.label}
        </span>
      </div>
      <div className="text-right">
        <p className="text-[12px] font-black tabular-nums text-foreground">
          {c.contribution_ratio.toFixed(1)}%
        </p>
        <p className="text-[10px] font-medium tabular-nums text-muted-foreground">
          ⚡{formatCompact(c.total_energy)}
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// 3. Donation Button + Modal
// ────────────────────────────────────────────

const DONATION_PRESETS = [100, 300, 500, 1000];

export function AttentionDonateSection({
  clusterId,
  attentionScore,
  onDonated,
}: {
  clusterId: string;
  attentionScore: number;
  onDonated?: (energyGranted: number) => void;
}) {
  const { dictionary, t } = useI18n();
  const m = dictionary.attentionMonetization.donation;

  const [showModal, setShowModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(300);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ energy: number } | null>(null);

  const effectiveAmount = customAmount ? parseInt(customAmount, 10) || 0 : selectedAmount;
  const previewEnergy = Math.floor(effectiveAmount * 0.60); // 60% of MOM becomes Attention Energy
  const isValid = effectiveAmount >= 10;

  const handleDonate = useCallback(async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("submit_attention_donation", {
        p_cluster_id: clusterId,
        p_bid_amount: effectiveAmount,
        p_message: message || null,
        p_is_anonymous: isAnonymous,
      });

      if (error) {
        if (error.message.includes("insufficient_mom_energy")) {
          // Redirect to profile page to buy MOM
          window.location.href = `/${document.documentElement.lang}/profile`;
          return;
        }
        throw error;
      }
      const result = data as unknown as { attention_score_boost: number };
      setSuccess({ energy: result.attention_score_boost });
      onDonated?.(result.attention_score_boost);

      // Reset after 3s
      setTimeout(() => {
        setShowModal(false);
        setSuccess(null);
        setMessage("");
        setCustomAmount("");
      }, 3000);
    } catch {
      // TODO: show error toast
    } finally {
      setSubmitting(false);
    }
  }, [clusterId, effectiveAmount, isAnonymous, isValid, message, onDonated, submitting]);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-4 py-3 text-sm font-black text-amber-700 transition-all hover:from-amber-500/20 hover:to-orange-500/20 hover:shadow-md dark:text-amber-400"
      >
        <RiFlashlightLine className="size-4" />
        {t(m.donateButton)}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
            {success ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10">
                <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
                  <RiFlashlightFill className="size-8 text-emerald-500" />
                </div>
                <p className="text-lg font-black text-foreground">{t(m.success)}</p>
                <p className="text-sm font-medium text-muted-foreground">
                  +{success.energy} {t(m.previewEnergy)}
                </p>
              </div>
            ) : (
              <>
                <div className="border-b border-border px-5 py-4">
                  <h3 className="text-lg font-black text-foreground">{t(m.title)}</h3>
                  <p className="mt-1 text-[13px] font-medium text-muted-foreground">
                    {t(m.subtitle)}
                  </p>
                </div>

                <div className="space-y-4 px-5 py-4">
                  {/* Current energy */}
                  <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-900/50">
                    <span className="text-[12px] font-medium text-muted-foreground">
                      {t(m.currentEnergy)}
                    </span>
                    <span className="text-sm font-black tabular-nums text-blue-600 dark:text-blue-400">
                      ⚡ {formatNumber(attentionScore)}
                    </span>
                  </div>

                  {/* Amount presets */}
                  <div>
                    <p className="mb-2 text-[12px] font-black text-foreground">{t(m.amountLabel)}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {DONATION_PRESETS.map((amount) => (
                        <button
                          key={amount}
                          onClick={() => { setSelectedAmount(amount); setCustomAmount(""); }}
                          className={`rounded-lg border px-2 py-2 text-[13px] font-bold tabular-nums transition-colors ${
                            !customAmount && selectedAmount === amount
                              ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : "border-border text-foreground hover:border-amber-400"
                          }`}
                        >
                          {amount.toLocaleString()} MOM
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder={t(m.customAmount)}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-amber-500"
                    />
                  </div>

                  {/* Preview */}
                  {isValid && (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium text-muted-foreground">
                          {t(m.previewEnergy)}
                        </span>
                        <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                          +{previewEnergy} ⚡
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Message */}
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t(m.messageLabel)}
                    maxLength={100}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-amber-500"
                  />

                  {/* Anonymous toggle */}
                  <label className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="rounded border-border accent-amber-500"
                    />
                    {t(m.anonymous)}
                  </label>
                </div>

                <div className="flex gap-2 border-t border-border px-5 py-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    ✕
                  </button>
                  <button
                    onClick={handleDonate}
                    disabled={!isValid || submitting}
                    className="flex-[2] rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-black text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
                  >
                    {submitting ? "..." : `${effectiveAmount.toLocaleString()} MOM ${t(m.donateButton)}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────────────
// 4. Donor List
// ────────────────────────────────────────────

type Donor = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_donated_mom: number;
  total_energy_granted: number;
  rank: number;
};

export function AttentionDonorList({ clusterId }: { clusterId: string }) {
  const { dictionary, t } = useI18n();
  const m = dictionary.attentionMonetization.donors;
  const [donors, setDonors] = useState<Donor[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("attention_donor_rankings")
      .select("*")
      .eq("cluster_id", clusterId)
      .order("rank", { ascending: true })
      .limit(5)
      .then(({ data }) => {
        setDonors((data as unknown as Donor[]) ?? []);
      });
  }, [clusterId]);

  if (donors.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <RiHeartFill className="size-4 text-rose-400" />
        <h2 className="text-[15px] font-black text-foreground">{t(m.title)}</h2>
      </div>
      <div className="divide-y divide-border/50">
        {donors.map((d) => (
          <div key={d.user_id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-5 text-center text-[12px] font-black tabular-nums text-muted-foreground">
              {d.rank <= 3 ? ["🥇", "🥈", "🥉"][d.rank - 1] : `#${d.rank}`}
            </span>
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-[10px] font-black overflow-hidden">
              {d.avatar_url ? (
                <img src={d.avatar_url} alt="" className="size-full object-cover" />
              ) : (
                (d.display_name?.[0] || d.handle?.[0] || "?").toUpperCase()
              )}
            </div>
            <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">
              {d.display_name || d.handle || "—"}
            </p>
            <div className="text-right">
              <p className="text-[11px] font-black tabular-nums text-amber-600 dark:text-amber-400">
                {d.total_donated_mom.toLocaleString()} MOM
              </p>
              <p className="text-[9px] font-medium tabular-nums text-muted-foreground">
                +{d.total_energy_granted}⚡
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────
// 5. Page View Tracker Hook
// ────────────────────────────────────────────

export function usePageViewTracker(clusterId: string | null) {
  useEffect(() => {
    if (!clusterId) return;

    const supabase = createClient();
    let viewId: string | null = null;
    const startTime = Date.now();

    // Record page view
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)("record_attention_page_view", {
      p_cluster_id: clusterId,
      p_session_id: getSessionId(),
    })
      .then(({ data }: { data: unknown }) => {
        if (data) viewId = data as string;
      });

    // Record dwell time on unmount
    return () => {
      if (!viewId) return;
      const dwellSeconds = Math.floor((Date.now() - startTime) / 1000);
      if (dwellSeconds >= 5) {
        // Use navigator.sendBeacon for reliability on page leave
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.rpc as any)("record_attention_dwell_time", {
          p_view_id: viewId,
          p_dwell_seconds: dwellSeconds,
        });
      }
    };
  }, [clusterId]);
}

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let sid = sessionStorage.getItem("momment.sid");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("momment.sid", sid);
  }
  return sid;
}

// ────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
