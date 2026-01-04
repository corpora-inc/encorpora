// app/components/AboutSection.tsx
'use client';

import { FC } from "react";

export const AboutSection: FC = () => (
  <section className="bg-gray-50 py-12 md:py-20">
    <div className="max-w-3xl mx-auto px-6 text-center">
      {/* subtle accent bar */}
      <div className="mx-auto mb-8 h-1 w-12 bg-gray-300 rounded" />

      <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-6">
        Learning, Minus the Noise.
      </h2>

      <p className="text-lg text-gray-700 leading-relaxed">
        We believe learning materials should be direct, efficient, and worthy of your attention.
        That&apos;s why every Corpora book and app is engineered to remove distractions - no ads, no trackers, no fluff - so you can focus and enjoy the process.
      </p>

      <p className="text-base text-gray-500 mt-5">
        Built for people who value their time. Designed for results.
      </p>
    </div>
  </section>
);
