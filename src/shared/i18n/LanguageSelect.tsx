"use client";

import { RiTranslate2 } from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { dictionary, language, languages, setLanguage, t } = useI18n();

  if (compact) {
    return (
      <label className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50">
        <RiTranslate2 className="size-5 shrink-0 text-muted-foreground" />
        <span className="sr-only">{t(dictionary.common.language)}</span>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as typeof language)}
          className="absolute size-10 cursor-pointer opacity-0"
          aria-label={t(dictionary.common.language)}
        >
          {languages.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-background hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors px-2 py-1.5 text-sm cursor-pointer">
      <RiTranslate2 className="size-4 shrink-0 text-muted-foreground" />
      <span className="sr-only">{t(dictionary.common.language)}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as typeof language)}
        className="max-w-28 bg-transparent text-xs font-bold text-foreground outline-none sm:max-w-none sm:text-sm cursor-pointer"
        aria-label={t(dictionary.common.language)}
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
