import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import { withBasePath } from "@/lib/basePath";

// Load your fonts (adjust or remove if not using Geist)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const favicon = withBasePath("/favicon.ico");

export const metadata: Metadata = {
  title: "Encorpora — Pure Learning",
  description:
    "Focused books and apps. No ads, no trackers, no wasted time. Offline-first learning tools by Corpora Inc.",
  openGraph: {
    title: "Encorpora — Pure Learning",
    description:
      "Focused books and apps. No ads, no trackers, no wasted time. Offline-first learning tools by Corpora Inc.",
    images: [
      {
        url: "https://encorpora.io/logo-og.webp",
        width: 1200,
        height: 630,
        alt: "Encorpora Logo",
      },
    ],
  },
  icons: {
    icon: favicon,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17513523888"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17513523888');
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Footer />
      </body>
    </html>
  );
}
