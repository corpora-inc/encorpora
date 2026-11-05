import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import React, { renderToStaticMarkup } from "./react.js";
import { Figure } from "../../amp/src/web/Figure.js";
import type { SiteConfig } from "./config.js";
import { pageCopy, type CopyRoute } from "./page-copy.js";
import { legalTitles, type LegalPage } from "./legal.js";
import { fundingForPath, type FundingRoute } from "./funding.js";
import { samples } from "./product.js";
import { stateNames } from "./state-identity.js";
import { arizonaOutline } from "./arizona-outline.js";
import { arkansasOutline } from "./arkansas-outline.js";

// 1.91:1 is the shared large-image ratio for Open Graph, X, LinkedIn,
// Slack and iMessage previews.
export const cardWidth = 1200;
export const cardHeight = 630;

const fonts = [
  "Main-Regular",
  "Main-Italic",
  "SansSerif-Regular",
  "SansSerif-Bold",
].map((name) =>
  fileURLToPath(
    new URL(
      `../../amp/node_modules/katex/dist/fonts/KaTeX_${name}.ttf`,
      import.meta.url,
    ),
  ),
);
const serif = "KaTeX_Main";
// Vertical layout of the text column. The heading's inked bottom (baseline
// plus descenders) must stay clear of the rule above the address.
const headingTop = 262;
export const ruleY = 538;
export const headingBottom = ruleY - 32;
const lineGap = 1.12;
const descent = 0.25;
/** Inked bottom of an n-line heading at this size. */
function headingInkBottom(size: number, lines: number) {
  return headingTop + size * 0.82 + (lines - 1) * size * lineGap + size * descent;
}
const sans = "KaTeX_SansSerif";
const resvgOptions = {
  font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: sans },
};

type Art =
  | { kind: "problem"; sample: number }
  | { kind: "state"; state: string }
  | { kind: "states"; states: string[] };
export type CardSpec = {
  label: string;
  heading: string;
  emphasis?: string;
  path: string;
  art: Art;
};
export type Card = { name: string; png: Buffer; alt: string };

/** Tokens from AMP's theme, so card colors and figures match the site. */
export function parseTokens(css: string) {
  const block = css.match(/:root\s*\{([^}]+)\}/)?.[1];
  if (!block) throw new Error("AMP theme token block not found");
  return new Map(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
      m[1]!,
      m[2]!.trim(),
    ]),
  );
}

function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

function headingFor(funding: FundingRoute) {
  return funding.page?.presentation?.headline ?? funding.program;
}

export function cardSpec(route: string, config: SiteConfig): CardSpec {
  const funding = fundingForPath(route, config);
  if (funding)
    return {
      label: `${stateNames[funding.state] ?? funding.state} · Education funds`,
      heading: headingFor(funding),
      path: route,
      art: { kind: "state", state: funding.state },
    };
  if (route in pageCopy) {
    const copy = pageCopy[route as CopyRoute];
    const states = [
      ...new Set(
        config.funding
          .map((r) => r.state)
          .filter((state) => state !== "US"),
      ),
    ];
    return {
      label: copy.label,
      heading: copy.heading,
      emphasis: "emphasis" in copy ? copy.emphasis : undefined,
      path: route,
      art:
        route === "/esa/" && states.length
          ? { kind: "states", states }
          : {
              kind: "problem",
              sample: route === "/amp/" || route === "/schools/" ? 1 : 0,
            },
    };
  }
  const page = route.split("/")[2] as LegalPage;
  if (!(page in legalTitles)) throw new Error(`No social card for ${route}`);
  return {
    label: "Corpora policies",
    heading: legalTitles[page],
    path: route,
    art: { kind: "problem", sample: 0 },
  };
}

