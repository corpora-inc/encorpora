/** Independent regression for actual app CSS and punctuation at narrow widths. */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { PrintMathText, printMathStyles } from "../src/content/PrintMathText";
import {
  RightTriangleOrientation,
  PythagoreanRearrangement,
} from "../src/content/RightTriangleIllustration";
import { printMathCss } from "../src/content/print-fonts";
import { segmentPrintText } from "../src/content/math-typesetting";

const out =
  process.env.READER_REVIEW_OUT ?? "/tmp/amp-reader-typesetting-review";
mkdirSync(out, { recursive: true });
const fixtures = [
  "x² = 169 − 25 = 144.",
  "x = √144 = 12, since 12 × 12 = 144.",
  "12² + 5² = 144 + 25 = 169 = 13². The leg 12 cm is shorter than the hypotenuse 13 cm.",
  "Compare x = 7/12; then x = 1/2: is x = 3/4?",
  "The value is x = 1/2!",
  "Price $5; compute $x^2$.",
  "A costs $4 each; B costs $3/m.",
  "200 cm + 35 cm = 235 cm.",
  "Unsupported \\(\\unknowncommand\\).",
];
const css = [
  readFileSync(new URL("../src/web/style.css", import.meta.url), "utf8"),
  readFileSync(new URL("../src/web/practice.css", import.meta.url), "utf8"),
  printMathCss(),
  readFileSync(new URL("../src/web/theme.css", import.meta.url), "utf8"),
  printMathStyles,
  ".lesson-reader .worked-example li{padding:5px 0;line-height:1.6}",
].join("\n");
const e = React.createElement;
const content = renderToStaticMarkup(
  e(
    "div",
    { className: "shell app-shell flow" },
    e(
      "main",
      { className: "library-main" },
      e(
        "article",
        { className: "card lesson-reader" },
        e(RightTriangleOrientation),
        e(PythagoreanRearrangement),
        e(
          "section",
          { className: "worked-example" },
          e(
            "ol",
            null,
            fixtures.map((text, index) =>
              e(
                "li",
                { key: index, "data-fixture": index },
                e(PrintMathText, { text }),
              ),
            ),
          ),
        ),
      ),
    ),
  ),
);
const browser = await chromium.launch();
const page = await browser.newPage();
const requests: string[] = [];
await page.route(/^https?:/, async (route) => {
  requests.push(route.request().url());
  await route.abort();
});
const results: unknown[] = [];
try {
  for (const width of [320, 390, 844]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    await page.setContent(
      `<!doctype html><html><head><style>${css}</style></head><body>${content}</body></html>`,
    );
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate((fixtures) => {
      const errors: string[] = [];
      if (document.documentElement.scrollWidth > innerWidth + 1)
        errors.push("horizontal document overflow");
      const labels = [
        ...document.querySelectorAll<SVGTextElement>(
          "svg[data-lesson-illustration] text",
        ),
      ].map((label) => {
        const svg = label.ownerSVGElement!;
        const box = label.getBoundingClientRect();
        const bound = svg.getBoundingClientRect();
        const font = parseFloat(getComputedStyle(label).fontSize);
        const scale = label.getScreenCTM()!;
        const renderedPx = font * Math.hypot(scale.a, scale.b);
        const expectedFont = svg.dataset.lessonIllustration?.startsWith(
          "right-triangle-orientation",
        )
          ? 24
          : 21;
        if (font < expectedFont || renderedPx < 14)
          errors.push(
            `small authored label: ${label.textContent} (${font}px / ${renderedPx}px rendered)`,
          );
        if (
          box.left < bound.left - 1 ||
          box.right > bound.right + 1 ||
          box.top < bound.top - 1 ||
          box.bottom > bound.bottom + 1
        )
          errors.push(`clipped label: ${label.textContent}`);
        return { text: label.textContent, font, renderedPx };
      });
      const examples = [
        ...document.querySelectorAll<HTMLElement>("[data-fixture]"),
      ].map((root, index) => {
        const copy = root.cloneNode(true) as HTMLElement;
        for (const rendered of copy.querySelectorAll(".katex")) {
          const plain =
            rendered.closest<HTMLElement>("[data-plain]")?.dataset.plain;
          if (plain === undefined)
            errors.push(`missing original text: fixture ${index}`);
          rendered.replaceWith(plain ?? "");
        }
        // data-plain preserves original delimiters as well as mathematical text.
        const expected = fixtures[index];
        if (copy.textContent !== expected)
          errors.push(
            `source text changed: fixture ${index}: ${copy.textContent}`,
          );
        const bound = root.getBoundingClientRect();
        for (const math of root.querySelectorAll<HTMLElement>(".print-math")) {
          const r = math.getBoundingClientRect();
          if (r.left < bound.left - 1 || r.right > bound.right + 1)
            errors.push(`formula overflow: fixture ${index}`);
        }
        let checked = 0;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (node.parentElement?.closest(".katex")) continue;
          const value = node.textContent ?? "";
          if (!/^[.,;:!?]/.test(value)) continue;
          // The last KaTeX before this punctuation must share its final line.
          const preceding = [
            ...root.querySelectorAll<HTMLElement>(".katex"),
          ].filter((math) =>
            Boolean(
              math.compareDocumentPosition(node!) &
              Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          );
          const math = preceding.at(-1);
          if (!math) continue;
          const bases = math.querySelectorAll<HTMLElement>(
            ".katex-html > .base",
          );
          const last = bases[bases.length - 1];
          if (!last) {
            errors.push(`missing visible math base: fixture ${index}`);
            continue;
          }
          const range = document.createRange();
          range.setStart(node, 0);
          range.setEnd(node, 1);
          const p = range.getBoundingClientRect(),
            m = last.getBoundingClientRect();
          if (p.top >= m.bottom - 1 || p.bottom <= m.top + 1)
            errors.push(`detached punctuation: fixture ${index} '${value[0]}'`);
          if (p.left - m.right > 4 || p.left < m.right - 2)
            errors.push(
              `punctuation separated from final mathematical term: fixture ${index}, gap ${p.left - m.right}px`,
            );
          checked++;
        }
        return {
          index,
          checkedPunctuation: checked,
          annotations: [...root.querySelectorAll("math annotation")].map(
            (a) => a.textContent,
          ),
        };
      });
      return { width: innerWidth, labels, examples, errors };
    }, fixtures);
    results.push(result);
    await page.screenshot({
      path: `${out}/reader-${width}.png`,
      fullPage: true,
    });
    assert.deepEqual(result.errors, [], `reader width ${width}`);
    assert.equal(result.labels.length, 22);
    for (const example of result.examples) {
      const expected =
        example.index === 8
          ? []
          : segmentPrintText(fixtures[example.index])
              .filter((segment) => segment.kind === "math")
              .map((segment) => `\\displaystyle ${segment.tex}`);
      assert.deepEqual(
        example.annotations,
        expected,
        "MathML retains original mathematical expression",
      );
    }
    assert.ok(
      result.examples
        .slice(0, 5)
        .every((example) => example.checkedPunctuation > 0),
    );
  }
  // The known old font regression must be observable under these exact styles.
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addStyleTag({
    content:
      "svg[data-lesson-illustration] text { font:18px system-ui !important; }",
  });
  assert.ok(
    await page
      .locator("svg[data-lesson-illustration] text")
      .first()
      .evaluate(
        (label) =>
          parseFloat(getComputedStyle(label).fontSize) *
            (label as SVGTextElement).getScreenCTM()!.a <
          14,
      ),
  );
  // The first attempted repair glued punctuation to the whole multiline box,
  // leaving a large gap after its shorter final line. Reject that layout too.
  await page.addStyleTag({
    content:
      ".print-math-punctuation>.print-math{display:inline-block!important}.print-math-punctuation .katex-html>.base:last-child{display:inline-block!important}",
  });
  const brokenGap = await page
    .locator('[data-fixture="0"] .print-math-punctuation')
    .evaluate((wrapper) => {
      const punctuation = wrapper.lastChild!;
      const range = document.createRange();
      range.setStart(punctuation, 0);
      range.setEnd(punctuation, 1);
      const finalTerm = wrapper.querySelector(
        ".katex-html > .base:last-child",
      )!;
      return (
        range.getBoundingClientRect().left -
        finalTerm.getBoundingClientRect().right
      );
    });
  assert.ok(brokenGap > 4, "multiline punctuation-gap mutation must fail");
  // Verify the real KaTeX font was loaded, rather than a fallback width.
  assert.equal(
    await page.evaluate(() =>
      [...document.fonts].some((font) => font.status === "error"),
    ),
    false,
  );
  assert.deepEqual(
    requests,
    [],
    "self-contained static verification makes no network requests",
  );
  console.log(
    JSON.stringify({
      viewports: 3,
      labelChecks: 66,
      fixtures: fixtures.length,
      rejectedLayoutMutations: 2,
      networkRequests: requests.length,
      output: out,
    }),
  );
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
