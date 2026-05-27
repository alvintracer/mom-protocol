"use client";

import { useRouter } from "next/navigation";
import { RiArrowLeftLine, RiDownloadLine } from "react-icons/ri";

const PDF_URL =
  "https://xjbxslhbilveszgywurq.supabase.co/storage/v1/object/public/etc/momment_pitchdeck1.pdf";

export function AboutPageClient() {
  const router = useRouter();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* ── Floating controls ── */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="flex size-10 items-center justify-center rounded-full bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-md text-white transition-all hover:bg-zinc-800 hover:scale-105 active:scale-95"
          aria-label="Go back"
        >
          <RiArrowLeftLine className="size-5" />
        </button>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <a
          href={PDF_URL}
          download="momment_pitchdeck.pdf"
          className="flex items-center gap-2 rounded-full bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-md px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-zinc-800 hover:scale-105 active:scale-95"
        >
          <RiDownloadLine className="size-4" />
          PDF
        </a>
      </div>

      {/* ── Pitch Deck ── */}
      <iframe
        src="/pitchdeck.html"
        className="h-full w-full border-0"
        title="momment. Pitch Deck"
      />
    </div>
  );
}
