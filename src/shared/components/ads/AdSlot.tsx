"use client";

import { useEffect, useRef, useState } from "react";
import { RiAdvertisementLine, RiExternalLinkLine } from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import { NetworkScriptRenderer } from "@/shared/components/ads/NetworkAds";

/* ── Types ──────────────────────────────────────────────────── */

type SlotPosition = "feed_top" | "feed_mid" | "feed_bottom" | "sidebar" | "sidebar_mid" | "sidebar_bottom" | "attention_top" | "attention_sidebar" | "post_detail_bottom";
type SlotSize = "banner" | "rectangle" | "leaderboard" | "native";

type SelfServeAd = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  destination_url: string;
  advertiser_name: string;
  cta_label: string | null;
};

type AdSlotProps = {
  /** Where this slot is placed */
  position: SlotPosition;
  /** Visual size preset */
  size?: SlotSize;
  /** Google AdSense slot ID (if using AdSense for this slot) */
  adsenseSlot?: string;
  /** Attention cluster ID (for attention-scoped ads) */
  clusterId?: string;
  /** Extra CSS classes */
  className?: string;
};

/* ── Constants ──────────────────────────────────────────────── */

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
const ADSENSE_ENABLED = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true";

/* ── AdSlot Component ───────────────────────────────────────── */

/**
 * Universal Ad Slot: renders either
 *   1. A self-serve ad from the momment. ad_campaigns table, OR
 *   2. A Google AdSense unit as fallback
 *
 * Priority: Self-serve ad > AdSense > Hidden
 * All ads are clearly labeled "Ad" and styled to blend with the momment. design system.
 */
export function AdSlot({ position, size = "native", adsenseSlot, clusterId, className = "" }: AdSlotProps) {
  const { dictionary, t } = useI18n();
  const [selfServeAd, setSelfServeAd] = useState<SelfServeAd | null>(null);
  const [selfServeLoaded, setSelfServeLoaded] = useState(false);
  const [networkAd, setNetworkAd] = useState<{ script_code: string } | null>(null);
  const [networkLoaded, setNetworkLoaded] = useState(false);
  const adRef = useRef<HTMLDivElement>(null);

  // Load self-serve ad
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadAd() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabase as any)
          .from("ad_campaigns")
          .select("id, title, body, image_url, destination_url, advertiser_name, cta_label")
          .eq("status", "active")
          .contains("positions", [position])
          .lte("starts_at", new Date().toISOString())
          .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
          .order("priority", { ascending: false })
          .limit(1);

        if (clusterId) {
          query = query.or(`cluster_id.is.null,cluster_id.eq.${clusterId}`);
        }

        const { data } = await query;

        if (mounted && data && data.length > 0) {
          setSelfServeAd(data[0] as SelfServeAd);
        }
      } catch {
        // ad_campaigns table might not exist — that's OK
      } finally {
        if (mounted) setSelfServeLoaded(true);
      }
    }

    loadAd();
    return () => { mounted = false; };
  }, [position, clusterId]);

  // Load network ad independently (parallel) with device targeting
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const deviceType = isMobile ? "mobile" : "desktop";

    async function loadNetworkAd() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("ad_network_placements")
          .select("script_code")
          .eq("is_active", true)
          .eq("position", position)
          .in("device", ["all", deviceType])
          .order("priority", { ascending: false })
          .limit(1);

        if (mounted && data && data.length > 0) setNetworkAd(data[0]);
      } catch {
        // table might not exist yet
      } finally {
        if (mounted) setNetworkLoaded(true);
      }
    }

    loadNetworkAd();
    return () => { mounted = false; };
  }, [position]);

  // Record impression
  useEffect(() => {
    if (!selfServeAd) return;
    const supabase = createClient();

    // Fire and forget — record impression
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("ad_impressions")
      .insert({
        campaign_id: selfServeAd.id,
        position,
        cluster_id: clusterId ?? null,
      })
      .then(() => {});
  }, [selfServeAd, position, clusterId]);

  // Wait for both loaders to finish
  if (!selfServeLoaded && !networkLoaded) return null;

  // Priority 1: Self-serve ad
  if (selfServeAd) {
    return (
      <div className={`group ${className}`} ref={adRef}>
        <a
          href={selfServeAd.destination_url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className={`block overflow-hidden rounded-2xl border border-border/60 bg-background transition-all hover:border-blue-400/50 hover:shadow-md ${sizeClasses(size)}`}
          onClick={() => recordClick(selfServeAd.id, position, clusterId)}
        >
          {/* Ad Badge */}
          <div className="flex items-center justify-between px-3 pt-2.5">
            <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground dark:bg-zinc-800">
              <RiAdvertisementLine className="size-2.5" />
              {t(dictionary.ads.sponsored)}
            </span>
            <RiExternalLinkLine className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>

          {/* Image (if any) */}
          {selfServeAd.image_url && (
            <div className="mt-2 px-3">
              <img
                src={selfServeAd.image_url}
                alt={selfServeAd.title}
                className="w-full rounded-lg object-cover"
                style={{ maxHeight: size === "banner" ? 80 : 200 }}
              />
            </div>
          )}

          {/* Content */}
          <div className="p-3 pt-2">
            <p className="text-[13px] font-bold leading-snug text-foreground">
              {selfServeAd.title}
            </p>
            {selfServeAd.body && (
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted-foreground line-clamp-2">
                {selfServeAd.body}
              </p>
            )}
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground">
                {selfServeAd.advertiser_name}
              </span>
              {selfServeAd.cta_label && (
                <span className="rounded-full bg-blue-600 px-3 py-1 text-[10px] font-black text-white">
                  {selfServeAd.cta_label}
                </span>
              )}
            </div>
          </div>
        </a>
      </div>
    );
  }

  // Priority 2: Network ad script (Adsterra, etc.)
  if (networkAd) {
    return (
      <div className={className} ref={adRef}>
        <NetworkScriptRenderer html={networkAd.script_code} />
      </div>
    );
  }

  // Priority 3: Google AdSense
  if (ADSENSE_ENABLED && ADSENSE_CLIENT && adsenseSlot) {
    return (
      <div className={`${className}`} ref={adRef}>
        <div className="overflow-hidden rounded-2xl border border-border/40">
          <div className="flex items-center gap-1 px-3 pt-2">
            <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground dark:bg-zinc-800">
              <RiAdvertisementLine className="size-2.5" />
              {t(dictionary.ads.sponsored)}
            </span>
          </div>
          <div className="p-2">
            <AdSenseUnit client={ADSENSE_CLIENT} slot={adsenseSlot} format={adsenseFormat(size)} />
          </div>
        </div>
      </div>
    );
  }

  // No ad available — render nothing
  return null;
}

