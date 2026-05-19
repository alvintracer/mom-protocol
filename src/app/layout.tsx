import type { Metadata } from "next";
import Script from "next/script";
import { AppShell } from "@/shared/components/layout/AppShell";
import { ThemeProvider } from "@/shared/components/ThemeProvider";
import { LanguageProvider } from "@/shared/i18n/LanguageProvider";
import { publicUrl, siteName, defaultSeoDescription } from "@/shared/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${siteName} 놓칠 수 없는 순간`,
    template: `%s | ${siteName}`,
  },
  description: defaultSeoDescription,
  metadataBase: new URL(publicUrl("/")),
  openGraph: {
    siteName,
    type: "website",
    locale: "ko_KR",
    alternateLocale: ["en_US", "es_ES"],
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add Google Search Console and Naver Search Advisor verification codes here
    // google: "YOUR_GOOGLE_VERIFICATION_CODE",
    // other: { "naver-site-verification": "YOUR_NAVER_CODE" },
  },
};

// Organization JSON-LD for the entire site
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: publicUrl("/"),
  logo: publicUrl("/favicon.ico"),
  sameAs: [],
  description: defaultSeoDescription,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4647509027586331"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LanguageProvider>
            <AppShell>{children}</AppShell>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
