/** The comparison pages' head tags and the few strings built from a page:
 * one source for the app (which writes them on navigation), the static
 * documents and the structured data. */
import { publicAppPageTitles } from "../analytics/page-titles";
import { publicOrigin, type RouteHead } from "../web/app/route-head";
import {
  researchComponent,
  type ResearchComponentId,
} from "../research/report";
import { versusCategory } from "./amp";
import { versusPath } from "./catalog";
import { withoutCitations } from "./citations";
import type { VersusPage } from "./types";

/** A title a search result shows whole. */
const TITLE_LIMIT = 60;

/** "AMP vs i-Ready: Math Families Can Buy | AMP". When that runs past what a
 * search result shows, the name alone: "AMP vs i-Ready | AMP". */
export function versusPageTitle(
  page: Pick<VersusPage, "name" | "category" | "benefit">,
) {
  const benefit = page.benefit ?? versusCategory(page.category).benefit;
  const full = `AMP vs ${page.name}: ${benefit} | AMP`;
  return full.length <= TITLE_LIMIT ? full : `AMP vs ${page.name} | AMP`;
}

/** The hub's head. Its title is the one GA receives for `/versus`. */
export const versusHubHead: RouteHead = {
  title: publicAppPageTitles["/versus"]!,
  description:
    "How AMP compares with other math programs: what each one is, what it does well and where AMP differs, side by side and with sources.",
  canonical: new URL("/versus", publicOrigin).href,
  robots: null,
};

export function versusPageHead(page: VersusPage): RouteHead {
  return {
    title: versusPageTitle(page),
    description: page.description,
    canonical: new URL(versusPath(page.slug), publicOrigin).href,
    robots: null,
  };
}

/** "2026-11-21" as "November 2026". */
export function checkedLabel(checked: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${checked}T00:00:00Z`));
}

/** A reason's link to its research: "The research: Spaced, mixed review". */
export function researchLink(id: ResearchComponentId) {
  return {
    href: `/research#${id}`,
    label: `The research: ${researchComponent(id).title}`,
  };
}

const crumb = (position: number, name: string, path: string) => ({
  "@type": "ListItem",
  position,
  name,
  item: new URL(path, publicOrigin).href,
});

/** schema.org structured data for the hub: where it sits. */
export function versusHubJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [crumb(1, "AMP", "/"), crumb(2, "Compare", "/versus")],
    },
  ];
}

/** schema.org structured data for one comparison: its questions and where
 * it sits. Never a review or a rating. */
export function versusPageJsonLd(page: VersusPage) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.questions.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: withoutCitations(answer) },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        crumb(1, "AMP", "/"),
        crumb(2, "Compare", "/versus"),
        crumb(3, `AMP vs ${page.name}`, versusPath(page.slug)),
      ],
    },
  ];
}
