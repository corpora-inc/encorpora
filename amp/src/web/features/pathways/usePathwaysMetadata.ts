import { useEffect, useRef } from "react";
import type { MapSkill } from "./model";

/** Public map metadata is derived only from the catalog, never visitor state. */
const publicOrigin = "https://amp.corpora.inc";

export function usePathwaysMetadata(skill?: MapSkill, unknownSkill = false) {
  const original = useRef<{
    robots: HTMLMetaElement | null;
    robotsContent: string | null;
  } | null>(null);

  useEffect(() => {
    const robots = document.querySelector<HTMLMetaElement>(
      'meta[name="robots"]',
    );
    original.current = {
      robots,
      robotsContent: robots?.getAttribute("content") ?? null,
    };
    return () => {
      const saved = original.current;
      if (!saved) return;
      // The router writes the next route's title, description, canonical and
      // social text (src/web/app/route-head.ts), possibly before this cleanup
      // runs while the next screen loads. Undo only what belongs to the map:
      // prerendered skill-page tags and the unknown-skill robots rule.
      document
        .querySelectorAll("[data-pathways-static]")
        .forEach((tag) => tag.remove());
      const currentRobots = document.querySelector<HTMLMetaElement>(
        'meta[name="robots"]',
      );
      if (saved.robots) {
        if (saved.robotsContent === null)
          saved.robots.removeAttribute("content");
        else saved.robots.content = saved.robotsContent;
      } else currentRobots?.remove();
      original.current = null;
    };
  }, []);

  useEffect(() => {
    document.title = skill
      ? `${skill.title} | AMP Pathways`
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
    // Prerendered skill pages carry their own tags; the app shell carries the
    // router's. Keep whichever are present in step with this screen.
    for (const [property, content] of social)
      document
        .querySelectorAll<HTMLMetaElement>(`meta[property="${property}"]`)
        .forEach((tag) => tag.setAttribute("content", content));
    for (const [name, content] of [
      ["twitter:title", document.title],
      ["twitter:description", description.content],
    ] as const)
      document
        .querySelectorAll<HTMLMetaElement>(`meta[name="${name}"]`)
        .forEach((tag) => tag.setAttribute("content", content));
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
