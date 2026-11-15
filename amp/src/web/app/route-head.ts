import { indexableDocumentPath } from "./document-routes";
import {
  appPageTitle,
  pitchProgramId,
  programNames,
  splitLocation,
  type HomeScreen,
} from "../../analytics/page-titles";

/** Canonical and share URLs always name production, never a preview host. */
export const publicOrigin = "https://amp.corpora.inc";

/** What a search result or link preview says about AMP. `index.html` carries
 * the plain pitch's values statically, so `/` paints with them. */
export function pitchDescription(programName?: string) {
  return `A complete math curriculum${programName ? ` for ${programName} families` : ""}, from counting to precalculus. AMP finds your child’s level and chooses each next problem, with lessons and printable workbooks built in.`;
}

/** What a search result says about the school pages, which aren't for parents. */
const schoolDescriptions: Readonly<Record<string, string>> = {
  "/schools":
    "A complete math curriculum for your school, from counting to precalculus: unlimited problems and personalized workbooks, a suggested grade range with its evidence, and sign-in with no email.",
  "/schools/scope-and-sequence":
    "AMP’s scope and sequence: every objective from Kindergarten through Precalculus, with its standards and prerequisites. Read it online or download the PDF or CSV.",
  "/schools/trust":
    "How AMP handles student data: what’s collected, what isn’t, who signs in, retention, export and deletion, and the student data agreement as schools accept it.",
};

export type RouteHead = {
  title: string;
  description: string;
  /** Public routes only: the path alone, without campaign, click or program labels. */
  canonical: string | null;
  robots: "noindex, follow" | null;
  image?: string | null;
};

/** App titles share GA's fixed labels; indexing uses a separate public-document policy.
 * Undefined for the public skill map, whose screens set their own. */
export function routeHead(
  location: string,
  home: HomeScreen,
): RouteHead | undefined {
  const title = appPageTitle(location, home);
  if (!title) return;
  const { path, search } = splitLocation(location);
  const program =
    path === "/" && home === "pitch"
      ? pitchProgramId(search.get("program"))
      : undefined;
  return {
    title,
    description:
      schoolDescriptions[path] ??
      pitchDescription(program && programNames[program]),
    canonical: indexableDocumentPath(path) && !(path === "/" && home !== "pitch")
      ? new URL(path, publicOrigin).href : null,
    robots: indexableDocumentPath(path) && !(path === "/" && home !== "pitch") ? null : "noindex, follow",
  };
}

// Skill-map pages are prerendered with their own tags; this never edits those.
const own = ":not([data-pathways-static])";

function meta(doc: Document, attribute: "name" | "property", key: string) {
  let element = doc.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]${own}`,
  );
  if (!element) {
    element = doc.createElement("meta");
    element.setAttribute(attribute, key);
    doc.head.append(element);
  }
  return element;
}

/** Write a route's head. Only `<head>` changes, so nothing on screen moves. */
export function applyRouteHead(doc: Document, head: RouteHead) {
  doc.title = head.title;
  meta(doc, "name", "description").content = head.description;
  if (head.robots) meta(doc, "name", "robots").content = head.robots;
  else doc.querySelectorAll(`meta[name="robots"]${own}`).forEach(tag => tag.remove());
  if (head.image !== undefined || doc.querySelector("[data-pathways-current-image]")) {
    for (const [attribute, key] of [["property", "og:image"], ["name", "twitter:image"]] as const) {
      if (head.image) {
        const tag = meta(doc, attribute, key); tag.content = head.image;
        tag.setAttribute("data-pathways-current-image", "");
      } else doc.querySelectorAll(`meta[${attribute}="${key}"]`).forEach(tag => tag.remove());
    }
    if (!head.image) doc.querySelectorAll('meta[property="og:image:width"],meta[property="og:image:height"]').forEach(tag => tag.remove());
  }
  let canonical = doc.head.querySelector<HTMLLinkElement>(
    `link[rel="canonical"]${own}`,
  );
  if (head.canonical) {
    if (!canonical) {
      canonical = doc.createElement("link");
      canonical.rel = "canonical";
      doc.head.append(canonical);
    }
    canonical.href = head.canonical;
  } else canonical?.remove();
  for (const [attribute, key, content] of [
    ["property", "og:title", head.title],
    ["property", "og:description", head.description],
    ["property", "og:url", head.canonical ?? `${publicOrigin}/`],
    ["name", "twitter:title", head.title],
    ["name", "twitter:description", head.description],
  ] as const)
    meta(doc, attribute, key).content = content;
}
