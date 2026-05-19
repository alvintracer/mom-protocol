"use client";

import { useEffect, useState } from "react";
import { RiShieldStarLine, RiExternalLinkLine } from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";

/* ── Types ──────────────────────────────────────────────────── */

type Sponsorship = {
  id: string;
  sponsor_name: string;
  sponsor_logo_url: string | null;
  sponsor_tagline: string | null;
  sponsor_url: string;
  sponsor_color: string | null;
  bid_amount: number;
  energy_granted: number;
  starts_at: string;
  ends_at: string;
};

type Props = {
  clusterId: string;
};

/**
 * AttentionSponsorBadge — Shows the active sponsor for an attention cluster.
 * Renders a premium branded section with the sponsor's name, tagline, and logo.
 * Records impressions/clicks via RPC.
 */
export function AttentionSponsorBadge({ clusterId }: Props) {
  const { dictionary, t } = useI18n();
  const [sponsor, setSponsor] = useState<Sponsorship | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("attention_sponsorships")
        .select("id, sponsor_name, sponsor_logo_url, sponsor_tagline, sponsor_url, sponsor_color, bid_amount, energy_granted, starts_at, ends_at")
        .eq("cluster_id", clusterId)
        .eq("status", "active")
        .lte("starts_at", new Date().toISOString())
        .gte("ends_at", new Date().toISOString())
        .limit(1);

      if (mounted && data && data.length > 0) {
        setSponsor(data[0] as Sponsorship);

        // Record impression
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).rpc("record_sponsorship_impression", {
          p_sponsorship_id: data[0].id,
        });
      }
    }

    load();
    return () => { mounted = false; };
  }, [clusterId]);

  if (!sponsor) return null;

  const accentColor = sponsor.sponsor_color || "#3b82f6";

  const handleClick = async () => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("record_sponsorship_click", {
      p_sponsorship_id: sponsor.id,
    });
  };

  return (
    <a
      href={sponsor.sponsor_url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={handleClick}
      className="group block overflow-hidden rounded-2xl border transition-all hover:shadow-lg"
      style={{
        borderColor: `${accentColor}30`,
        background: `linear-gradient(135deg, ${accentColor}08, transparent 60%)`,
      }}
    >
      {/* Sponsor header badge */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: `1px solid ${accentColor}15` }}
      >
        <RiShieldStarLine className="size-3.5 shrink-0" style={{ color: accentColor }} />
        <span
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: accentColor }}
        >
          {t(dictionary.ads.sponsoredBy)}
        </span>
        <RiExternalLinkLine className="ml-auto size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {/* Sponsor content */}
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-center gap-3">
          {/* Logo */}
          {sponsor.sponsor_logo_url ? (
            <img
              src={sponsor.sponsor_logo_url}
              alt={sponsor.sponsor_name}
              className="size-10 rounded-xl object-cover shadow-sm"
            />
          ) : (
            <div
              className="flex size-10 items-center justify-center rounded-xl text-white text-[15px] font-black shadow-sm"
              style={{ background: accentColor }}
            >
              {sponsor.sponsor_name[0]?.toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-black text-foreground truncate">
              {sponsor.sponsor_name}
            </p>
            {sponsor.sponsor_tagline && (
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground truncate">
                {sponsor.sponsor_tagline}
              </p>
            )}
          </div>
        </div>

        {/* Energy contribution */}
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-zinc-50/80 dark:bg-zinc-900/30 px-3 py-1.5">
          <span className="text-[10px] font-bold text-muted-foreground">
            {t(dictionary.ads.energyContributed)}
          </span>
          <span className="ml-auto text-[12px] font-black" style={{ color: accentColor }}>
            +{sponsor.energy_granted.toLocaleString()} MOM
          </span>
        </div>
      </div>
    </a>
  );
}
