"use client";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { RiDownloadLine, RiArrowLeftLine } from "react-icons/ri";
import Link from "next/link";

const PDF_URL =
  "https://xjbxslhbilveszgywurq.supabase.co/storage/v1/object/public/etc/momment_pitchdeck.pdf";

export function AboutPageClient() {
  const { dictionary, t } = useI18n();

  return (
    <div className="flex-1 min-w-0 flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* ── Header Bar ── */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <RiArrowLeftLine className="size-4 text-foreground" />
          </Link>
          <div>
            <h1 className="text-lg font-black text-foreground">
              {t(dictionary.sidebar.aboutMomment ?? { ko: "About momment.", en: "About momment.", es: "About momment." })}
            </h1>
            <p className="text-[12px] font-medium text-muted-foreground">Pitch Deck</p>
          </div>
        </div>
        <a
          href={PDF_URL}
          download="momment_pitchdeck.pdf"
          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-[13px] font-bold text-white transition-all hover:bg-blue-700 active:scale-95"
        >
          <RiDownloadLine className="size-4" />
          {t(dictionary.sidebar.downloadPdf ?? { ko: "PDF 다운로드", en: "Download PDF", es: "Descargar PDF" })}
        </a>
      </div>

      {/* ── Embedded Pitch Deck ── */}
      <iframe
        src="/pitchdeck.html"
        className="flex-1 w-full border-0 bg-black"
        title="momment. Pitch Deck"
        style={{ minHeight: 0 }}
      />
    </div>
  );
}
