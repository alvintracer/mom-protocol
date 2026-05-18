"use client";

import { useI18n } from "@/shared/i18n/LanguageProvider";

export function SponsoredCampaignCard() {
  const { dictionary, t } = useI18n();

  return (
    <article className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
          {t(dictionary.sponsored.label)}
        </span>
        <span className="text-xs font-semibold text-zinc-500">
          {t(dictionary.sponsored.disclosure)}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-black text-zinc-950">
        {t(dictionary.sponsored.title)}
      </h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        {t(dictionary.sponsored.body)}
      </p>
      <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-800">
        {t(dictionary.sponsored.footer)}
      </div>
    </article>
  );
}
