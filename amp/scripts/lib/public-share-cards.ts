/** The share card of each public page but `/` (whose product card is drawn
 * with the skill map's, scripts/build-public-pathways.ts). The build renders
 * these (scripts/build-share-cards.ts) and records each one's address and
 * alt text in src/web/app/share-cards.json, which the route head writes.
 *
 * A card here draws only what changes with its own page: never the skill map
 * or anything else computed from the catalog, so the recorded addresses
 * change when the card does and not with every new skill. The KaTeX fonts
 * have no middle dot; a card never uses one. */
import type { publicDocumentPaths } from "../../src/web/app/document-index";
import { report, pilotPage } from "../../src/research/report";
import {
  cardColors as c,
  cardFileName,
  cardSvg,
  escapeXml,
  renderCard,
  sans,
  serif,
  titleLines,
} from "./share-card";

export type PublicCardPath = Exclude<(typeof publicDocumentPaths)[number], "/">;
export type PublicShareCard = {
  /** The file name's stem: `/assets/share-cards/<id>-<hash>.png`. */
  id: string;
  /** What the picture shows, for a reader who can't see it. */
  alt: string;
  svg: string;
};

const shadow = `<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>`;

/** Lines of text too small to read, drawn as bars: a page's texture. */
function textBars(
  x: number,
  y: number,
  widths: readonly number[],
  gap: number,
  fill: string,
  height = 4.5,
) {
  return widths
    .map((width, index) =>
      width > 0
        ? `<rect x="${x}" y="${(y + index * gap).toFixed(1)}" width="${width}" height="${height}" rx="${height / 2}" fill="${fill}"/>`
        : "",
    )
    .join("");
}

/** A printed sheet, top left at (x, y), with a soft shadow under it. A
 * sheet without content is the one under it, tilted and dimmer. */
function sheet(
  x: number,
  y: number,
  width: number,
  height: number,
  content = "",
) {
  const under = !content;
  return `<g${under ? ` transform="rotate(4 ${x + width / 2} ${y + height / 2})"` : ""}>
      <rect x="${x + 6}" y="${y + 14}" width="${width}" height="${height}" fill="${c.shadow}" fill-opacity=".45" filter="url(#shadow)"/>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="${c.paper}"${under ? ' fill-opacity=".55"' : ""}/>
      ${under ? "" : `<g transform="translate(${x} ${y})">${content}</g>`}
    </g>`;
}

const centered = (
  x: number,
  y: number,
  size: number,
  text: string,
  options: {
    bold?: boolean;
    fill?: string;
    spacing?: number;
    family?: string;
  } = {},
) =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-family="${options.family ?? serif}" font-size="${size}"${options.bold ? ' font-weight="bold"' : ""}${options.spacing ? ` letter-spacing="${options.spacing}"` : ""} fill="${options.fill ?? c.ink}">${escapeXml(text)}</text>`;

/** `/research`: the report's first page, drawn from the report itself
 * (src/research/report.ts): its series, title, author and length. */
function researchArt() {
  const [name, subject] = report.title.split(": ");
  if (!name || !subject)
    throw new Error(`The report's title has no subtitle: ${report.title}`);
  const width = 372;
  const height = Math.round((width * report.cover.height) / report.cover.width);
  const mid = width / 2;
  const body = [
    328, 328, 328, 328, 214, 0, 328, 328, 328, 172, 0, 300, 300, 300, 120,
  ];
  const page = [
    centered(mid, 40, 9.5, `${report.series.toUpperCase()} – ESSA TIER 4`, {
      fill: c.inkSoft,
      spacing: 1.4,
    }),
    centered(mid, 74, 20, name, { bold: true }),
    centered(mid, 98, 15, subject),
    centered(mid, 126, 12.5, report.author),
    centered(mid, 143, 10.5, report.affiliation, { fill: c.inkSoft }),
    `<rect x="22" y="160" width="328" height="76" rx="3" fill="${c.panel}" stroke="${c.panelEdge}"/>`,
    textBars(34, 172, [304, 304, 304, 304, 190], 12, c.inkSoft),
    `<rect x="22" y="258" width="196" height="8" rx="2" fill="${c.ink}"/>`,
    textBars(22, 280, body, 10.5, c.rule),
    `<line x1="22" y1="${height - 26}" x2="350" y2="${height - 26}" stroke="${c.rule}"/>`,
    `<text x="22" y="${height - 12}" font-family="${serif}" font-size="9" fill="${c.inkSoft}">${escapeXml(report.series)}</text>`,
    `<text x="350" y="${height - 12}" text-anchor="end" font-family="${serif}" font-size="9" fill="${c.inkSoft}">1 of ${report.pages}</text>`,
  ].join("");
  return sheet(742, 78, width, height) + sheet(728, 70, width, height, page);
}

/** `/research/pilot`: the study from a family's side, in the page's order
 * (src/research/report.ts, `pilotPage`). */
