"use client";

import Link from "next/link";
import { 
  RiHome7Fill, 
  RiBarChartGroupedFill, 
  RiSearchLine,
  RiNotification4Line,
  RiUser3Line
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { useUnreadNotificationCount } from "@/shared/hooks/useUnreadNotificationCount";

export function MobileNav() {
  const { dictionary, t } = useI18n();
  const unreadCount = useUnreadNotificationCount();

  const navItems = [
    { href: "/", label: t(dictionary.nav.home), icon: RiHome7Fill },
    { href: "/explore", label: t(dictionary.nav.explore), icon: RiBarChartGroupedFill },
    { href: "/search", label: t(dictionary.search.title), icon: RiSearchLine },
    { href: "/notifications", label: t(dictionary.nav.notifications), icon: RiNotification4Line },
    { href: "/profile", label: t(dictionary.nav.profile), icon: RiUser3Line },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const showBadge = item.href === "/notifications" && unreadCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-bold text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-foreground transition-colors"
            >
              <span className="relative">
                <Icon className="size-6" />
                {showBadge && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-black text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </span>
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
