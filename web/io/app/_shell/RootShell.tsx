// Shared <html>/<body> for the site's two root layouts.
//
// The site has two root layouts on purpose: `(site)/layout.tsx` adds the
// Google Ads tag, `aha/layout.tsx` does not. ¡AHA! pages are opened from inside
// a math app used by children, and its privacy policy promises no ads and no
// analytics, so no third-party script may load under /aha/. Separate root
// layouts also make Next.js do a full page load when navigating between the
// two, so a tag loaded elsewhere on the site is never carried into /aha/.
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import Footer from "@/components/Footer";
import { withBasePath } from "@/lib/basePath";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const baseMetadata: Metadata = {
  title: "Encorpora — Pure Learning",
  description:
    "Focused books and apps. No ads, no trackers, no wasted time. Offline-first learning tools by Corpora Inc.",
  openGraph: {
    title: "Encorpora — Pure Learning",
    description:
      "Focused books and apps. No ads, no trackers, no wasted time. Offline-first learning tools by Corpora Inc.",
    // 1200x630 large-image card. Source: public/og-card.svg, rendered with
    // resvg and KaTeX_SansSerif (see amp/node_modules/katex/dist/fonts).
    images: [
      {
        url: "https://encorpora.io/og-card.png",
        type: "image/png",
        width: 1200,
        height: 630,
        alt: "Encorpora. Pure Learning: focused books and apps.",
      },
    ],
  },
  // Card type only: X falls back to each page's own og:title/og:image, so
  // child pages that set openGraph never inherit the home page's text.
  twitter: { card: "summary_large_image" },
  icons: {
    icon: withBasePath("/favicon.ico"),
  },
};

export default function RootShell({
  head,
  children,
}: {
  head?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>{head}</head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Footer />
      </body>
    </html>
  );
}