function bbox(text: string, family: string, size: number, attrs = "") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="400"><text x="0" y="200" font-family="${family}" font-size="${size}"${attrs}>${escape(text)}</text></svg>`;
  return new Resvg(svg, resvgOptions).getBBox();
}

/**
 * The card fonts are loaded without system fallback, so a character they lack
 * would render as a missing-glyph box. Fail the build instead.
 */
const checked = new Set<string>();
function assertGlyphs(text: string, family: string) {
  const missing = bbox("\uE000", family, 100);
  for (const char of new Set(text.replace(/\s/g, ""))) {
    const key = `${family}|${char}`;
    if (checked.has(key)) continue;
    const box = bbox(char, family, 100);
    if (
      missing &&
      box &&
      Math.abs(box.width - missing.width) < 0.01 &&
      Math.abs(box.height - missing.height) < 0.01
    )
      throw new Error(`Social card font ${family} has no glyph for "${char}" in: ${text}`);
    checked.add(key);
  }
}

/** Measured with the card's own fonts, so wrapping matches the render. */
const widths = new Map<string, number>();
function textWidth(text: string, family: string, size: number, italic = false, attrs = "") {
  const key = `${family}|${size}|${italic}|${attrs}|${text}`;
  const known = widths.get(key);
  if (known !== undefined) return known;
  assertGlyphs(text, family);
  const width =
    bbox(text, family, size, `${italic ? ' font-style="italic"' : ""}${attrs}`)
      ?.width ?? 0;
  widths.set(key, width);
  return width;
}

/** Right edge of the inked glyphs, from the text origin. */
function textRight(text: string, family: string, size: number, attrs = "") {
  assertGlyphs(text, family);
  const box = bbox(text, family, size, attrs);
  return box ? box.x + box.width : 0;
}

type Word = { text: string; italic: boolean };
function wrap(
  words: Word[],
  family: string,
  size: number,
  maxWidth: number,
): Word[][] {
  const lines: Word[][] = [];
  let line: Word[] = [];
  for (const word of words) {
    const candidate = [...line, word];
    const text = candidate.map((w) => w.text).join(" ");
    if (line.length && textWidth(text, family, size, word.italic) > maxWidth) {
      lines.push(line);
      line = [word];
    } else line = candidate;
  }
  if (line.length) lines.push(line);
  return lines;
}

/** Largest heading size whose wrapped lines fit the text column. */
function fitHeading(spec: CardSpec, maxWidth: number) {
  const words: Word[] = [
    ...spec.heading.split(/\s+/).map((text) => ({ text, italic: false })),
    ...(spec.emphasis ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((text) => ({ text, italic: true })),
  ];
  const layout = (size: number) =>
    spec.emphasis
      ? [
          ...wrap(words.filter((w) => !w.italic), serif, size, maxWidth),
          ...wrap(words.filter((w) => w.italic), serif, size, maxWidth),
        ]
      : wrap(words, serif, size, maxWidth);
  const tooWide = (line: Word[], size: number) =>
    textWidth(line.map((w) => w.text).join(" "), serif, size, line[0]!.italic) >
    maxWidth;
  const minimum = 36;
  for (let size = 72; size >= minimum; size -= 4) {
    const lines = layout(size);
    if (
      !lines.some((line) => tooWide(line, size)) &&
      headingInkBottom(size, lines.length) <= headingBottom
    )
      return { size, lines };
  }
  // Configured headlines are free text. Keep the build working and end the
  // last visible line with an ellipsis; the page itself shows the full text.
  const size = minimum;
  let fit = 1;
  while (headingInkBottom(size, fit + 1) <= headingBottom) fit++;
  const lines = layout(size).slice(0, fit);
  const last = lines[lines.length - 1]!;
  last.push({ text: "…", italic: last[last.length - 1]!.italic });
  while (last.length > 1 && tooWide(last, size)) last.splice(-2, 1);
  for (const line of lines)
    while (line.length === 1 && tooWide(line, size))
      line[0] = { ...line[0]!, text: `${line[0]!.text.slice(0, -2)}…` };
  return { size, lines };
}

function headingSvg(spec: CardSpec, ink: string, emphasis: string) {
  const top = headingTop;
  const { size, lines } = fitHeading(spec, 540);
  const lineHeight = size * lineGap;
  return lines
    .map((line, index) => {
      const spans = line
        .map(
          (word, i) =>
            `<tspan${word.italic ? ` font-style="italic" fill="${emphasis}"` : ""}>${i ? " " : ""}${escape(word.text)}</tspan>`,
        )
        .join("");
      return `<text x="72" y="${(top + size * 0.82 + index * lineHeight).toFixed(1)}" font-family="${serif}" font-size="${size}" fill="${ink}" letter-spacing="${(-size * 0.02).toFixed(2)}">${spans}</text>`;
    })
    .join("");
}

function resolveVars(markup: string, tokens: Map<string, string>) {
  return markup.replace(
    /var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g,
    (_, name: string, fallback?: string) => {
      const value = tokens.get(name) ?? fallback?.trim();
      if (!value) throw new Error(`Unknown theme token ${name}`);
      return value;
    },
  );
}

/** A real AMP problem: label row, prompt, figure, answer. */
function problemArt(index: number, t: (name: string) => string, x: number, y: number, w: number, h: number, tokens: Map<string, string>) {
  const sample = samples[index]!;
  const figure = sample.public.figure;
  if (!figure) throw new Error(`Card sample ${sample.title} has no figure`);
  assertGlyphs(`AMP / ${sample.title} Sample Answer ${sample.answer}`, sans);
  const pad = 32;
  const inner = w - pad * 2;
  const prompt = wrap(
    sample.public.prompt.split(/\s+/).map((text) => ({ text, italic: false })),
    sans,
    26,
    inner,
  );
  const promptTop = y + 104;
  const promptSvg = prompt
    .map(
      (line, i) =>
        `<text x="${x + pad}" y="${promptTop + i * 34}" font-family="${sans}" font-size="26" fill="${t("--color-on-surface")}">${escape(line.map((word) => word.text).join(" "))}</text>`,
    )
    .join("");
  const svg = resolveVars(
    renderToStaticMarkup(<Figure figure={figure} />),
    tokens,
  ).match(/<svg[\s\S]*<\/svg>/)?.[0];
  if (!svg) throw new Error(`Card sample ${sample.title} figure is not SVG`);
  const answerHeight = 52;
  const figureTop = promptTop + (prompt.length - 1) * 34 + 28;
  const figureBottom = y + h - pad - answerHeight - 20;
  const figureSvg = svg
    .replace(/\sclass="[^"]*"/, "")
    .replace(/\srole="[^"]*"/, "")
    .replace(
      /^<svg/,
      `<svg x="${x + pad}" y="${figureTop}" width="${inner}" height="${figureBottom - figureTop}" preserveAspectRatio="xMidYMid meet" font-family="${sans}" font-size="26" fill="${t("--color-figure-ink")}"`,
    );
  const answerY = y + h - pad - answerHeight;
  return `
    <text x="${x + pad}" y="${y + 52}" font-family="${sans}" font-size="17" fill="${t("--color-muted-text")}">AMP / ${escape(sample.title)}</text>
    <text x="${x + w - pad}" y="${y + 52}" font-family="${sans}" font-size="17" fill="${t("--color-muted-text")}" text-anchor="end">Sample</text>
    <path d="M${x + pad} ${y + 72}H${x + w - pad}" stroke="${t("--color-border")}" stroke-width="1.5"/>
    ${promptSvg}
    ${figureSvg}
    <rect x="${x + pad}" y="${answerY}" width="${inner}" height="${answerHeight}" rx="14" fill="${t("--color-success")}"/>
    <text x="${x + pad + 20}" y="${answerY + 33}" font-family="${sans}" font-size="20" fill="${t("--color-on-success")}">Answer</text>
    <text x="${x + w - pad - 20}" y="${answerY + 34}" font-family="${sans}" font-weight="bold" font-size="24" fill="${t("--color-on-success")}" text-anchor="end">${escape(sample.answer)}</text>`;
}

function gridPattern(t: (name: string) => string) {
  return `<pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)"><path d="M28 0H0V28" fill="none" stroke="${t("--color-primary")}" stroke-opacity=".09" stroke-width="1.5"/></pattern>`;
}

