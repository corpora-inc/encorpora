/**
 * Shared by `workbook-samples.ts` and `verify-workbook-layout.ts`: a sample
 * workbook for a synthetic learner, and the layout checks every composed
 * page must pass (see docs/daily-workbooks.md, Checks).
 */
import type { Page } from "playwright";
import { skills } from "../src/curriculum/catalog";
import { lessons } from "../src/content/lessons";
import { templates } from "../src/math/engine";
import {
  composeWorkbook,
  workbookCode,
  type WorkbookMinutes,
  type WorkbookSpec,
} from "../src/workbook/compose";
import { workbookHtml, type PaperSize } from "../src/workbook/render";
import {
  simulateLearner,
  type SyntheticLearner,
} from "../src/workbook/synthetic";

const now = Date.parse("2026-10-31T13:00:00Z");
export const skillTitle = (id: string) =>
  skills.find((s) => s.id === id)?.title ?? id;

/** The sample workbook a synthetic learner gets on 2026-10-31. */
export function sampleWorkbook(
  learner: SyntheticLearner,
  minutes: WorkbookMinutes,
  paper: PaperSize,
): { spec: WorkbookSpec; html: string; level: number } {
  const { frontier, evidence, attempts } = simulateLearner(learner, now);
  const spec = composeWorkbook({
    templates,
    skills,
    lessons,
    frontier,
    evidence,
    recentTemplateIds: attempts.slice(-12).map((a) => a.templateId),
    date: "2026-10-31",
    minutes,
    learnerKey: learner.id,
    now,
  });
  const html = workbookHtml(spec, {
    lessons,
    skillTitle,
    paper,
    results: {
      baseUrl: "https://amp.corpora.inc",
      learnerId: `sample-${learner.id}`,
      workbookId: workbookCode(spec),
    },
  });
  return { spec, html, level: frontier.overall.level };
}

