"use client";

import Link from "next/link";

import type { Creator } from "@/shared/types/domain";
import { useI18n } from "@/shared/i18n/LanguageProvider";

export function CreatorCard({ creator }: { creator: Creator }) {
  const { dictionary, t } = useI18n();

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-sm font-black text-white">
          {creator.avatarInitials}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/creators/${creator.handle}`}>
            <h3 className="text-lg font-black text-zinc-950 hover:text-blue-700">
              {t(creator.name)}
            </h3>
          </Link>
          <p className="text-sm font-semibold text-blue-700">@{creator.handle}</p>
          <p className="mt-1 text-sm text-zinc-500">{t(creator.specialty)}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-600">{t(creator.bio)}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        <Score
          label="MOM"
          value={creator.momEnergy.toLocaleString("ko-KR")}
        />
        <Score
          label={t(dictionary.common.contribution)}
          value={`${creator.contributionRatio}%`}
        />
      </div>
    </article>
  );
}

function Score({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-black text-zinc-950">{value}</p>
    </div>
  );
}
