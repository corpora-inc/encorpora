import type { FastifyBaseLogger } from "fastify";
import QRCode from "qrcode";
import { z } from "zod";
import { printTokens } from "../content/print-exercise";
import { workbookFontCss } from "../workbook/fonts";
import type { WorkbookRenderer } from "../workbook/pdf";

/** Reports, report cards and sign-in cards on paper, in the workbooks' type
 * and colors: Fraunces headings, IBM Plex Sans text, the app's light tokens.
 * Each is rendered for its request by the workbook renderer (Chromium, or the
 * render service) and never stored: they carry a learner's name. */
export type Paper = "Letter" | "A4";
/** `?format=Letter|A4`; Letter when absent. */
export const paperQuery = z.strictObject({
  format: z.enum(["Letter", "A4"]).default("Letter"),
});

export const esc = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const count = (value: number) =>
  Math.round(value).toLocaleString("en-US");

export const plural = (value: number, one: string, many = `${one}s`) =>
  `${count(value)} ${Math.round(value) === 1 ? one : many}`;

/** A calendar day ("2026-11-10") in words, without a time zone shift. */
export const dayWords = (
  day: string,
  style: "long" | "short" | "month" = "long",
) =>
  new Date(`${day.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    ...(style === "month"
      ? { month: "short", day: "numeric" }
      : style === "short"
        ? { month: "short", day: "numeric", year: "numeric" }
        : { month: "long", day: "numeric", year: "numeric" }),
    timeZone: "UTC",
  });

const COLLEGE = 13;
/** A grade scale for a level chart: at least six grades around `center`,
 * widened to take in every range, so no band runs off it. */
export function gradeScale(
  center: number,
  ranges: readonly (readonly [number, number])[],
) {
  const low = Math.min(center - 3, ...ranges.map(([from]) => from));
  const high = Math.max(center + 3, ...ranges.map(([, to]) => to));
  const lo = Math.max(0, Math.min(Math.floor(low), COLLEGE - 6));
  const hi = Math.min(COLLEGE, Math.max(lo + 6, Math.ceil(high)));
  const at = (value: number) =>
    `${(((Math.min(hi, Math.max(lo, value)) - lo) / (hi - lo)) * 100).toFixed(3)}%`;
  const grades = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  return { lo, hi, at, grades };
}
export const gradeTick = (grade: number) => (grade === 0 ? "K" : String(grade));

/** The strand colors the app's map uses; two strands share another's ink. */
const STRAND_INK: Readonly<Record<string, string>> = {
  reasoning: "algebra",
  trigonometry: "geometry",
};
export const strandInk = (strand: string) =>
  `var(--color-strand-${STRAND_INK[strand] ?? strand}, var(--color-primary))`;

/** AMP's wave mark, from the app icon. */
export const MARK = `<svg class="mark" viewBox="40 100 432 312" aria-hidden="true"><path d="M56 256 C106 256 106 116 156 116 S206 396 256 396 S306 116 356 116 S406 256 456 256"/></svg>`;

/** The masthead every document opens with: the mark, what it is, a date. */
export const masthead = (kind: string, right: string) =>
  `<header class="mast"><span class="brand">${MARK}<span class="brandName">AMP</span><span class="brandKind">${esc(kind)}</span></span><span class="mastRight">${right}</span></header>`;

/** A QR code as one SVG path, from the qrcode package's module matrix. */
export function qrSvg(text: string, label: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const quiet = 2;
  // One rectangle per run of dark modules in a row: a class of cards stays
  // well under the render service's request limit.
  let d = "";
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      if (!qr.modules.get(row, col)) continue;
      let run = 1;
      while (col + run < size && qr.modules.get(row, col + run)) run++;
      d += `M${col + quiet} ${row + quiet}h${run}v1h-${run}z`;
      col += run - 1;
    }
  const full = size + quiet * 2;
  return `<svg class="qr" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges" role="img" aria-label="${esc(label)}"><rect width="${full}" height="${full}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

const BASE_CSS = `
* { box-sizing: border-box; }
:root { --ink: var(--color-on-surface); --muted: var(--color-muted-text); --rule: var(--color-border); --grid: var(--color-figure-grid); --rule-strong: var(--color-border-strong); --accent: var(--color-primary); }
html { font-family: "WB Reading", system-ui, sans-serif; font-size: 10.5pt; line-height: 1.45; color: var(--ink); background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-variant-numeric: tabular-nums; }
body { margin: 0; }
h1, h2, h3, p, dl, dd, ul, ol { margin: 0; }
ul, ol { padding: 0; list-style: none; }
.display, h1, h2 { font-family: "WB Display", Georgia, serif; font-variation-settings: "SOFT" 50, "WONK" 0; font-weight: 560; letter-spacing: -0.005em; }
.mast { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding-bottom: 6px; border-bottom: 2.5px solid var(--accent); }
.brand { display: inline-flex; align-items: center; gap: 8px; color: var(--accent); }
.mark { width: 0.42in; height: 0.3in; fill: none; stroke: currentColor; stroke-width: 34; stroke-linecap: round; }
.brandName { font-family: "WB Display", Georgia, serif; font-variation-settings: "SOFT" 50, "WONK" 0; font-size: 19pt; line-height: 1; font-weight: 700; }
.brandKind { margin-left: 4px; padding-left: 10px; border-left: 1px solid var(--rule-strong); font-size: 8.5pt; line-height: 1.2; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink); }
.mastRight { color: var(--muted); font-size: 9.5pt; text-align: right; }
.label { display: block; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.facts { display: flex; flex-wrap: wrap; gap: 0.08in 0.3in; }
.facts div { display: flex; flex-direction: column; min-width: 0; }
.facts dd { font-size: 10.5pt; font-weight: 700; }
.section { margin-top: 0.24in; break-inside: avoid; }
.sectionHead { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding-bottom: 5px; margin-bottom: 0.1in; border-bottom: 1.5px solid var(--accent); break-after: avoid; }
.sectionHead h2 { font-size: 15pt; line-height: 1.15; }
.sectionHead p { font-size: 9pt; color: var(--muted); text-align: right; }
.quiet { color: var(--muted); }
.note { font-size: 8.5pt; line-height: 1.45; color: var(--muted); }
`;

/** One printed document. `data-compose` makes the renderer wait until the
 * embedded type has loaded, so no page prints in a fallback face. */
export function printDocument({
  title,
  paper,
  css,
  body,
}: {
  title: string;
  paper: Paper;
  css: string;
  body: string;
}) {
  const size = paper === "A4" ? "A4" : "letter";
  return `<!doctype html><html lang="en" data-compose><head><meta charset="utf-8"><title>${esc(title)}</title><style>${printTokens()}${workbookFontCss(false)}@page { size: ${size}; margin: 0.5in 0.6in 0.62in; }${BASE_CSS}${css}</style></head><body>${body}<script>document.fonts.ready.then(function(){document.documentElement.dataset.layout="ready"},function(){document.documentElement.dataset.layout="error"})</script></body></html>`;
}

/** Chromium's page footer: its own small document with its own styles. The
 * left text is escaped here; the page numbers are Chromium's. */
export const pageFooter = (left: string) =>
  `<div style="box-sizing:border-box;width:100%;padding:0 0.6in;display:flex;justify-content:space-between;gap:16px;font-family:system-ui,sans-serif;font-size:7.5pt;color:#4c625b;"><span>${esc(left)}</span><span style="white-space:nowrap">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;

/** A report as a PDF, rendered for this request and never stored. Null when
 * the renderer is missing or failed; the failure is logged without the
 * document, and the route answers 503 in its own words. */
export async function renderReportPdf(
  renderer: WorkbookRenderer | null | undefined,
  page: { html: string; format: Paper; footer?: string },
  log: Pick<FastifyBaseLogger, "error" | "info">,
  what: string,
): Promise<Buffer | null> {
  const started = Date.now();
  try {
    if (!renderer) throw new Error("No PDF renderer configured");
    const pdf = await renderer.render(page);
    log.info(
      { durationMs: Date.now() - started, bytes: pdf.length },
      `${what} PDF rendered`,
    );
    return pdf;
  } catch (error) {
    log.error(
      {
        err: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - started,
      },
      `${what} PDF render failed`,
    );
    return null;
  }
}

/** A file name from a person's name: letters, digits and dashes only. */
export const fileName = (...parts: string[]) =>
  parts
    .join("-")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 80) || "amp";
