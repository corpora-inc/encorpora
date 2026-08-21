import type { MetadataRoute } from "next";

/**
 * robots.txt.
 *
 * There was none, so crawlers had no pointer to the sitemap. Everything here
 * is public marketing content; nothing is disallowed.
 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://encorpora.io/sitemap.xml",
  };
}