function stateArt(state: string, t: (name: string) => string, x: number, y: number, w: number, h: number) {
  const outline =
    state === "AR" ? arkansasOutline : state === "AZ" ? arizonaOutline : undefined;
  const name = stateNames[state] ?? state;
  assertGlyphs(name.toUpperCase() + state, sans);
  const shape = outline
    ? `<svg x="${x + 60}" y="${y + 48}" width="${w - 120}" height="${h - 190}" viewBox="${outline.viewBox}" preserveAspectRatio="xMidYMid meet"><path d="${outline.path}" fill="${t("--color-secondary")}" stroke="${t("--color-primary")}" stroke-width="1.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`
    : `<text x="${x + w / 2}" y="${y + h / 2 + 30}" font-family="${sans}" font-weight="bold" font-size="190" letter-spacing="-10" fill="${t("--color-primary")}" text-anchor="middle">${escape(state)}</text>`;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="url(#grid)"/>
    ${shape}
    <text x="${x + 36}" y="${y + h - 44}" font-family="${sans}" font-weight="bold" font-size="20" letter-spacing="2.6" fill="${t("--color-muted-text")}">${escape(name.toUpperCase())}</text>
    ${outline ? `<text x="${x + w - 36}" y="${y + h - 44}" font-family="${sans}" font-weight="bold" font-size="20" letter-spacing="2.6" fill="${t("--color-primary")}" text-anchor="end">${escape(state)}</text>` : ""}`;
}

function statesArt(states: string[], t: (name: string) => string, x: number, y: number, w: number, h: number) {
  const shown = states.slice(0, 9);
  const columns = shown.length <= 4 ? 2 : 3;
  const rows = Math.ceil(shown.length / columns);
  const gap = 18;
  const cell = Math.min(
    (w - 72 - gap * (columns - 1)) / columns,
    (h - 72 - gap * (rows - 1)) / rows,
  );
  const left = x + (w - (cell * columns + gap * (columns - 1))) / 2;
  const top = y + (h - (cell * rows + gap * (rows - 1))) / 2;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="url(#grid)"/>
    ${shown
      .map((state, i) => {
        const row = Math.floor(i / columns);
        const inRow = Math.min(columns, shown.length - row * columns);
        const cx =
          left +
          ((columns - inRow) * (cell + gap)) / 2 +
          (i % columns) * (cell + gap);
        const cy = top + Math.floor(i / columns) * (cell + gap);
        return `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="20" fill="${t("--color-secondary")}" stroke="${t("--color-primary")}" stroke-opacity=".35"/>
        <text x="${cx + cell / 2}" y="${cy + cell / 2 + cell * 0.14}" font-family="${sans}" font-weight="bold" font-size="${(cell * 0.38).toFixed(0)}" fill="${t("--color-primary")}" text-anchor="middle">${escape(state)}</text>`;
      })
      .join("")}`;
}

