"use client";

import { EventCard } from "@/shared/components/cards/EventCard";
import { SponsoredCampaignCard } from "@/shared/components/cards/SponsoredCampaignCard";
import { events } from "@/shared/data/mock";
import { useI18n } from "@/shared/i18n/LanguageProvider";

export default function EventsPage() {
  const { dictionary, t } = useI18n();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-blue-700">Events</p>
        <h1 className="mt-1 text-3xl font-black text-zinc-950">
          {t(dictionary.pages.eventsTitle)}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
          {t(dictionary.pages.eventsDesc)}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </section>
        <SponsoredCampaignCard />
      </div>
    </div>
  );
}
