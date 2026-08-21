import type { MetadataRoute } from "next";

import { bookCatalog } from "@/lib/bookCatalog";
import { DYNAWALLA_GAMES } from "@/lib/dynawallaCatalog";

/**
 * The sitemap.
 *
 * Generated from the same catalogues the pages are generated from, so a book
 * or a game that exists has an entry by doing nothing. Writing this list by
 * hand would put it one rename behind the site, which is the failure the
 * Dynawalla data file already exists to avoid.
 *
 * `/corpan/` and its pack pages are NOT built by Next — `web/pages/build.js`
 * emits them into `out/` after this build — so the handful that are stable
 * entry points are listed literally. Anything under `/corpan/packs/` changes
 * with the pack registry and is deliberately left out rather than hard-coded
 * here where it would go stale silently.
 */
const ORIGIN = "https://encorpora.io";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages = ["", "/books/", "/corpan/", "/privacy/", "/terms/"].map(
    (path) => ({
      url: `${ORIGIN}${path || "/"}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.6,
    }),
  );

  const dynawalla = [
    {
      url: `${ORIGIN}/dynawalla/`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    ...DYNAWALLA_GAMES.map((game) => ({
      url: `${ORIGIN}/dynawalla/${game.slug}/`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  const books = bookCatalog.series.flatMap((series) => [
    {
      url: `${ORIGIN}/books/${series.slug}/`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    ...series.books.map((book) => ({
      url: `${ORIGIN}/books/${series.slug}/${book.slug}/`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ]);

  return [...staticPages, ...dynawalla, ...books];
}
