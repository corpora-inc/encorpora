import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";

// Load your fonts (adjust or remove if not using Geist)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Update metadata to reflect the purpose of your textbooks
export const metadata: Metadata = {
  title: "Encorpora – Structured, No-Frills Textbooks",
  description:
    "Encorpora offers concise, systematic textbooks designed to help students fully grasp essential concepts—from early math standards to advanced CLEP exam prep. Each lesson is laser-focused, delivering exactly what learners need to master the material.",
  openGraph: {
    title: "Encorpora - Structured, No-Frills Textbooks and Apps",
    description:
      "We craft direct, distraction-free learning resources that ensure mastery of key topics. Our approach meets or exceeds grade-level expectations and prepares students thoroughly for college-level exams.",
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
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Footer />
      </body>
    </html>
  );
}
