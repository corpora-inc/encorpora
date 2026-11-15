import { VideoPage } from "./video-page.js";
import React from "../react.js";
import type { SiteConfig } from "../config.js";
import type { Resource } from "./catalog.js";
import { HubPage } from "./hub-page.js";
import { GradePage } from "./grade-page.js";
import { WorkbookPage } from "./workbook-page.js";
import { LessonPage } from "./lesson-page.js";
import { ComparisonPage } from "./comparison-page.js";

export function ResourcePage({
  page,
  config,
}: {
  page: Resource;
  config: SiteConfig;
}) {
  switch (page.kind) {
    case "video":
      return <VideoPage page={page} config={config} />;
    case "hub":
      return <HubPage page={page} config={config} />;
    case "grade":
      return <GradePage page={page} config={config} />;
    case "workbook":
      return <WorkbookPage page={page} config={config} />;
    case "lesson":
      return <LessonPage page={page} config={config} />;
    case "comparison":
      return <ComparisonPage page={page} config={config} />;
  }
}

export function resourceStructuredData(page: Resource, config: SiteConfig) {
  if (!config.siteUrl) return undefined;
  const url = new URL(page.path, config.siteUrl).href;
  const base = {
    "@id": `${url}#resource`,
    url,
    name: page.label,
    headline: page.title,
    description: page.description,
    inLanguage: "en",
    publisher: { "@id": new URL("/#organization", config.siteUrl).href },
    mainEntityOfPage: url,
  };
  const detail =
    page.kind === "video"
      ? {
          "@type": "VideoObject",
          name: page.video.title,
          description: page.description,
          thumbnailUrl: page.video.posterUrl,
          contentUrl: page.video.videoUrl,
          uploadDate: page.video.uploadDate,
          duration: `PT${Math.round(page.video.durationSeconds)}S`,
          transcript: page.video.transcript,
          caption: page.video.captionsUrl,
          educationalLevel: page.level.label,
          learningResourceType: "Video lesson",
        }
      : page.kind === "lesson"
        ? {
            "@type": "LearningResource",
            learningResourceType: "Written lesson",
            educationalLevel: page.level.label,
            teaches: page.lesson.objectives,
          }
        : page.kind === "workbook"
          ? {
              "@type": "LearningResource",
              learningResourceType: "Worksheet",
              educationalLevel: page.level.label,
              datePublished: page.workbook.date,
              encoding: page.workbook.files.map((file) => ({
                "@type": "MediaObject",
                contentUrl: new URL(file.url, config.siteUrl).href,
                encodingFormat: "application/pdf",
                name: `${page.level.label} workbook · ${file.paper === "a4" ? "A4" : "US Letter"}`,
              })),
            }
          : page.kind === "hub"
            ? { "@type": "CollectionPage" }
            : page.kind === "comparison"
              ? {
                  "@type": "Article",
                  citation: page.comparison.officialSources.map((s) => s.url),
                }
              : { "@type": "WebPage" };
  return {
    "@context": "https://schema.org",
    "@graph": [
      { ...base, ...detail },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: config.siteUrl,
          },
          { "@type": "ListItem", position: 2, name: page.label, item: url },
        ],
      },
    ],
  };
}
