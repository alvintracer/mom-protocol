"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { RiExternalLinkLine, RiArrowLeftLine, RiMessage2Line, RiHeart3Line, RiShareForwardLine } from "react-icons/ri";

import { EvidenceCard } from "@/shared/components/cards/EvidenceCard";
import { creators, events, evidence, predictions } from "@/shared/data/mock";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { eventCategoryLabels } from "@/shared/types/domain";

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const event = events.find((item) => item.id === eventId);
  const { dictionary, t } = useI18n();

  if (!event) {
    notFound();
  }

  const eventPredictions = predictions.filter(
    (prediction) => prediction.eventId === event.id,
  );
  const eventEvidence = evidence.filter((item) => item.eventId === event.id);

  return (
    <div className="bg-background min-h-screen pb-20">
      {/* Header Bar */}
      <header className="sticky top-0 z-20 flex h-[53px] items-center gap-6 bg-background/80 px-4 backdrop-blur border-b border-border">
        <Link href="/" className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <RiArrowLeftLine className="size-5 text-foreground" />
        </Link>
        <h2 className="text-xl font-black text-foreground tracking-tight">
          {t(dictionary.pages.eventDetail)}
        </h2>
      </header>

      {/* Main Content */}
      <article className="px-4 py-6 md:px-6 md:py-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <span className="rounded bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5">PW</span>
          <span className="text-[14px] font-semibold text-muted-foreground">
            Polywave · {t(eventCategoryLabels[event.category])}
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-black leading-tight text-foreground tracking-tight">
          {t(event.title)}
        </h1>

        <p className="mt-4 text-[16px] md:text-[18px] leading-relaxed text-foreground opacity-90">
          {t(event.summary)}
        </p>

        {/* External Reference Signal Widget (Mock) */}
        <div className="mt-8 rounded-2xl border border-border p-5 bg-zinc-50 dark:bg-zinc-900/30">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-muted-foreground">
              {t(dictionary.pages.opinionVote)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t(dictionary.pages.referenceSignalBased)}
            </span>
          </div>
          
          <div className="flex gap-3">
            <button className="flex-1 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-black py-4 transition-colors flex flex-col items-center gap-1">
              <span className="text-lg">YES</span>
              <span className="text-xs opacity-80">66¢</span>
            </button>
            <button className="flex-1 rounded-xl bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-400 font-black py-4 transition-colors flex flex-col items-center gap-1">
              <span className="text-lg">NO</span>
              <span className="text-xs opacity-80">34¢</span>
            </button>
          </div>

          <div className="mt-5 pt-5 border-t border-border/50 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground font-semibold mb-1">
                {t(dictionary.pages.totalReferenceVolume)}
              </p>
              <p className="text-lg font-black text-foreground">$12.4M</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold mb-1">
                {t(dictionary.pages.connectedPlatforms)}
              </p>
              <p className="text-lg font-black text-foreground">3</p>
            </div>
          </div>
          
          <div className="mt-5 pt-5 border-t border-border/50 flex justify-center">
            <a href="#" className="inline-flex items-center gap-2 text-sm font-bold text-blue-500 hover:text-blue-600 hover:underline">
              <span>{t(dictionary.pages.externalReferenceLink)}</span>
              <RiExternalLinkLine className="size-4" />
            </a>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 py-4 border-y border-border flex items-center justify-around text-muted-foreground">
          <button className="flex items-center gap-2 hover:text-blue-500 transition-colors">
            <RiMessage2Line className="size-5" />
            <span className="text-sm font-medium">{event.predictionCount}</span>
          </button>
          <button className="flex items-center gap-2 hover:text-pink-500 transition-colors">
            <RiHeart3Line className="size-5" />
            <span className="text-sm font-medium">{event.attentionScore}</span>
          </button>
          <button className="flex items-center gap-2 hover:text-blue-500 transition-colors">
            <RiShareForwardLine className="size-5" />
          </button>
        </div>

        {/* Stacked Layout Sections */}
        <div className="mt-8 space-y-12">
          {/* Creators Section */}
          <section>
            <h3 className="text-xl font-black text-foreground mb-6">
              {t(dictionary.pages.creatorPredictions)}
            </h3>
            <div className="space-y-4">
              {eventPredictions.map((prediction) => {
                const creator = creators.find(
                  (item) => item.handle === prediction.creatorHandle,
                );

                return (
                  <article
                    key={prediction.id}
                    className="rounded-2xl border border-border p-5 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-zinc-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {creator?.avatarInitials || prediction.creatorHandle[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-foreground">
                            {creator ? t(creator.name) : prediction.creatorHandle}
                          </p>
                          <p className="text-[13px] text-muted-foreground">
                            @{prediction.creatorHandle}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-500/10 text-[13px] font-bold text-blue-600 dark:text-blue-400">
                          신뢰도 {prediction.confidence}%
                        </span>
                      </div>
                    </div>
                    <h4 className="text-[16px] font-bold text-foreground mb-2">
                      {t(prediction.label)}
                    </h4>
                    <p className="text-[15px] leading-relaxed text-muted-foreground">
                      {t(prediction.rationale)}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Evidence Section */}
          <section>
            <h3 className="text-xl font-black text-foreground mb-6">
              {t(dictionary.pages.verifiedEvidence)}
            </h3>
            <div className="space-y-4">
              {eventEvidence.map((item) => (
                <EvidenceCard key={item.id} evidence={item} />
              ))}
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
