"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { RiAddLine } from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";

import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { LanguageSelect } from "@/shared/i18n/LanguageSelect";

type PlatformVaultOverview = {
  vault_usd: number;
  total_mom_supply: number;
  current_rate: number;
};

export function TopBar() {
  const { dictionary, t } = useI18n();
  const pathname = usePathname();
  const [platformStats, setPlatformStats] = useState<{ vault: number; supply: number; rate: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadPlatformStats() {
      const { data } = await supabase
        .from("platform_vault_overview")
        .select("vault_usd, total_mom_supply, current_rate")
        .maybeSingle();

      if (mounted) {
        const overview = data as PlatformVaultOverview | null;
        setPlatformStats({
          vault: Number(overview?.vault_usd ?? 0),
          supply: Number(overview?.total_mom_supply ?? 0),
          rate: Number(overview?.current_rate ?? 0.001),
        });
      }
    }

    loadPlatformStats();

    return () => {
      mounted = false;
    };
  }, []);

  if (pathname !== "/") {
    return null;
  }

  return (
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-[740px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {platformStats !== null ? (
              <Link href="/rewards" className="flex min-w-0 items-center gap-1.5 rounded-lg border border-blue-200/50 bg-blue-50 px-3 py-1.5 transition-colors hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:hover:bg-blue-500/20">
                <span className="text-[12px] font-bold tracking-tight text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  {t(dictionary.topBar.vault)}
                </span>
                <span className="truncate text-[13px] font-black text-blue-700 dark:text-blue-300">
                  ${formatEnergy(platformStats.vault)}
                </span>
                <div className="mx-1 h-3 w-px bg-blue-200 dark:bg-blue-800" />
                <span className="hidden sm:inline text-[12px] font-bold tracking-tight text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  {t(dictionary.topBar.totalSupply)}
                </span>
                <span className="hidden sm:inline truncate text-[13px] font-black text-blue-700 dark:text-blue-300">
                  {formatEnergy(platformStats.supply)} <span className="text-[10px] text-blue-600/70">MOM</span>
                </span>
                <div className="hidden sm:block mx-1 h-3 w-px bg-blue-200 dark:bg-blue-800" />
                <span className="hidden md:inline text-[12px] font-bold tracking-tight text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  {t(dictionary.topBar.rate)}
                </span>
                <span className="hidden md:inline truncate text-[13px] font-black text-emerald-600 dark:text-emerald-400">
                  ${platformStats.rate.toFixed(4)}
                </span>
              </Link>
            ) : (
              <Link href="/rewards" className="flex min-w-0 items-center gap-1.5 rounded-lg border border-blue-200/50 bg-blue-50 px-3 py-1.5 transition-colors hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:hover:bg-blue-500/20">
                <span className="text-[12px] font-bold tracking-tight text-blue-600 dark:text-blue-400">
                  momment.
                </span>
              </Link>
            )}
            <Link
              href="/economy"
              className="hidden sm:flex shrink-0 items-center gap-1 rounded-full border border-zinc-200/60 bg-zinc-50 px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:border-zinc-700/50 dark:bg-zinc-800/40 dark:hover:bg-zinc-800"
            >
              <span className="text-foreground">momment.</span> Social-Fi?
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/posts/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-sm font-black text-white transition-colors hover:bg-blue-700"
            >
              <RiAddLine className="size-4" />
              {t(dictionary.home.postButton)}
            </Link>

            <div className="flex items-center gap-2 lg:hidden">
              <ThemeToggle />
              <div className="hidden sm:block">
                <LanguageSelect compact />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function formatEnergy(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}k`;
  }

  return Math.round(value).toLocaleString();
}
