import { JSX } from "react";
import { FaAppStore, FaGooglePlay } from "react-icons/fa";

interface App {
  id: string;
  title: string;
  description: string;
  icon: string;
  platforms: {
    name: string;
    link: string;
    icon?: JSX.Element; // Allow for custom icons or text
  }[];
}
export const APPS_INFO: App[] = [
  {
    id: "1",
    title: "Corpán",
    description:
      "Learn 17 languages from any language - fully localized, practical sentences, instant audio, and easy switching. Real-world phrases. No ads - just pure learning.",
    icon: "/logos/corpan-logo.webp",
    platforms: [
      {
        name: "iOS",
        link: "https://apps.apple.com/gb/app/corp%C3%A1n/id6746082061",
        icon: <FaAppStore />,
      },
      {
        name: "Android",
        link: "https://play.google.com/store/apps/details?id=com.corpora.corpan",
        icon: <FaGooglePlay />,
      },
    ],
  },
  {
    id: "2",
    title: "Yìjīng | I Ching Oracle",
    description:
      "Explore the I Ching in English & Español with original hexagrams, pinyin guidance, and private on-device reading history - your gateway to ancient wisdom!",
    icon: "/logos/iching-logo.webp",
    platforms: [
      {
        name: "iOS",
        link: "https://apps.apple.com/gb/app/y%C3%ACj%C4%ABng/id6744656859",
        icon: <FaAppStore />,
      },
      {
        name: "Android",
        link: "https://play.google.com/store/apps/details?id=com.corpora_yijing.app",
        icon: <FaGooglePlay />,
      },
    ],
  },
  {
    id: "3",
    title: "PaKO A1",
    description:
      "Build Hangeul & English skills with PaKO A1’s A1-level TTS flashcards. Instant offline pronunciation in both languages, distraction-free study, and 100% private.",
    icon: "/logos/pako-logo.webp",
    platforms: [
      {
        name: "iOS",
        link: "https://apps.apple.com/gb/app/pako-a1/id6745461113",
        icon: <FaAppStore />,
      },
      {
        name: "Android",
        link: "https://play.google.com/store/apps/details?id=com.pako.app",
        icon: <FaGooglePlay />,
      },
    ],
  },
];