/* ── AdSense Unit ───────────────────────────────────────────── */

function AdSenseUnit({ client, slot, format }: { client: string; slot: string; format: string }) {
  const containerRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    // Reset on each mount so re-renders on route change can re-push
    pushed.current = false;

    function tryPush() {
      if (pushed.current) return;
      // Don't push if container has no width (causes AdSense error)
      if (containerRef.current && containerRef.current.offsetWidth === 0) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ads = (window as any).adsbygoogle;
        if (ads) {
          ads.push({});
          pushed.current = true;
        } else {
          // Script not loaded yet — retry
          setTimeout(tryPush, 500);
        }
      } catch {
        // Silently ignore — adsbygoogle may throw if already filled
      }
    }

    // Give the <ins> element a tick to mount, then push
    const timer = setTimeout(tryPush, 200);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ins
      ref={containerRef}
      className="adsbygoogle"
      style={{ display: "block", minHeight: 100 }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}

/* ── Helpers ────────────────────────────────────────────────── */

function sizeClasses(size: SlotSize): string {
  switch (size) {
    case "banner":
      return "min-h-[100px]";
    case "rectangle":
      return "min-h-[250px]";
    case "leaderboard":
      return "min-h-[90px]";
    case "native":
    default:
      return "";
  }
}

function adsenseFormat(size: SlotSize): string {
  switch (size) {
    case "banner":
      return "horizontal";
    case "rectangle":
      return "rectangle";
    case "leaderboard":
      return "horizontal";
    case "native":
    default:
      return "auto";
  }
}

async function recordClick(campaignId: string, position: string, clusterId?: string) {
  try {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("ad_clicks")
      .insert({
        campaign_id: campaignId,
        position,
        cluster_id: clusterId ?? null,
      });
  } catch {
    // Silent fail
  }
}