/** Layout checks on the composed pages; every list must come back empty. */
export async function checkWorkbookLayout(page: Page) {
  // tsx names arrow functions with a helper the page does not have.
  await page.evaluate("window.__name = (f) => f");
  return page.evaluate(() => {
    const label = (el: Element) =>
      el
        .closest(".wb-item, .wb-lesson, .wb-key-item, .wb-block, .wb-row")
        ?.querySelector("h2, h3, p")
        ?.textContent?.slice(0, 60) ?? el.className.toString().slice(0, 40);
    const pages = [...document.querySelectorAll<HTMLElement>(".wb-page")];
    const overflow: string[] = [];
    const wide: string[] = [];
    const orphans: string[] = [];
    const holes: string[] = [];
    const mixed: string[] = [];
    const students = pages.filter((p) =>
      p.classList.contains("wb-page--student"),
    );
    pages.forEach((p, i) => {
      const n = i + 1;
      const body = p.querySelector(".wb-page-body")!.getBoundingClientRect();
      const content = p
        .querySelector(".wb-page-content")!
        .getBoundingClientRect();
      if (content.height > body.height + 1)
        overflow.push(
          `page ${n}: ${Math.round(content.height - body.height)}px`,
        );
      for (const el of p.querySelectorAll(".wb-page-content *")) {
        if (el.parentElement?.closest("svg")) continue;
        const box = el.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;
        const column = el.closest(".wb-item, .wb-key-col, .wb-tile");
        const limit = column
          ? column.getBoundingClientRect().right
          : body.right;
        if (box.right > limit + 2 || box.right > body.right + 1)
          wide.push(`page ${n}: ${el.tagName} in ${label(el)}`);
        if (box.bottom > body.bottom + 1 && el.matches(".wb-item, .wb-row"))
          overflow.push(`page ${n}: split ${label(el)}`);
      }
      const last = p.querySelector(".wb-page-content")!.lastElementChild;
      if (last?.matches(".wb-section-head"))
        orphans.push(`page ${n}: ${last.textContent?.slice(0, 40)}`);
      for (const col of p.querySelectorAll(".wb-key-col"))
        if (col.lastElementChild?.matches(".wb-key-section"))
          orphans.push(
            `page ${n}: key label ${col.lastElementChild.textContent}`,
          );
      const student = p.classList.contains("wb-page--student");
      if (student && p.querySelector(".wb-key-item, .wb-tile"))
        mixed.push(`page ${n}: key or results on a student page`);
      if (!student && p.querySelector(".wb-item"))
        mixed.push(`page ${n}: problem on a key page`);
      if (student && i > students.length - 1)
        mixed.push(`page ${n}: student page after the key`);
      if (student && p !== students.at(-1)) {
        const fill = content.height / body.height;
        if (fill < 0.9)
          holes.push(`page ${n}: ${Math.round(fill * 100)}% full`);
      }
    });
    // Contrast in the page's own colours, which is also its grayscale contrast.
    const rgb = (c: string) => {
      const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
      return { r: m[0]!, g: m[1]!, b: m[2]!, a: m[3] ?? 1 };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const background = (el: Element | null) => {
      for (; el; el = el.parentElement) {
        const c = rgb(getComputedStyle(el).backgroundColor);
        if (c.a > 0.5) return c;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    const contrast: string[] = [];
    for (const el of document.querySelectorAll(".wb-page *")) {
      if (el.closest("svg")) continue;
      const own = [...el.childNodes].some(
        (c) => c.nodeType === 3 && c.textContent!.trim(),
      );
      const pseudo = getComputedStyle(el, "::before").content;
      if (!own && !(pseudo && pseudo !== "none" && pseudo !== "normal"))
        continue;
      const style = getComputedStyle(el);
      const fg = lum(rgb(style.color));
      const bg = lum(background(el));
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      const size = parseFloat(style.fontSize);
      const large =
        size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5))
        contrast.push(
          `${ratio.toFixed(2)} ${el.tagName}: ${el.textContent?.slice(0, 30)}`,
        );
    }
    // A word broken across two lines (a label too narrow for its text).
    const midword: string[] = [];
    const walker = document.createTreeWalker(
      document.querySelector(".wb-pages") ?? document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest("svg, .katex")) continue;
      const text = node.textContent ?? "";
      for (const m of text.matchAll(/[^\s\-–—/]{2,}/g)) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const tops = new Set(
          [...range.getClientRects()]
            .filter((r) => r.width > 0)
            .map((r) => Math.round(r.top)),
        );
        if (tops.size > 1) midword.push(m[0]);
      }
    }
    // A shape painted the browser's default black lost its figure styles.
    const unstyled = [
      ...document.querySelectorAll(
        ".wb-page svg rect, .wb-page svg path, .wb-page svg circle, .wb-page svg polygon, .wb-page svg ellipse",
      ),
    ]
      .filter((el) => {
        if (el.closest(".wb-qr, .katex")) return false;
        const box = el.getBoundingClientRect();
        if (
          getComputedStyle(el).fill !== "rgb(0, 0, 0)" ||
          box.width * box.height <= 300
        )
          return false;
        const shape = el as SVGGeometryElement;
        const b = shape.getBBox();
        return [0.25, 0.5, 0.75].some((fx) =>
          [0.25, 0.5, 0.75].some((fy) =>
            shape.isPointInFill(
              new DOMPoint(b.x + b.width * fx, b.y + b.height * fy),
            ),
          ),
        );
      })
      .map(label);
    // The lesson card shares a page with its guided problems when they fit.
    const lessonPages = new Set(
      [...document.querySelectorAll('[data-group="lesson"]')].map((el) =>
        el.closest(".wb-page")?.getAttribute("data-page"),
      ),
    );
    return {
      pages: pages.length,
      studentPages: students.length,
      lessonPages: lessonPages.size,
      overflow,
      wide: [...new Set(wide)].slice(0, 10),
      orphans,
      holes,
      mixed,
      contrast: [...new Set(contrast)].slice(0, 10),
      midword: [...new Set(midword)].slice(0, 10),
      unstyled: [...new Set(unstyled)],
    };
  });
}

export const pageCount = (bytes: Buffer) =>
  (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

/** Every problem the checks found, plus a PDF whose page count differs from
 * the composed pages (something spilled onto an extra page). */
export function layoutFailures(
  found: Awaited<ReturnType<typeof checkWorkbookLayout>>,
  pdf?: Buffer,
): string[] {
  const printed = pdf ? pageCount(pdf) : found.pages;
  return [
    ...found.overflow,
    ...found.wide,
    ...found.orphans,
    ...found.holes,
    ...found.mixed,
    ...found.contrast,
    ...found.midword.map((w) => `word broken across lines: ${w}`),
    ...found.unstyled.map((u) => `unstyled figure shape: ${u}`),
    ...(printed === found.pages
      ? []
      : [`PDF has ${printed} pages, layout composed ${found.pages}`]),
  ];
}
