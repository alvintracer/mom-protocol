"use client";

import Link from "next/link";
import { 
  RiMessage2Line, 
  RiRepeat2Line, 
  RiHeart3Line, 
  RiBarChartGroupedLine, 
  RiShareForwardLine 
} from "react-icons/ri";

import type { Event } from "@/shared/types/domain";
import { eventCategoryLabels } from "@/shared/types/domain";
import { useI18n } from "@/shared/i18n/LanguageProvider";

export function EventCard({ event }: { event: Event }) {
  const { dictionary, t } = useI18n();

  // Mocking creator info since Event type might not have full creator data in this sprint
  const mockCreator = {
    name: t(dictionary.home.mockCreatorName),
    handle: "quantkim",
    avatarInitial: t(dictionary.home.mockCreatorName).slice(0, 1),
    timeAgo: t(dictionary.home.mockTimeAgo),
  };

  return (
    <article className="border-b border-border bg-background p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer">
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
          {mockCreator.avatarInitial}
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[15px]">
              <span className="font-bold text-foreground hover:underline">
                {mockCreator.name}
              </span>
              <span className="text-muted-foreground">@{mockCreator.handle}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground hover:underline">
                {mockCreator.timeAgo}
              </span>
            </div>
            <button className="text-muted-foreground hover:text-blue-500 rounded-full p-1.5 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
              <span className="sr-only">{t(dictionary.common.more)}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current"><g><path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"></path></g></svg>
            </button>
          </div>

          <Link href={`/events/${event.id}`} className="block mt-1">
            <div className="rounded-2xl border border-border mt-2 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5">PW</span>
                <span className="text-[13px] text-muted-foreground">
                  {t(dictionary.feedCard.referencePlatform)} ·{" "}
                  {t(eventCategoryLabels[event.category])}
                </span>
              </div>
              <h3 className="text-[15px] font-bold text-foreground">
                {t(event.title)}
              </h3>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3 text-[13px]">
                  <div className="flex items-center gap-1">
                    <span className="rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold px-1.5 py-0.5">
                      {t(dictionary.common.yes)}
                    </span>
                    <span className="text-muted-foreground">
                      {t(dictionary.feedCard.referenceEntry)}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {t(dictionary.feedCard.currentSignal)}
                  </span>
                  <span className="text-muted-foreground">
                    {t(dictionary.feedCard.sourceSize)}
                  </span>
                </div>
                <div className="text-[14px] font-bold text-emerald-600 dark:text-emerald-400">
                  +$120 (+7.6%)
                </div>
              </div>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground">
              {t(event.summary)}
            </p>
          </Link>

          <div className="mt-3 flex items-center justify-between max-w-md text-muted-foreground">
            <button className="flex items-center gap-2 group">
              <div className="p-2 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                <RiMessage2Line className="size-[18px]" />
              </div>
              <span className="text-[13px] group-hover:text-blue-500">34</span>
            </button>
            <button className="flex items-center gap-2 group">
              <div className="p-2 rounded-full group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-colors">
                <RiRepeat2Line className="size-[18px]" />
              </div>
              <span className="text-[13px] group-hover:text-emerald-500">12</span>
            </button>
            <button className="flex items-center gap-2 group">
              <div className="p-2 rounded-full group-hover:bg-pink-500/10 group-hover:text-pink-500 transition-colors">
                <RiHeart3Line className="size-[18px]" />
              </div>
              <span className="text-[13px] group-hover:text-pink-500">187</span>
            </button>
            <button className="flex items-center gap-2 group">
              <div className="p-2 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                <RiBarChartGroupedLine className="size-[18px]" />
              </div>
              <span className="text-[13px] group-hover:text-blue-500">14K</span>
            </button>
            <button className="flex items-center gap-2 group">
              <div className="p-2 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                <RiShareForwardLine className="size-[18px]" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
