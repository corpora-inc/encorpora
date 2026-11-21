/** The 1200×630 share card a link preview shows (Open Graph and X): one frame
 * for every card the build makes, so the skill map's cards
 * (scripts/build-public-pathways.ts) and the public pages' cards
 * (scripts/lib/public-share-cards.ts) look like one family. Build-time only:
 * the app never draws a card. */
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

export const cardWidth = 1200;
export const cardHeight = 630;

/** The cards' own palette: a dark surface that reads the same in every feed,
 * light or dark. The app's colors are tokens (src/web/ui/tokens.css); a card
 * is a picture, drawn once at build time. */
export const cardColors = {
  surfaceFrom: "#071c25",
  surfaceTo: "#10263a",
  glow: "#165f70",
  mark: "#a1f0e4",
  label: "#c8eee7",
  accent: "#8ce8df",
  title: "#f0f8f6",
  body: "#bfd7d5",
  line: "#6cabae",
  halo: "#c5fff2",
  /** The five areas' hues, in order (curriculum/areas.ts). */
  areas: ["#6dbce4", "#a58be3", "#efbd74", "#e694bb", "#8bd8bb"],
  /** A printed page on the card: paper, ink, and its quieter lines. */
  paper: "#fbfaf6",
  ink: "#1f2c4a",
  inkSoft: "#5d6676",
  rule: "#d9dde3",
  panel: "#e9f1f8",
  panelEdge: "#b9cde0",
  shadow: "#000000",
} as const;

/** The card's typefaces, from KaTeX (a dependency already): the frame is
 * sans serif; a printed page drawn on a card may use the serif. */
export const sans = "KaTeX_SansSerif";
export const serif = "KaTeX_Main";
const fontFiles = [
  "SansSerif-Regular",
  "SansSerif-Bold",
  "Main-Regular",
  "Main-Bold",
].map((name) =>
  fileURLToPath(
    new URL(
      `../../node_modules/katex/dist/fonts/KaTeX_${name}.ttf`,
      import.meta.url,
    ),
  ),
);

export function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/** A title broken into lines of at most 20 characters, the width the frame's
 * 52px title holds beside its art. */
export function titleLines(title: string) {
  const lines: string[] = [];
  let line = "";
  for (const word of title.split(" ")) {
    if (line && `${line} ${word}`.length > 20) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

export type CardText = {
  /** Beside the wave mark, top left: "AMP", "AMP PATHWAYS". */
  label: string;
  /** Above the title, in the accent color. */
  eyebrow: string;
  /** The title, one to three lines of at most 20 characters. */
  lines: readonly string[];
  /** One line under the title. */
  subtitle: string;
  /** The page's address, without the scheme. */
  address: string;
};

/** The frame: the surface, the glow, the wave mark and the text column on
 * the left; `art` fills the right half (x 625–1180), with any `defs` it
 * needs. */
export function cardSvg(text: CardText, art: string, defs = "") {
  const { lines } = text;
  const titleY = lines.length > 1 ? 260 : 290;
  if (
    lines.length < 1 ||
    lines.length > 3 ||
    lines.some((line) => line.length > 20) ||
    titleY + (lines.length - 1) * 63 + 52 > 460
  )
    throw new Error(
      `Social card title exceeds its text area: ${lines.join(" ")}`,
    );
  if (text.subtitle.length > 40 || text.eyebrow.length > 40)
    throw new Error(`Social card text exceeds its column: ${text.subtitle}`);
  const c = cardColors;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}">
    <defs>
      <linearGradient id="surface" x2="1" y2="1"><stop stop-color="${c.surfaceFrom}"/><stop offset="1" stop-color="${c.surfaceTo}"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="${c.glow}" stop-opacity=".7"/><stop offset="1" stop-color="${c.glow}" stop-opacity="0"/></radialGradient>
      ${defs}
    </defs>
    <rect width="${cardWidth}" height="${cardHeight}" fill="url(#surface)"/>
    <circle cx="900" cy="315" r="350" fill="url(#glow)"/>
    <path d="M60 74c12-40 24-40 36 0s24 40 36 0 24-40 36 0" fill="none" stroke="${c.mark}" stroke-width="3"/>
    <text x="190" y="80" fill="${c.label}" font-family="${sans}" font-size="24">${escapeXml(text.label)}</text>
    <text x="64" y="180" fill="${c.accent}" font-family="${sans}" font-size="22">${escapeXml(text.eyebrow)}</text>
    ${lines.map((line, index) => `<text x="64" y="${titleY + index * 63}" fill="${c.title}" font-family="${sans}" font-size="52">${escapeXml(line)}</text>`).join("")}
    <text x="64" y="492" fill="${c.body}" font-family="${sans}" font-size="25">${escapeXml(text.subtitle)}</text>
    <text x="64" y="550" fill="${c.accent}" font-family="${sans}" font-size="22">${escapeXml(text.address)}</text>
    ${art}
  </svg>`;
}

export function renderCard(svg: string) {
  return new Resvg(svg, {
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: sans },
  })
    .render()
    .asPng();
}

/** `<id>-<first 12 hex of the PNG's sha256>.png`: a changed card is a new
 * address, so no feed keeps an old picture under it. */
export function cardFileName(id: string, png: Uint8Array) {
  return `${id}-${createHash("sha256").update(png).digest("hex").slice(0, 12)}.png`;
}
