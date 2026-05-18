"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RiAddLine } from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";

import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { LanguageSelect } from "@/shared/i18n/LanguageSelect";

type PlatformVaultOverview = {
  cumulative_energy: number;
  monthly_energy: number;
};

export function TopBar() {
  const { dictionary, t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFeed = searchParams.get("feed") === "following" ? "following" : "for-you";
  const [platformStats, setPlatformStats] = useState<{ total: number; monthly: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadPlatformStats() {
      const { data } = await supabase
        .from("platform_vault_overview")
        .select("cumulative_energy, monthly_energy")
        .maybeSingle();

      if (mounted) {
        const overview = data as PlatformVaultOverview | null;
        setPlatformStats({
          total: Number(overview?.cumulative_energy ?? 0),
          monthly: Number(overview?.monthly_energy ?? 0),
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
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          {platformStats !== null ? (
            <Link href="/rewards" className="flex min-w-0 items-center gap-1.5 rounded-lg border border-blue-200/50 bg-blue-50 px-3 py-1.5 transition-colors hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:hover:bg-blue-500/20">
              <span className="text-[12px] font-bold tracking-tight text-blue-600 dark:text-blue-400 whitespace-nowrap">
                {t(dictionary.topBar.platformEnergy)}
              </span>
              <div className="mx-1 h-3 w-px bg-blue-200 dark:bg-blue-800" />
              <span className="hidden sm:inline text-[12px] font-bold tracking-tight text-blue-600 dark:text-blue-400 whitespace-nowrap">
                {t(dictionary.topBar.platformCumulative)}
              </span>
              <span className="truncate text-[13px] font-black text-blue-700 dark:text-blue-300">
                {formatEnergy(platformStats.total)}
              </span>
              <div className="mx-1 h-3 w-px bg-blue-200 dark:bg-blue-800" />
              <span className="hidden sm:inline text-[12px] font-bold tracking-tight text-blue-600 dark:text-blue-400 whitespace-nowrap">
                {t(dictionary.topBar.platformMonthly)}
              </span>
              <span className="hidden sm:inline truncate text-[13px] font-black text-emerald-600 dark:text-emerald-400">
                {formatEnergy(platformStats.monthly)}
              </span>
            </Link>
          ) : (
            <Link href="/rewards" className="flex min-w-0 items-center gap-1.5 rounded-lg border border-blue-200/50 bg-blue-50 px-3 py-1.5 transition-colors hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:hover:bg-blue-500/20">
              <span className="text-[12px] font-bold tracking-tight text-blue-600 dark:text-blue-400">
                momment.
              </span>
            </Link>
          )}
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

        {/* Tabs */}
        <div className="flex w-full mt-1">
          <Link
            href="/"
            className={`flex-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors relative flex items-center justify-center h-[53px] ${
              activeFeed === "for-you" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <span className="font-bold relative h-full flex items-center">
              {t(dictionary.home.forYou)}
              {activeFeed === "for-you" ? (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-full" />
              ) : null}
            </span>
          </Link>
          <Link
            href="/?feed=following"
            className={`flex-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors relative flex items-center justify-center h-[53px] ${
              activeFeed === "following" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <span className="font-bold relative h-full flex items-center">
              {t(dictionary.home.following)}
              {activeFeed === "following" ? (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-full" />
              ) : null}
            </span>
          </Link>
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
