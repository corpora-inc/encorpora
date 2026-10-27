import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import type { Page } from "playwright";

type Size = { width: number; height: number };

/**
 * Viewport policy (founder decision 2026-10-19). The native app is
 * portrait-only on phones, so phone portrait and tablets in both orientations
 * are strict fit targets. A browser tab can still be rotated, so phone
 * landscape is a smoke target: the page stays usable and scrolls vertically,
 * but nothing has to fit without scrolling.
 */
export const PHONE_LANDSCAPE = { width: 844, height: 390 } as const;
export const TABLET_LANDSCAPE = { width: 1024, height: 768 } as const;
export const TABLET_LANDSCAPE_LARGE = { width: 1180, height: 820 } as const;
export const TABLET_PORTRAIT = { width: 768, height: 1024 } as const;
export const TABLET_PORTRAIT_LARGE = { width: 820, height: 1180 } as const;
/** iPad sizes in both orientations: strict practice targets. In landscape
 * the problem and the answer sit side by side (practice-tablet.css). */
export const TABLETS = [
  TABLET_LANDSCAPE,
  TABLET_LANDSCAPE_LARGE,
  TABLET_PORTRAIT,
  TABLET_PORTRAIT_LARGE,
] as const;
export function isTabletLandscape(size: Size): boolean {
  return size.width > size.height && size.width >= 900 && size.height >= 500;
}

/** Wider than tall and shorter than the smallest tablet in landscape. */
export function isPhoneLandscape(size: Size | readonly number[]): boolean {
  const [width, height] = Array.isArray(size)
    ? size
    : [(size as Size).width, (size as Size).height];
  return width > height && height < 500;
}

/**
 * Phone-landscape smoke check: no horizontal overflow, no two controls
 * overlapping, and every control reachable by scrolling, unclipped and not
 * covered by something else. Scroll positions are restored afterwards.
 */
