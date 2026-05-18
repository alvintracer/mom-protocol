"use client";

import { use } from "react";
import { notFound } from "next/navigation";

import { ContributionBreakdownCard } from "@/shared/components/cards/ContributionBreakdownCard";
import { EventCard } from "@/shared/components/cards/EventCard";
import {
  contributionBreakdown,
  creators,
  events,
  predictions,
} from "@/shared/data/mock";
import { useI18n } from "@/shared/i18n/LanguageProvider";

export default function CreatorDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const creator = creators.find((item) => item.handle === handle);
  const { dictionary, t } = useI18n();

  if (!creator) {
    notFound();
  }

  const creatorPredictions = predictions.filter(
    (prediction) => prediction.creatorHandle === creator.handle,
  );
  const creatorEvents = events.filter((event) =>
    creatorPredictions.some((prediction) => prediction.eventId === event.id),
  );
  const breakdown = contributionBreakdown.find(
    (item) => item.creatorHandle === creator.handle,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <div className="flex size-16 items-center justify-center rounded-lg bg-zinc-950 text-lg font-black text-white">
            {creator.avatarInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-blue-700">@{creator.handle}</p>
            <h1 className="mt-1 text-3xl font-black text-zinc-950">
              {t(creator.name)}
            </h1>
            <p className="mt-1 text-sm font-semibold text-zinc-600">
              {t(creator.specialty)}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-600">
              {t(creator.bio)}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <Stat label={t(dictionary.common.trustScore)} value={creator.trustScore} />
          <Stat label="MOM" value={creator.momEnergy.toLocaleString("ko-KR")} />
          <Stat
            label={t(dictionary.common.subscriberCount)}
            value={creator.subscriberCount.toLocaleString("ko-KR")}
          />
          <Stat label="Contribution Ratio" value={`${creator.contributionRatio}%`} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <h2 className="text-xl font-black text-zinc-950">
            {t(dictionary.pages.creatorEvents)}
          </h2>
          {creatorEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
        {breakdown ? (
          <ContributionBreakdownCard breakdown={breakdown} creator={creator} />
        ) : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-4">
      <p className="text-xs font-bold text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-black text-zinc-950">{value}</p>
    </div>
  );
}
