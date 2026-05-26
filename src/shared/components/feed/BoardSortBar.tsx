"use client";

import { useI18n } from "@/shared/i18n/LanguageProvider";

export type BoardSortKey = "recommended" | "latest" | "popular" | "comments" | "energy";

type BoardSortBarProps = {
  value: BoardSortKey;
  onChange: (key: BoardSortKey) => void;
};

/**
 * BoardSortBar — Pill-style sort options for feed/board views.
 */
export function BoardSortBar({ value, onChange }: BoardSortBarProps) {
  const { dictionary, t } = useI18n();
  const d = dictionary.home;

  const options: { key: BoardSortKey; label: string }[] = [
    { key: "recommended", label: t(d.sortRecommended) },
    { key: "latest", label: t(d.sortLatest) },
    { key: "popular", label: t(d.sortPopular) },
    { key: "comments", label: t(d.sortComments) },
    { key: "energy", label: t(d.sortEnergy) },
  ];

  return (
    <div className="flex items-center gap-1 px-4 py-2 sm:px-5 border-b border-border overflow-x-auto no-scrollbar">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] sm:text-[12px] font-bold transition-all ${
            value === opt.key
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