export async function assertPhoneLandscapeSmoke(page: Page, label: string) {
  // tsx names inner functions with an esbuild helper the page lacks.
  await page.evaluate("globalThis.__name ??= (f) => f");
  // Let resize handlers commit the new viewport before measuring.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const problems = await page.evaluate(() => {
    const found: string[] = [];
    const width = innerWidth;
    const height = innerHeight;
    const overflow = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );
    if (overflow > width + 1)
      found.push(`horizontal overflow ${overflow}px > ${width}px`);
    const describe = (element: Element) => {
      const name =
        element.getAttribute("aria-label") ??
        (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      const classes =
        typeof element.className === "string" && element.className
          ? `.${element.className.trim().split(/\s+/).join(".")}`
          : "";
      return `<${element.tagName.toLowerCase()}${classes}> "${name}"`;
    };
    const scope =
      document.querySelector("dialog:modal, [aria-modal='true']") ??
      document.body;
    const controls = [
      ...scope.querySelectorAll<HTMLElement>(
        [
          "button",
          "a[href]",
          "input:not([type=hidden])",
          "select",
          "textarea",
          "summary",
          "[role=button]",
          "[role=tab]",
          "[role=option]",
          "[role=menuitem]",
          "[role=radio]",
          "[role=checkbox]",
          "[role=switch]",
          "[role=slider]",
        ].join(","),
      ),
    ].filter((element) => {
      if (element.closest("[hidden], [inert], [aria-hidden='true']"))
        return false;
      if (
        !element.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
        })
      )
        return false;
      const box = element.getBoundingClientRect();
      return box.width >= 2 && box.height >= 2;
    });
    const boxes = (element: HTMLElement) =>
      getComputedStyle(element).display === "inline"
        ? [...element.getClientRects()].filter((r) => r.width && r.height)
        : [element.getBoundingClientRect()];
    // Overlap is measured on what is visible now: each box is clipped by its
    // scroll containers, so content scrolled out of view does not count.
    const visibleBoxes = (element: HTMLElement) =>
      boxes(element)
        .map((box) => {
          let [left, top, right, bottom] = [
            box.left,
            box.top,
            box.right,
            box.bottom,
          ];
          for (
            let ancestor = element.parentElement;
            ancestor && ancestor !== document.body;
            ancestor = ancestor.parentElement
          ) {
            const style = getComputedStyle(ancestor);
            if (style.overflowX === "visible" && style.overflowY === "visible")
              continue;
            const clip = ancestor.getBoundingClientRect();
            left = Math.max(left, clip.left);
            top = Math.max(top, clip.top);
            right = Math.min(right, clip.right);
            bottom = Math.min(bottom, clip.bottom);
          }
          return { left, top, right, bottom };
        })
        .filter((b) => b.right - b.left > 1 && b.bottom - b.top > 1);
    const measured = controls.map((element) => ({
      element,
      boxes: visibleBoxes(element),
    }));
    for (let i = 0; i < measured.length; i++)
      for (let j = i + 1; j < measured.length; j++) {
        const a = measured[i]!,
          b = measured[j]!;
        if (a.element.contains(b.element) || b.element.contains(a.element))
          continue;
        const overlap = a.boxes.some((p) =>
          b.boxes.some(
            (q) =>
              Math.min(p.right, q.right) - Math.max(p.left, q.left) > 1 &&
              Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 1,
          ),
        );
        if (overlap)
          found.push(`${describe(a.element)} overlaps ${describe(b.element)}`);
      }
    // A non-scrolling ancestor that cuts a control off makes it unreachable;
    // so does a page that cannot scroll when a control lies past its edge.
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const pageLocked = (axis: "overflowX" | "overflowY") =>
      ["hidden", "clip"].includes(
        rootStyle[axis] === "visible" ? bodyStyle[axis] : rootStyle[axis],
      );
    const scrollsIn = (
      element: HTMLElement,
      axis: "overflowX" | "overflowY",
    ) => {
      for (
        let ancestor = element.parentElement;
        ancestor && ancestor !== document.body;
        ancestor = ancestor.parentElement
      )
        if (["auto", "scroll"].includes(getComputedStyle(ancestor)[axis]))
          return ancestor;
      return element;
    };
    for (const element of controls) {
      const outerY = scrollsIn(element, "overflowY").getBoundingClientRect();
      const outerX = scrollsIn(element, "overflowX").getBoundingClientRect();
      if (
        (pageLocked("overflowY") &&
          (outerY.bottom > height + 1 || outerY.top < -1)) ||
        (pageLocked("overflowX") &&
          (outerX.right > width + 1 || outerX.left < -1))
      ) {
        found.push(
          `${describe(element)} lies outside a page that cannot scroll (${[outerX.left, outerY.top, outerX.right, outerY.bottom].map(Math.round).join(",")} in ${width}×${height})`,
        );
        continue;
      }
    }
    // Every control can be scrolled into view and is the thing a tap there hits.
    const scrollers = [
      document.scrollingElement!,
      ...document.querySelectorAll("*"),
    ]
      .filter(
        (element) =>
          element.scrollHeight > element.clientHeight ||
          element.scrollWidth > element.clientWidth,
      )
      .map((element) => ({
        element,
        top: element.scrollTop,
        left: element.scrollLeft,
      }));
    for (const element of controls) {
      element.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "instant",
      });
      // scrollIntoView can also scroll overflow:hidden containers, which a
      // pointer user cannot scroll. Restore those axes before measuring.
      for (const { element: scroller, top, left } of scrollers) {
        const style = getComputedStyle(scroller);
        if (["hidden", "clip"].includes(style.overflowY))
          scroller.scrollTop = top;
        if (["hidden", "clip"].includes(style.overflowX))
          scroller.scrollLeft = left;
      }
      const box = boxes(element)[0]!;
      // Check clipping after scrolling: a nested scroll area can reveal a
      // control that initially lies outside an outer dialog clip.
      for (
        let ancestor = element.parentElement;
        ancestor && ancestor !== document.body;
        ancestor = ancestor.parentElement
      ) {
        const style = getComputedStyle(ancestor);
        const clip = ancestor.getBoundingClientRect();
        const clipsX = ["hidden", "clip"].includes(style.overflowX);
        const clipsY = ["hidden", "clip"].includes(style.overflowY);
        if (
          (clipsX &&
            (box.left < clip.left - 1 || box.right > clip.right + 1)) ||
          (clipsY && (box.top < clip.top - 1 || box.bottom > clip.bottom + 1))
        ) {
          found.push(
            `${describe(element)} is clipped by ${describe(ancestor)}`,
          );
          break;
        }
      }
      const left = Math.max(box.left, 0),
        right = Math.min(box.right, width),
        top = Math.max(box.top, 0),
        bottom = Math.min(box.bottom, height);
      if (right - left < 1 || bottom - top < 1) {
        found.push(`${describe(element)} cannot be scrolled into view`);
        continue;
      }
      const hit = document.elementFromPoint(
        (left + right) / 2,
        (top + bottom) / 2,
      );
      if (!hit || !(element === hit || element.contains(hit)))
        found.push(
          `${describe(element)} is covered by ${hit ? describe(hit) : "nothing"}`,
        );
    }
    for (const { element, top, left } of scrollers)
      element.scrollTo({ top, left, behavior: "instant" });
    return found;
  });
  if (problems.length) {
    const name = label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    await mkdir("artifacts/screenshots", { recursive: true });
    await page.screenshot({
      path: `artifacts/screenshots/phone-landscape-failure-${name}.png`,
    });
  }
  assert.deepEqual(
    problems,
    [],
    `${label} is unusable in phone landscape:\n${problems.join("\n")}`,
  );
}