function pilotArt() {
  const steps = [
    "Join the list",
    "Enrollment opens",
    "A math score at the start",
    "AMP, free during the study",
    "A math score at the end",
    "The published results",
  ];
  const top = 110;
  const gap = 82;
  const x = 760;
  return `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + gap * (steps.length - 1)}" stroke="${c.accent}" stroke-opacity=".45" stroke-width="2"/>
    ${steps
      .map((step, index) => {
        const y = top + index * gap;
        const mark =
          index === 0
            ? `<circle cx="${x}" cy="${y}" r="21" fill="none" stroke="${c.halo}" stroke-opacity=".65" stroke-width="2"/><circle cx="${x}" cy="${y}" r="9" fill="${c.mark}"/>`
            : `<circle cx="${x}" cy="${y}" r="8" fill="${c.surfaceTo}" stroke="${c.accent}" stroke-width="2.5"/>`;
        return `${mark}<text x="${x + 40}" y="${y + 8}" font-family="${sans}" font-size="24" fill="${index === 0 ? c.title : c.body}">${escapeXml(step)}</text>`;
      })
      .join("")}`;
}

/** AMP's levels, as the scope and sequence names them
 * (src/schools/scope-and-sequence.ts). */
const levels = [
  "Kindergarten",
  ...Array.from({ length: 8 }, (_, index) => `Grade ${index + 1}`),
  "Algebra 1",
  "Geometry",
  "Algebra 2",
  "Precalculus",
];

/** `/schools`: one program from Kindergarten to Precalculus, each level a
 * step on one path, its two ends marked. */
function schoolsArt() {
  const top = 76;
  const gap = 40;
  const x = 790;
  const y = (index: number) => top + (levels.length - 1 - index) * gap;
  return `<line x1="${x}" y1="${y(0)}" x2="${x}" y2="${y(levels.length - 1)}" stroke="${c.line}" stroke-opacity=".6" stroke-width="2"/>
    ${levels
      .map(
        (level, index) =>
          `${
            index === 0 || index === levels.length - 1
              ? `<circle cx="${x}" cy="${y(index)}" r="17" fill="none" stroke="${c.halo}" stroke-opacity=".65" stroke-width="2"/><circle cx="${x}" cy="${y(index)}" r="8" fill="${c.mark}"/>`
              : `<circle cx="${x}" cy="${y(index)}" r="6" fill="${c.surfaceTo}" stroke="${c.accent}" stroke-width="2.5"/>`
          }<text x="${x + 34}" y="${y(index) + 7}" font-family="${sans}" font-size="21" fill="${index === 0 || index === levels.length - 1 ? c.title : c.body}">${escapeXml(level)}</text>`,
      )
      .join("")}`;
}

/** `/schools/scope-and-sequence`: the document itself, a level's table of
 * objectives, standards and prerequisites, with its two downloads. */
function scopeArt() {
  const width = 372;
  const height = 482;
  const mid = width / 2;
  const rows = (y: number, count: number) =>
    Array.from({ length: count }, (_, index) => {
      const top = y + index * 26;
      return `<line x1="22" y1="${top - 9}" x2="350" y2="${top - 9}" stroke="${c.rule}"/>${textBars(22, top, [[150, 120, 162, 96][index % 4]!], 0, c.inkSoft)}${textBars(196, top, [[58, 44, 66, 52][index % 4]!], 0, c.panelEdge)}${textBars(276, top, [[60, 74, 40, 66][index % 4]!], 0, c.rule)}`;
    }).join("");
  const level = (y: number, label: string, count: number) =>
    `<text x="22" y="${y}" font-family="${serif}" font-size="15" font-weight="bold" fill="${c.ink}">${escapeXml(label)}</text>
      <text x="22" y="${y + 22}" font-family="${serif}" font-size="9" letter-spacing="1" fill="${c.inkSoft}">OBJECTIVE</text>
      <text x="196" y="${y + 22}" font-family="${serif}" font-size="9" letter-spacing="1" fill="${c.inkSoft}">STANDARDS</text>
      <text x="276" y="${y + 22}" font-family="${serif}" font-size="9" letter-spacing="1" fill="${c.inkSoft}">BUILDS ON</text>
      ${rows(y + 44, count)}`;
  const page = [
    centered(mid, 40, 9.5, "AMP FOR SCHOOLS", {
      fill: c.inkSoft,
      spacing: 1.4,
    }),
    centered(mid, 72, 20, "AMP scope and sequence", { bold: true }),
    centered(mid, 96, 13, "Kindergarten to Precalculus"),
    level(140, levels[0]!, 5),
    level(316, levels[1]!, 4),
  ].join("");
  const badge = (x: number, label: string) =>
    `<rect x="${x}" y="520" width="92" height="40" rx="20" fill="${c.surfaceFrom}" stroke="${c.accent}" stroke-width="2"/><text x="${x + 46}" y="547" text-anchor="middle" font-family="${sans}" font-size="20" fill="${c.title}">${label}</text>`;
  return (
    sheet(742, 58, width, height) +
    sheet(728, 46, width, height, page) +
    badge(900, "PDF") +
    badge(1004, "CSV")
  );
}

