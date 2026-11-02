/**
 * Shared by `workbook-samples.ts` and `verify-workbook-layout.ts`: a sample
 * workbook for a synthetic learner, and the layout checks every composed
 * page must pass (see docs/daily-workbooks.md, Checks).
 */
import type { Page } from "playwright";
import { skills } from "../src/curriculum/catalog";
import { lessons } from "../src/content/lessons";
import { templates } from "../src/math/engine";
import { templateGrade } from "../src/server/mixed-practice";
import {
  composeWorkbook,
  printable,
  workbookCode,
  type WorkbookMinutes,
  type WorkbookSpec,
} from "../src/workbook/compose";
import { workbookHtml, type PaperSize } from "../src/workbook/render";
import { resultLabel } from "../src/workbook/result-labels";
import {
  sampleLearners,
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
        if (el.parentElement?.closest("svg, .katex-mathml")) continue;
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
    // Answers sit on plain paper: no tinted fill behind an answer box or its
    // label, inside the box, or anywhere up to the problem, and the workspace
    // grid ends above the answer row instead of being masked.
    const tinted: string[] = [];
    for (const answer of document.querySelectorAll(".wb-answer")) {
      const item = answer.closest(".wb-item")!;
      const chain = [
        answer.querySelector(".wb-answer-box")!,
        answer.querySelector(".wb-answer-label")!,
        answer,
      ];
      for (
        let el = answer.parentElement;
        el && el !== item;
        el = el.parentElement
      )
        chain.push(el);
      for (const el of chain) {
        const style = getComputedStyle(el);
        const c = rgb(style.backgroundColor);
        const white = c.r === 255 && c.g === 255 && c.b === 255;
        if (
          (c.a > 0 && !white) ||
          (el !== answer.parentElement && style.backgroundImage !== "none")
        )
          tinted.push(`${label(el)}: ${el.className} ${style.backgroundColor}`);
      }
      const grid = answer.parentElement?.querySelector(".wb-work-grid");
      if (
        grid &&
        grid.getBoundingClientRect().bottom >
          answer.getBoundingClientRect().top + 0.5
      )
        tinted.push(`${label(answer)}: grid runs under the answer`);
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
      tinted: [...new Set(tinted)].slice(0, 10),
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
    ...found.tinted.map((t) => `answer on a tint: ${t}`),
    ...found.midword.map((w) => `word broken across lines: ${w}`),
    ...found.unstyled.map((u) => `unstyled figure shape: ${u}`),
    ...(printed === found.pages
      ? []
      : [`PDF has ${printed} pages, layout composed ${found.pages}`]),
  ];
}

/** A small seeded generator (mulberry32), so a failing sweep reproduces
 * from the seed it prints. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Synthetic learners from kindergarten to precalculus for the sweep: the
 * samples, plus a grade 4–5 learner and a grade 10 geometry learner. */
export const sweepLearners: readonly SyntheticLearner[] = [
  ...sampleLearners,
  { id: "grade-4-5", birthYear: 2016, ability: 4.6, days: 14, perDay: 18 },
  { id: "geometry-10", birthYear: 2011, ability: 10.4, days: 14, perDay: 18 },
];

export interface SweepCase {
  label: string;
  spec: WorkbookSpec;
  paper: PaperSize;
}

/** Random compositions: learners from K to precalculus, any date and
 * number, every length and both paper sizes, with the whole catalog, a few
 * strands or one course (gradeBand) as the template pool. 60 minutes is
 * drawn most often, because the longest workbooks have the most problems. */
export function sweepCases(seed: number, count: number): SweepCase[] {
  const random = seededRandom(seed);
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(random() * list.length)]!;
  const simulated = new Map(
    sweepLearners.map((l) => [l.id, simulateLearner(l, now)]),
  );
  const strandOf = new Map(skills.map((s) => [s.id, s.strand]));
  const skillNodes = new Map(skills.map((s) => [s.id, s]));
  const strands = [...new Set(skills.map((s) => s.strand))];
  const courses = [...new Set(skills.map((s) => String(s.gradeBand)))];
  const courseOf = new Map(skills.map((s) => [s.id, String(s.gradeBand)]));
  const cases: SweepCase[] = [];
  for (
    let attempt = 0;
    cases.length < count && attempt < count * 4;
    attempt++
  ) {
    const learner = pick(sweepLearners);
    const minutes = pick([30, 45, 60, 60] as const);
    const paper = pick(["letter", "a4"] as const);
    const date = new Date(
      Date.parse("2026-11-01T00:00:00Z") +
        Math.floor(random() * 240) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    const number = 1 + Math.floor(random() * 999);
    const filter = random();
    let pool = templates;
    let scope = "all";
    // Courses and strands with work near the learner's level, as a parent
    // would choose them.
    const near = templates.filter(
      (t) =>
        Math.abs(
          templateGrade(t, skillNodes) - Math.max(learner.ability, 0.5),
        ) <= 1.5,
    );
    const nearCourses = courses.filter((c) =>
      near.some((t) => courseOf.get(t.skillId) === c),
    );
    const nearStrands = strands.filter((st) =>
      near.some((t) => strandOf.get(t.skillId) === st),
    );
    if (filter > 0.75) {
      const course = pick(nearCourses);
      pool = templates.filter((t) => courseOf.get(t.skillId) === course);
      scope = `course ${course}`;
    } else if (filter > 0.5) {
      const chosen = new Set(
        Array.from({ length: 1 + Math.floor(random() * 3) }, () =>
          pick(nearStrands),
        ),
      );
      pool = templates.filter((t) => chosen.has(strandOf.get(t.skillId)!));
      scope = `strands ${[...chosen].join("+")}`;
    }
    const { frontier, evidence, attempts } = simulated.get(learner.id)!;
    let spec: WorkbookSpec;
    try {
      spec = composeWorkbook({
        templates: pool,
        skills,
        lessons,
        frontier,
        evidence,
        recentTemplateIds: attempts.slice(-12).map((a) => a.templateId),
        date,
        number,
        minutes,
        learnerKey: learner.id,
        now,
      });
    } catch (error) {
      // A pool with nothing printable is not a composition; anything else is.
      if (String(error).includes("No printable templates")) continue;
      throw error;
    }
    cases.push({
      label: `${learner.id} ${minutes} min ${paper} ${date} #${number} ${scope}`,
      spec,
      paper,
    });
  }
  return cases;
}

/** The most demanding results page the composer can produce at a level:
 * every section at its largest (a 60-minute workbook: 8 warm-up, 3 guided,
 * 14 practice, 4 review, 1 challenge) and the longest result labels. */
export function largestResultsSpec(level: number): WorkbookSpec {
  const longest = templates
    .filter((t) => printable(t))
    .sort(
      (a, b) =>
        resultLabel(b.id).length - resultLabel(a.id).length ||
        a.id.localeCompare(b.id),
    );
  let next = 0;
  const items = (count: number) =>
    Array.from({ length: count }, () => {
      const t = longest[next++]!;
      return {
        templateId: t.id,
        templateVersion: t.version,
        seed: `largest:${t.id}`,
        skillId: t.skillId,
        strand: t.skillId,
        grade: level,
        minutes: 2,
        space: "standard" as const,
      };
    });
  return {
    version: 1,
    date: "2026-11-02",
    number: 999,
    minutes: 60,
    level,
    sections: [
      { kind: "warm-up", items: items(8) },
      { kind: "lesson", items: items(3) },
      { kind: "practice", items: items(14) },
      { kind: "review", items: items(4) },
      { kind: "challenge", items: items(1) },
    ],
  };
}
