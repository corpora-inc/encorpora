import { useEffect, useRef } from "react";
import type { MapSkill } from "./model";
import { bandLabel } from "./model";

/** Public map metadata is derived only from the catalog, never visitor state. */
const publicOrigin = "https://amp.corpora.inc";
const defaultTitle = "AMP · Adaptive Math Pathways";
const defaultDescription =
  "Adaptive math practice. AMP finds each learner's level and moves them forward, with a hint and a lesson for every problem type and printable worksheets with solutions.";

export function usePathwaysMetadata(skill?: MapSkill, unknownSkill = false) {
  const original = useRef<{
    title: string;
    description: HTMLMetaElement | null;
    descriptionContent: string | null;
    canonical: HTMLLinkElement | null;
    canonicalHref: string | null;
    robots: HTMLMetaElement | null;
    robotsContent: string | null;
  } | null>(null);

  useEffect(() => {
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    const staticPathwaysPage = canonical?.hasAttribute("data-pathways-static");
    const staticSocialTags = document.querySelectorAll<HTMLMetaElement>(
      "meta[data-pathways-static]",
    );
    const robots = document.querySelector<HTMLMetaElement>(
      'meta[name="robots"]',
    );
    original.current = {
      title: staticPathwaysPage ? defaultTitle : document.title,
      description,
      descriptionContent: staticPathwaysPage
        ? defaultDescription
        : (description?.getAttribute("content") ?? null),
      canonical: staticPathwaysPage ? null : canonical,
      canonicalHref: staticPathwaysPage
        ? null
        : (canonical?.getAttribute("href") ?? null),
      robots,
      robotsContent: robots?.getAttribute("content") ?? null,
    };
    return () => {
      const saved = original.current;
      if (!saved) return;
      document.title = saved.title;
      const currentDescription = document.querySelector<HTMLMetaElement>(
        'meta[name="description"]',
      );
      if (saved.description) {
        if (saved.descriptionContent === null)
          saved.description.removeAttribute("content");
        else saved.description.content = saved.descriptionContent;
      } else currentDescription?.remove();
      const currentCanonical = document.querySelector<HTMLLinkElement>(
        'link[rel="canonical"]',
      );
      if (saved.canonical) {
        if (saved.canonicalHref === null)
          saved.canonical.removeAttribute("href");
        else saved.canonical.href = saved.canonicalHref;
      } else currentCanonical?.remove();
      const currentRobots = document.querySelector<HTMLMetaElement>(
        'meta[name="robots"]',
      );
      if (saved.robots) {
        if (saved.robotsContent === null)
          saved.robots.removeAttribute("content");
        else saved.robots.content = saved.robotsContent;
      } else currentRobots?.remove();
      staticSocialTags.forEach((tag) => tag.remove());
      original.current = null;
    };
  }, []);

  useEffect(() => {
    document.title = skill
      ? `${skill.title} · ${bandLabel(skill.gradeBand)} | AMP Pathways`
      : "Explore Math Skills | AMP Pathways";
    let description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.append(description);
    }
    description.content = skill
      ? `${skill.description.trim().replace(/[.!?]+$/, "")}. Explore this skill and its connections in AMP's free math map.`
      : "Explore connected math skills from kindergarten through precalculus. Browse lessons and see how each skill builds on another.";
    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = new URL(
      skill ? `/pathways/${encodeURIComponent(skill.id)}` : "/pathways",
      publicOrigin,
    ).href;
    const social = [
      ["og:title", document.title],
      ["og:description", description.content],
      ["og:url", canonical.href],
    ] as const;
    for (const [property, content] of social)
      document
        .querySelector<HTMLMetaElement>(
          `meta[property="${property}"][data-pathways-static]`,
        )
        ?.setAttribute("content", content);
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (unknownSkill) {
      if (!robots) {
        robots = document.createElement("meta");
        robots.name = "robots";
        document.head.append(robots);
      }
      robots.content = "noindex";
    } else if (robots) {
      const saved = original.current;
      if (!saved?.robots) robots.remove();
      else if (saved.robotsContent === null) robots.removeAttribute("content");
      else robots.content = saved.robotsContent;
    }
  }, [skill, unknownSkill]);
}
