"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { LanguageSelect } from "@/shared/i18n/LanguageSelect";
import { createClient } from "@/shared/lib/supabase/client";
import type { Database } from "@/shared/types/database";
import { 
  RiHome7Fill, 
  RiBarChartGroupedFill, 
  RiSafe2Line,
  RiShieldCheckLine,
  RiNotification4Line, 
  RiMailLine, 
  RiBookmarkLine, 
  RiUser3Line, 
  RiLoginBoxLine,
  RiLogoutBoxRLine,
  RiMegaphoneLine,
  RiCoinLine,
  RiMoreFill
} from "react-icons/ri";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function LeftSidebar() {
  const { dictionary, t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [momRate, setMomRate] = useState<number>(0.001);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadProfile() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!mounted) {
        return;
      }

      setEmail(user?.email ?? null);

      if (!user) {
        setProfile(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (mounted) {
        setProfile(data ?? null);
      }
    }

    loadProfile();

    // Fetch dynamic MOM rate
    fetch("/api/rate")
      .then((res) => res.json())
      .then((data) => {
        if (mounted && data.rate) setMomRate(Number(data.rate));
      })
      .catch(() => {});

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setProfile(null);
    setEmail(null);
  }

  const navItems = [
    { href: "/", label: t(dictionary.nav.home), icon: RiHome7Fill },
    { href: "/explore", label: t(dictionary.nav.explore), icon: RiBarChartGroupedFill },
    { href: "/oracle", label: t(dictionary.nav.oracle), icon: RiShieldCheckLine },
    { href: "/rewards", label: t(dictionary.nav.rewards), icon: RiSafe2Line },
    { href: "/notifications", label: t(dictionary.nav.notifications), icon: RiNotification4Line },
    { href: "/messages", label: t(dictionary.nav.messages), icon: RiMailLine },
    { href: "/bookmarks", label: t(dictionary.nav.bookmarks), icon: RiBookmarkLine },
    { href: "/profile", label: t(dictionary.nav.profile), icon: RiUser3Line },
    { href: "#more", label: t(dictionary.nav.more), icon: RiMoreFill },
  ];

  return (
    <aside className="hidden h-screen shrink-0 border-r border-border bg-background px-3 py-5 lg:sticky lg:top-0 lg:flex lg:flex-col lg:justify-between xl:px-4">
      <div>
        <Link href="/" className="mb-7 flex items-center justify-center px-2 xl:justify-start xl:px-4">
          <Image
            src="/logo-dark.svg"
            alt="momment."
            width={132}
            height={21}
            className="dark:hidden"
            priority
          />
          <Image
            src="/logo-light.svg"
            alt="momment."
            width={132}
            height={21}
            className="hidden dark:block"
            priority
          />
        </Link>

        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (item.href === "#more") {
              return (
                <div key={item.label} className="space-y-0.5">
                  <button
                    onClick={() => setShowMore((v) => !v)}
                    className="flex w-full items-center justify-center gap-4 rounded-full px-3 py-2.5 text-[16px] font-semibold text-foreground transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50 xl:justify-start xl:px-4"
                  >
                    <Icon className="size-[22px] shrink-0" />
                    <span className="hidden xl:inline">{item.label}</span>
                  </button>
                  {showMore && (
                    <>
                      <Link
                        href="/advertise"
                        className="flex items-center justify-center gap-4 rounded-full px-3 py-2.5 text-[16px] font-semibold text-foreground transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50 xl:justify-start xl:px-4"
                      >
                        <RiMegaphoneLine className="size-[22px] shrink-0" />
                        <span className="hidden xl:inline">{t(dictionary.nav.advertise)}</span>
                      </Link>
                      <Link
                        href="/economy"
                        className="flex items-center justify-center gap-4 rounded-full px-3 py-2.5 text-[16px] font-semibold text-foreground transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50 xl:justify-start xl:px-4"
                      >
                        <RiCoinLine className="size-[22px] shrink-0" />
                        <span className="hidden xl:inline">{t(dictionary.nav.economy)}</span>
                      </Link>
                    </>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-center gap-4 rounded-full px-3 py-2.5 text-[16px] font-semibold text-foreground transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50 xl:justify-start xl:px-4"
              >
                <Icon className="size-[22px] shrink-0" />
                <span className="hidden xl:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 flex justify-center xl:justify-start xl:px-3">
          <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1 shadow-sm">
            <div title={t(dictionary.common.theme)}>
              <ThemeToggle />
            </div>
            <div className="h-4 w-px bg-border"></div>
            <div title={t(dictionary.common.languageSettings)}>
              <LanguageSelect compact />
            </div>
          </div>
        </div>
      </div>

      {/* MOM Energy Card */}
      {profile ? (
        <Link
          href="/profile"
          className="mt-auto mb-4 rounded-2xl border border-border/80 bg-gradient-to-br from-blue-50 via-background to-indigo-50 p-3.5 transition-colors hover:border-blue-400 dark:from-blue-950/20 dark:to-indigo-950/20"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              {t(dictionary.sidebar.myEnergy)}
            </p>
            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black text-white">
              {t(dictionary.sidebar.topUp)}
            </span>
          </div>
          <p className="mt-1.5 text-2xl font-black tabular-nums text-foreground">
            {Number(profile.mom_energy).toLocaleString()}
            <span className="ml-1 text-sm font-bold text-muted-foreground">MOM</span>
          </p>
          <div className="mt-2 flex gap-3 text-[10px]">
            <div>
              <p className="font-medium text-muted-foreground">{t(dictionary.sidebar.totalAssets)}</p>
              <p className="font-black tabular-nums text-foreground">
                ≒ ${(Number(profile.mom_energy) * momRate).toFixed(2)}
              </p>
            </div>
            <div className="border-l border-border pl-3">
              <p className="font-medium text-muted-foreground">{t(dictionary.sidebar.rate)}</p>
              <p className="font-black tabular-nums text-foreground">
                ${momRate.toFixed(4)}/MOM
              </p>
            </div>
          </div>
        </Link>
      ) : null}

      <div className="rounded-2xl border border-border/80 p-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
        <div className="flex items-center gap-3">
          <Link
            href={profile ? "/profile" : "/auth/login"}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 dark:from-zinc-200 dark:to-white text-xs font-bold text-white dark:text-zinc-950">
              {profile ? initial(profile.display_name ?? profile.handle ?? email) : <RiLoginBoxLine className="size-4" />}
            </div>
            <div className="hidden min-w-0 flex-1 xl:block">
              <p className="truncate text-[13px] font-bold text-foreground">
                {profile?.display_name ?? profile?.handle ?? t(dictionary.actions.signIn)}
              </p>
              <p className="truncate text-[12px] text-muted-foreground">
                {profile
                  ? `@${profile.handle ?? "me"} · ${Number(profile.mom_energy).toLocaleString()} MOM`
                  : t(dictionary.profile.signedOutTitle)}
              </p>
            </div>
          </Link>
          {profile ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="hidden size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 xl:inline-flex"
              aria-label={t(dictionary.actions.signOut)}
            >
              <RiLogoutBoxRLine className="size-5" />
            </button>
          ) : (
            <RiMoreFill className="hidden size-5 shrink-0 text-muted-foreground xl:block" />
          )}
        </div>
      </div>
    </aside>
  );
}

function initial(value?: string | null) {
  return value?.trim().slice(0, 1).toUpperCase() || "m";
}
