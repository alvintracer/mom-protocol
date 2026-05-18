"use client";

import Link from "next/link";
import { 
  RiHome7Fill, 
  RiBarChartGroupedFill, 
  RiSafe2Line,
  RiShieldCheckLine,
  RiUser3Line
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";

export function MobileNav() {
  const { dictionary, t } = useI18n();
  const navItems = [
    { href: "/", label: t(dictionary.nav.home), icon: RiHome7Fill },
    { href: "/explore", label: t(dictionary.nav.explore), icon: RiBarChartGroupedFill },
    { href: "/oracle", label: t(dictionary.nav.oracle), icon: RiShieldCheckLine },
    { href: "/rewards", label: t(dictionary.nav.rewards), icon: RiSafe2Line },
    { href: "/profile", label: t(dictionary.nav.profile), icon: RiUser3Line },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-bold text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-foreground transition-colors"
            >
              <Icon className="size-6" />
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