/** Eyebrow segments joined by drawn dots; the card fonts have no middle dot. */
function labelSvg(label: string, t: (name: string) => string): string {
  const attrs = ' font-weight="bold" letter-spacing="2.4"';
  const segments = label.toUpperCase().split(/\s+·\s+/);
  let x = 96;
  const parts: string[] = [
    `<circle cx="78" cy="205" r="5" fill="${t("--color-primary")}"/>`,
  ];
  segments.forEach((segment, index) => {
      if (index) {
        parts.push(
          `<circle cx="${(x + 15).toFixed(1)}" cy="205" r="3" fill="${t("--color-primary")}"/>`,
        );
        x += 30;
      }
      parts.push(
        `<text x="${x.toFixed(1)}" y="212" font-family="${sans}" font-size="19"${attrs} fill="${t("--color-muted-text")}">${escape(segment)}</text>`,
      );
      x += textRight(segment, sans, 19, attrs);
    });
  // Drop trailing qualifiers rather than run into the panel.
  if (x > 620) {
    if (segments.length === 1)
      throw new Error(`Social card label is too long: ${label}`);
    return labelSvg(segments.slice(0, -1).join(" · "), t);
  }
  return parts.join("");
}

export function cardSvg(spec: CardSpec, tokens: Map<string, string>, siteUrl?: string) {
  const t = (name: string) => {
    const value = tokens.get(name);
    if (!value) throw new Error(`Unknown theme token ${name}`);
    return value;
  };
  const host = siteUrl ? new URL(siteUrl).host.replace(/^www\./, "") : "corpora.inc";
  const address = `${host}${spec.path === "/" ? "" : spec.path.replace(/\/$/, "")}`;
  assertGlyphs(address, sans);
  const panel = { x: 668, y: 64, w: 468, h: 502 };
  const art =
    spec.art.kind === "problem"
      ? problemArt(spec.art.sample, t, panel.x, panel.y, panel.w, panel.h, tokens)
      : spec.art.kind === "state"
        ? stateArt(spec.art.state, t, panel.x, panel.y, panel.w, panel.h)
        : statesArt(spec.art.states, t, panel.x, panel.y, panel.w, panel.h);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}">
  <defs>
    <filter id="lift" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="${t("--color-on-surface")}" flood-opacity=".10"/></filter>
    ${gridPattern(t)}
  </defs>
  <rect width="${cardWidth}" height="${cardHeight}" fill="${t("--color-surface")}"/>
  <text x="72" y="118" font-family="${sans}" font-weight="bold" font-size="44" letter-spacing="-3" fill="${t("--color-on-surface")}">corpora<tspan fill="${t("--color-primary")}">.</tspan></text>
  ${labelSvg(spec.label, t)}
  ${headingSvg(spec, t("--color-on-surface"), t("--color-primary"))}
  <path d="M72 ${ruleY}H160" stroke="${t("--color-primary")}" stroke-width="3" stroke-linecap="round"/>
  <text x="72" y="576" font-family="${sans}" font-size="22" fill="${t("--color-muted-text")}">${escape(address)}</text>
  <rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" rx="28" fill="${t("--color-surface-raised")}" stroke="${t("--color-border")}" stroke-width="1.5" filter="url(#lift)"/>
  ${art}
</svg>`;
}

export function cardAlt(spec: CardSpec) {
  const heading = [spec.heading, spec.emphasis].filter(Boolean).join(" ");
  const art =
    spec.art.kind === "problem"
      ? `Sample AMP problem: ${samples[spec.art.sample]!.public.prompt}`
      : spec.art.kind === "state"
        ? `${stateNames[spec.art.state] ?? spec.art.state} state outline`
        : `States with funding guidance: ${spec.art.states.join(", ")}`;
  return `Corpora. ${spec.label}: ${heading} ${art}`;
}

export function renderCard(route: string, config: SiteConfig, tokens: Map<string, string>): Card {
  const spec = cardSpec(route, config);
  const png = new Resvg(cardSvg(spec, tokens, config.siteUrl), resvgOptions)
    .render()
    .asPng();
  const slug = route.replace(/^\/|\/$/g, "").replaceAll("/", "-") || "home";
  const hash = createHash("sha256").update(png).digest("hex").slice(0, 12);
  return { name: `${slug}-${hash}.png`, png, alt: cardAlt(spec) };
}