/**
 * Real phone browser viewports, with the browser's own bars showing. Each is a
 * strict practice target: the problem fits or scrolls cleanly, never clipped.
 */
export const PHONE_ANDROID_CHROME = { width: 384, height: 700 } as const;
export const PHONE_IPHONE_SE = { width: 375, height: 667 } as const;
export const PHONE_SMALL_ANDROID = { width: 360, height: 640 } as const;
export const PHONE_REAL_BROWSERS = [
  PHONE_ANDROID_CHROME,
  PHONE_IPHONE_SE,
  PHONE_SMALL_ANDROID,
] as const;

/**
 * The practice problem is reachable: content may scroll inside the problem
 * stage, but nothing may be clipped where no scrolling reaches it.
 *
 * - The prompt's first line sits at or below the stage's scroll origin (an
 *   overflow above that origin can never be scrolled to).
 * - The prompt and every figure lie inside the stage's vertical scroll range
 *   and its width, and no non-scrolling box between them and the stage cuts
 *   them off.
 * - The stage and the answer dock do not overlap (the dock sits below the
 *   stage, or beside it in two-column landscape), and the dock is wholly on
 *   screen.
 * - Neither the page nor the stage overflows horizontally.
 *
 * Returns the stage's scroll geometry for reporting.
 */
export async function assertProblemReachable(page: Page, label: string) {
  await page.evaluate("globalThis.__name ??= (f) => f");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const result = await page.evaluate(() => {
    const found: string[] = [];
    const stage = document.querySelector<HTMLElement>(".problem-stage")!;
    const surface = stage.closest<HTMLElement>(".practice-surface");
    const dock = surface?.querySelector<HTMLElement>(":scope > .answer-dock");
    const saved = stage.scrollTop;
    stage.scrollTop = 0;
    const s = stage.getBoundingClientRect();
    const top = s.top + stage.clientTop;
    const bottom = top + stage.scrollHeight;
    const left = s.left + stage.clientLeft;
    const right = left + stage.clientWidth;
    const name = (e: Element) =>
      `<${e.tagName.toLowerCase()}${typeof e.className === "string" && e.className ? `.${e.className.trim().split(/\s+/).join(".")}` : ""}>`;
    const question = stage.querySelector(".question");
    const content = stage.querySelector(".problem-content");
    if (!question || !content) found.push("no prompt in the problem stage");
    else {
      const q = question.getBoundingClientRect();
      if (q.top < top - 1)
        found.push(
          `prompt starts ${Math.round(top - q.top)}px above the scroll origin`,
        );
      const parts = [
        question,
        ...content.children,
        ...content.querySelectorAll("svg:not(svg svg), table, img, canvas"),
      ];
      for (const part of new Set(parts)) {
        const b = part.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) continue;
        if (b.top < top - 1 || b.bottom > bottom + 1)
          found.push(
            `${name(part)} spans ${Math.round(b.top - top)}..${Math.round(b.bottom - top)} outside the stage's scroll range 0..${Math.round(bottom - top)}`,
          );
        if (b.left < left - 1 || b.right > right + 1)
          found.push(
            `${name(part)} spans ${Math.round(b.left - left)}..${Math.round(b.right - left)} outside the stage width ${Math.round(right - left)}`,
          );
        for (
          let a = part.parentElement;
          a && a !== stage;
          a = a.parentElement
        ) {
          const style = getComputedStyle(a);
          const clip = a.getBoundingClientRect();
          const cutY =
            ["hidden", "clip"].includes(style.overflowY) &&
            (b.top < clip.top - 1 || b.bottom > clip.bottom + 1);
          const cutX =
            ["hidden", "clip"].includes(style.overflowX) &&
            (b.left < clip.left - 1 || b.right > clip.right + 1);
          if (cutY || cutX) {
            found.push(`${name(part)} is clipped by ${name(a)}`);
            break;
          }
        }
      }
    }
    if (stage.scrollWidth > stage.clientWidth + 1)
      found.push(
        `stage overflows horizontally ${stage.scrollWidth} > ${stage.clientWidth}`,
      );
    if (document.documentElement.scrollWidth > innerWidth)
      found.push(
        `page overflows horizontally ${document.documentElement.scrollWidth} > ${innerWidth}`,
      );
    if (dock) {
      const d = dock.getBoundingClientRect();
      const across = Math.min(s.right, d.right) - Math.max(s.left, d.left);
      const down = Math.min(s.bottom, d.bottom) - Math.max(s.top, d.top);
      if (across > 1 && down > 1)
        found.push(
          `stage overlaps the dock by ${Math.round(across)}×${Math.round(down)}px`,
        );
      if (d.bottom > innerHeight + 1 || d.top < 0)
        found.push(
          `answer dock ${Math.round(d.top)}..${Math.round(d.bottom)} is off a ${innerHeight}px screen`,
        );
    }
    if (s.top < 0)
      found.push(`stage starts ${Math.round(-s.top)}px off screen`);
    const geometry = {
      height: stage.clientHeight,
      scroll: stage.scrollHeight,
      at: saved,
    };
    stage.scrollTop = saved;
    return { found, geometry };
  });
  if (result.found.length) {
    const name = label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    await mkdir("artifacts/screenshots", { recursive: true });
    await page.screenshot({
      path: `artifacts/screenshots/unreachable-${name}.png`,
    });
  }
  assert.deepEqual(
    result.found,
    [],
    `${label}: part of the problem cannot be reached\n${result.found.join("\n")}`,
  );
  if (await page.locator(".answer-editor").count())
    await assertPhoneLandscapeSmoke(page, `${label}: answer editor`);
  return result.geometry;
}