/** `/schools/trust`: the questions the page answers, in its order
 * (src/web/features/schools/TrustScreen.tsx). */
function trustArt() {
  const topics = [
    "What’s collected",
    "What isn’t",
    "Who signs in, and how",
    "How long it’s kept",
    "Export and deletion",
    "Where it lives",
  ];
  const top = 92;
  const gap = 78;
  const left = 700;
  return `<rect x="${left - 30}" y="${top - 52}" width="480" height="${gap * topics.length + 26}" rx="26" fill="${c.surfaceFrom}" fill-opacity=".55" stroke="${c.line}" stroke-opacity=".35"/>
    ${topics
      .map((topic, index) => {
        const y = top + index * gap;
        const rule = index
          ? `<line x1="${left}" y1="${y - 44}" x2="${left + 420}" y2="${y - 44}" stroke="${c.line}" stroke-opacity=".3"/>`
          : "";
        return `${rule}<circle cx="${left + 14}" cy="${y - 8}" r="14" fill="none" stroke="${c.accent}" stroke-width="2.5"/><path d="M${left + 7} ${y - 8}l5 5 9-10" fill="none" stroke="${c.mark}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><text x="${left + 46}" y="${y}" font-family="${sans}" font-size="24" fill="${c.body}">${escapeXml(topic)}</text>`;
      })
      .join("")}`;
}

// The pilot card's title is its page's, broken where it reads best.
const pilotLines = ["Join the AMP", "pilot study"];
if (pilotLines.join(" ") !== pilotPage.title)
  throw new Error(
    `The pilot card's title is not its page's: ${pilotPage.title}`,
  );

export const publicShareCards: Readonly<
  Record<PublicCardPath, PublicShareCard>
> = {
  "/schools": {
    id: "schools",
    alt: "AMP for Schools: a complete math curriculum, from Kindergarten to Precalculus.",
    svg: cardSvg(
      {
        label: "AMP FOR SCHOOLS",
        eyebrow: "ADAPTIVE MATH PATHWAYS",
        lines: ["A complete math", "curriculum for", "your school"],
        subtitle: "From counting to precalculus",
        address: "amp.corpora.inc/schools",
      },
      schoolsArt(),
    ),
  },
  "/schools/trust": {
    id: "schools-trust",
    alt: "How AMP handles student data: what’s collected, who signs in, retention and deletion.",
    svg: cardSvg(
      {
        label: "AMP FOR SCHOOLS",
        eyebrow: "STUDENT DATA",
        lines: ["How AMP handles", "student data"],
        subtitle: "And the agreement schools accept",
        address: "amp.corpora.inc/schools/trust",
      },
      trustArt(),
    ),
  },
  "/schools/scope-and-sequence": {
    id: "schools-scope",
    alt: "AMP’s scope and sequence: every objective from Kindergarten to Precalculus.",
    svg: cardSvg(
      {
        label: "AMP FOR SCHOOLS",
        eyebrow: "SCOPE AND SEQUENCE",
        lines: ["Every objective,", "Kindergarten to", "Precalculus"],
        subtitle: "With standards and prerequisites",
        address: "amp.corpora.inc/schools/scope-and-sequence",
      },
      scopeArt(),
      shadow,
    ),
  },
  "/research": {
    id: "research",
    alt: `${report.series}: ${report.title.split(": ")[1]}, AMP’s ESSA Tier 4 rationale.`,
    svg: cardSvg(
      {
        label: "AMP RESEARCH",
        eyebrow: "ESSA TIER 4 RATIONALE",
        lines: titleLines(report.title.split(": ")[1] ?? ""),
        subtitle: `${report.series}, ${report.publishedLabel}`,
        address: "amp.corpora.inc/research",
      },
      researchArt(),
      shadow,
    ),
  },
  "/research/pilot": {
    id: "research-pilot",
    alt: "Join the AMP pilot study: math growth with AMP, measured on a national test.",
    svg: cardSvg(
      {
        label: "AMP RESEARCH",
        eyebrow: "PILOT STUDY",
        lines: pilotLines,
        subtitle: "Math growth, on a national test",
        address: "amp.corpora.inc/research/pilot",
      },
      pilotArt(),
    ),
  },
};

/** Where the build writes the cards, and the record the app reads. */
export const shareCardDirectory = "/assets/share-cards/";
export const shareCardsJson = new URL(
  "../../src/web/app/share-cards.json",
  import.meta.url,
);

/** Every card, rendered, with its content-hashed address. */
export function renderShareCards() {
  return Object.entries(publicShareCards).map(([path, card]) => {
    const png = renderCard(card.svg);
    return {
      path,
      png,
      image: shareCardDirectory + cardFileName(card.id, png),
      alt: card.alt,
    };
  });
}

/** src/web/app/share-cards.json, exactly as the build writes it. */
export function shareCardRecord(cards: ReturnType<typeof renderShareCards>) {
  return `${JSON.stringify(
    Object.fromEntries(
      cards.map(({ path, image, alt }) => [path, { image, alt }]),
    ),
    null,
    2,
  )}\n`;
}
