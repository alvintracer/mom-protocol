"use client";

import { RiExternalLinkLine, RiShieldCheckLine } from "react-icons/ri";

import type { Evidence } from "@/shared/types/domain";
import { useI18n } from "@/shared/i18n/LanguageProvider";

export function EvidenceCard({ evidence }: { evidence: Evidence }) {
  const { dictionary, t } = useI18n();

  return (
    <article className="rounded-2xl border border-border bg-background hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors p-4 cursor-pointer">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-bold text-blue-500">
            {t(evidence.sourceName)}
          </p>
          <h3 className="mt-1 text-[15px] font-bold text-foreground">
            {t(evidence.title)}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
          <RiShieldCheckLine className="size-3.5" />
          {evidence.verificationScore}
        </div>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-foreground">
        {t(evidence.summary)}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span>
          {t(dictionary.common.submittedBy)} <span className="hover:underline">@{evidence.submittedByHandle}</span>
        </span>
        <a
          href={evidence.url}
          className="inline-flex items-center gap-1 font-bold text-blue-500 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {t(dictionary.common.source)}
          <RiExternalLinkLine className="size-3.5" />
        </a>
      </div>
    </article>
  );
}
