import { indexableDocumentPath } from "./document-index";
import shareCards from "./share-cards.json";
import {
  appPageTitle,
  pitchProgramId,
  programNames,
  publicAppPageTitles,
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

/** What a search result says about the school pages, which aren't for parents,
 * and the research page, which is for everyone. */
const schoolDescriptions: Readonly<Record<string, string>> = {
  "/schools":
    "A complete math curriculum for your school, from counting to precalculus: unlimited problems and personalized workbooks, a suggested grade range with its evidence, and sign-in with no email.",
  "/schools/scope-and-sequence":
    "AMP’s scope and sequence: every objective from Kindergarten through Precalculus, with its standards and prerequisites. Read it online or download the PDF or CSV.",
  "/schools/trust":
    "How AMP handles student data: what’s collected, what isn’t, who signs in, retention, export and deletion, and the student data agreement as schools accept it.",
  "/research":
    "The research behind AMP: each part of the program, the published evidence for it, and the studies that will measure AMP on a national test. Read AMP’s ESSA Tier 4 report online or as a PDF.",
  "/research/pilot":
    "Join the list for AMP’s pilot study: free AMP during the study, a normed math test if your child needs one, and a report on their growth. Enrollment opens once the study’s ethics review is complete.",
};

export type RouteHead = {
  title: string;
  description: string;
  /** Public routes only: the path alone, without campaign, click or program labels. */
  canonical: string | null;
  robots: "noindex, follow" | null;
  /** The share card, 1200×630, absolute. Undefined keeps the document's own
   * (the product card `index.html` carries) until a route writes a card;
   * from then on a route without one has none. Crawlers read the served
   * document, never a head the app rewrote. */
  image?: string | null;
  /** What the card shows, for a reader who can't see it. */
  imageAlt?: string;
};

/** Each public page's share card, by path: built and recorded by
 * scripts/build-share-cards.ts. `/` keeps the product card in `index.html`. */
const cards: Readonly<Record<string, { image: string; alt: string }>> =
  shareCards;

/** App titles share GA's fixed labels; indexing uses a separate public-document policy.
 * Undefined for the public skill map and the comparisons (`/versus`), whose
 * screens set their own. */
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
  const card = cards[path];
  return {
    title,
    description:
      schoolDescriptions[path] ??
      pitchDescription(program && programNames[program]),
    ...(card && {
      image: new URL(card.image, publicOrigin).href,
      imageAlt: card.alt,
    }),
    canonical: indexableDocumentPath(path) && !(path === "/" && home !== "pitch")
      ? new URL(path, publicOrigin).href : null,
    robots: indexableDocumentPath(path) && !(path === "/" && home !== "pitch") ? null : "noindex, follow",
  };
}

/** The skill map's index writes its own head when it mounts
 * (features/pathways/pathways-metadata.ts). Until then a document that isn't
 * its prerendered page (the old `/lessons` address, which lands on the map;
 * a development server) would wear another screen's title for a frame: this
 * is the map's, known before anything paints. */
export function mapTitleAhead(pathname: string): string | undefined {
  return /^\/(?:pathways|lessons)\/?$/.test(pathname)
    ? publicAppPageTitles["/pathways"]
    : undefined;
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
  // Once a route has written a card, a route without one shows none, never
  // the last page's.
  if (head.image !== undefined || doc.querySelector("[data-route-image]")) {
    const { image, imageAlt } = head;
    for (const [attribute, key, content] of [
      ["property", "og:image", image],
      ["name", "twitter:image", image],
      ["property", "og:image:width", image && "1200"],
      ["property", "og:image:height", image && "630"],
      ["property", "og:image:alt", image && imageAlt],
      ["name", "twitter:image:alt", image && imageAlt],
    ] as const) {
      if (content) {
        const tag = meta(doc, attribute, key); tag.content = content;
        tag.setAttribute("data-route-image", "");
      } else doc.querySelectorAll(`meta[${attribute}="${key}"]`).forEach(tag => tag.remove());
    }
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
