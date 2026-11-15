import { applyRouteHead, type RouteHead, publicOrigin } from "../../app/route-head";
import type { MapSkill } from "./model";

/** Catalog text is shared by public and family maps; indexing is not. */
export function applyPathwaysMetadata(doc: Document, pathname: string, skill?: Pick<MapSkill, "id" | "title" | "description">, unknownSkill = false) {
  const publicMap = /^\/pathways(?:\/[^/]+)?\/?$/.test(pathname);
  const canonical = publicMap && !unknownSkill
    ? new URL(skill ? `/pathways/${encodeURIComponent(skill.id)}` : "/pathways", publicOrigin).href : null;
  const currentCanonical = doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  const image = canonical && currentCanonical === canonical
    ? doc.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? null : null;
  // Adopt the prerendered tags into the route head writer's ownership. Nothing
  // restores an earlier robots value after navigation to a private screen.
  doc.querySelectorAll("[data-pathways-static]").forEach(tag => tag.removeAttribute("data-pathways-static"));
  const head: RouteHead = {
    title: skill ? `${skill.title} | AMP Pathways` : "Explore Math Skills | AMP Pathways",
    description: skill
      ? `${skill.description.trim().replace(/[.!?]+$/, "")}. Explore this skill and its connections in AMP's free math map.`
      : "Explore connected math skills from kindergarten through precalculus. Browse lessons and see how each skill builds on another.",
    canonical, robots: publicMap && !unknownSkill ? null : "noindex, follow", image,
  };
  applyRouteHead(doc, head);
}