/**
 * The whole problem is in view with no scrolling: the stage does not scroll,
 * and the prompt and every figure lie inside its visible box. Returns the
 * reasons it is not, empty when it is.
 */
export async function problemInView(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".problem-stage")!;
    const found: string[] = [];
    if (stage.scrollHeight > stage.clientHeight + 1)
      found.push(
        `stage scrolls ${stage.scrollHeight - stage.clientHeight}px (${stage.scrollHeight} > ${stage.clientHeight})`,
      );
    const s = stage.getBoundingClientRect();
    const content = stage.querySelector(".problem-content");
    // A box-less wrapper (display: contents) is read through its figure.
    const parts = content
      ? [...content.children, ...content.querySelectorAll("svg:not(svg svg)")]
      : [];
    for (const part of new Set(parts)) {
      const b = part.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      if (b.top < s.top - 1 || b.bottom > s.bottom + 1)
        found.push(
          `<${part.tagName.toLowerCase()}.${part.classList[0] ?? ""}> spans ${Math.round(b.top - s.top)}..${Math.round(b.bottom - s.top)} of a ${Math.round(s.height)}px stage`,
        );
    }
    return found;
  });
}

/** On-screen sizes, in CSS px, of the prompt and of the practice figure's
 * labels (through every SVG transform). */
export async function figureTextScale(page: Page) {
  return page.evaluate(() => {
    const prompt = Number.parseFloat(
      getComputedStyle(document.querySelector(".problem-content .question")!)
        .fontSize,
    );
    const labels = [
      ...document.querySelectorAll<SVGTextElement>(
        ".problem-content svg text, .answer-editor svg text",
      ),
    ]
      .filter((t) => t.textContent?.trim() && t.getBBox().width > 0)
      .map((t) => {
        const m = t.getScreenCTM()!;
        return {
          text: t.textContent!,
          size:
            Number.parseFloat(getComputedStyle(t).fontSize) *
            Math.hypot(m.c, m.d),
        };
      });
    return { prompt, labels };
  });
}
/** Figure text stays within the figure type sizes (`cap`) and, where
 * `belowPrompt`, under the prompt. A figure whose labels span a wide range
 * of sizes may exceed the cap only by keeping its smallest label at the
 * legible floor. */
export function assertFigureTextScale(
  scale: Awaited<ReturnType<typeof figureTextScale>>,
  label: string,
  cap: number,
  belowPrompt = true,
) {
  if (!scale.labels.length) return;
  const sizes = scale.labels.map((l) => l.size),
    limit = belowPrompt ? Math.min(cap, scale.prompt) : cap,
    floorBound = Math.min(...sizes) <= 12.25;
  const over = scale.labels.filter((l) => l.size > limit + 0.1);
  assert.ok(
    floorBound || !over.length,
    `${label}: figure text exceeds ${limit.toFixed(1)} px (prompt ${scale.prompt.toFixed(1)} px): ${over
      .map((l) => `${l.text} ${l.size.toFixed(1)}`)
      .join(", ")}`,
  );
}
