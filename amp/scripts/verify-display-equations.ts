/** Reproducible screenshots of the production practice, math and workbook components. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { generateProblem } from "../src/math/engine";
import { normalizeTrailingMath } from "../src/content/prompt-structure";
import { workbookHtml } from "../src/workbook/render";
import { printWorkbookPdf, waitForWorkbookLayout } from "../src/workbook/pdf";
import { checkWorkbookLayout, layoutFailures } from "./workbook-layout";
import type { WorkbookSpec } from "../src/workbook/compose";

const out =
  process.env.DISPLAY_REVIEW_OUT ??
  join(homedir(), ".config/corpora/amp-qa/reports/fix-display-equations");
await mkdir(out, { recursive: true });
const linear = generateProblem("two-step-equation", "display-0", 1);
linear.public.prompt = normalizeTrailingMath(
  "Solve for $k$: $2.5k - 4.1 = -9.1$.",
);
linear.public.response = { kind: "number", label: "$k$" };
linear.answer = "-2";
linear.explanation = [
  "Add 4.1 to both sides: $2.5k=-5$",
  "Divide both sides by 2.5: $k=-2$",
];
const withPrompt = (prompt: string) => ({
  ...linear,
  public: {
    ...linear.public,
    response: { kind: "number" as const, label: "$x$" },
    prompt: normalizeTrailingMath(prompt),
  },
});
const cases = {
  linear: { problem: linear, title: "Solve a two-step equation" },
  inequality: {
    problem: generateProblem("affine-linear-inequality", "display-0", 1),
    title: "Solve an inequality",
  },
  simplify: {
    problem: generateProblem("polynomial-addition", "display-0", 1),
    title: "Simplify an expression",
  },
  long: {
    problem: withPrompt(
      "Solve for $x$: $3(x+12)-4(2x-7)+5(x-9)=2(3x+8)-7(x-11)+4$.",
    ),
    title: "Solve a linear equation",
  },
  figure: {
    problem: generateProblem("balance-one-step", "display-0", 1),
    title: "Read a balance",
  },
  stacked: {
    problem: withPrompt(
      "Solve for $x$: $\\begin{cases}2x+3y=13\\\\4x-y=5\\end{cases}$.",
    ),
    title: "Solve a system",
  },
  atomic: {
    problem: withPrompt(
      "Simplify: $\\frac{123x+456y+789z+1234}{234x+567y+890z+4321}$.",
    ),
    title: "Simplify an expression",
  },
  lesson: { problem: linear, title: "Worked example", surface: "lesson" },
  review: { problem: linear, title: "Review your answer", surface: "review" },
};
const spec: WorkbookSpec = {
  version: 2,
  date: "2026-11-14",
  number: 1,
  minutes: 30,
  level: 7,
  choices: { areas: [], lean: "level", lesson: false },
  sections: [
    {
      kind: "practice",
      items: [
        "two-step-equation",
        "polynomial-addition",
        "affine-linear-inequality",
        "balance-one-step",
      ].map((templateId) => ({
        templateId,
        templateVersion: 1,
        seed: "display-0",
        skillId: "two-step-equations",
        strand: "algebra",
        grade: 7,
        minutes: 3,
        space: "standard",
      })),
    },
  ],
};
const workbook = workbookHtml(spec, {
  lessons: [],
  skillTitle: () => "Equations and expressions",
  paper: "letter",
});
const server = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: Number(process.env.DISPLAY_REVIEW_PORT ?? 4810),
    strictPort: true,
    hmr: false,
  },
  plugins: [
    {
      name: "display-equation-fixtures",
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          const url = new URL(req.url ?? "/", "http://fixture");
          if (url.pathname === "/__display-case") {
            const value =
              cases[url.searchParams.get("case") as keyof typeof cases];
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(value));
            return;
          }
          if (url.pathname === "/__display") {
            res.setHeader("Content-Type", "text/html");
            res.end(
              '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/display-equations/main.tsx"></script></body></html>',
            );
            return;
          }
          if (url.pathname === "/__workbook") {
            res.setHeader("Content-Type", "text/html");
            res.end(workbook);
            return;
          }
          next();
        });
      },
    },
  ],
});
await server.listen();
const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
const browser = await secureChromium(rawChromium).launch({ headless: true });
const results: unknown[] = [];
try {
  const context = await browser.newContext();
  await context.route("**/api/**", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as any).__name = (fn: unknown) => fn;
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      for (const [name, fixture] of Object.entries(cases)) {
        await page.goto(`${origin}/__display?case=${name}`);
        await page
          .locator(
            name === "lesson" || name === "review"
              ? ".math-display"
              : ".question",
          )
          .first()
          .waitFor();
        await page.evaluate(async (theme) => {
          document.documentElement.dataset.theme = theme;
          await document.fonts.ready;
        }, theme);
        await page.waitForTimeout(150);
        const geometry = await page.evaluate(() => {
          const question = document.querySelector<HTMLElement>(
            ".question, .lesson-example-prompt",
          )!;
          const bounds = question.getBoundingClientRect();
          const displays = [
            ...question.querySelectorAll<HTMLElement>(".math-display"),
          ].map((element) => {
            const box = element.getBoundingClientRect();
            const bases = [
              ...element.querySelectorAll<HTMLElement>(".katex-html > .base"),
            ].map((base) => {
              const b = base.getBoundingClientRect();
              return { left: b.left, right: b.right, top: b.top };
            });
            return {
              left: box.left,
              right: box.right,
              top: box.top,
              width: box.width,
              font: getComputedStyle(element).fontSize,
              bases,
              center: getComputedStyle(element).textAlign,
            };
          });
          return {
            documentWidth: document.documentElement.scrollWidth,
            width: innerWidth,
            questionTop: bounds.top,
            displays,
            figures: document.querySelectorAll(
              ".figure svg, svg.figure, .figure",
            ).length,
          };
        });
        assert.ok(
          geometry.documentWidth <= width + 1,
          `${name}/${width}: document overflow`,
        );
        if (name !== "figure")
          assert.equal(geometry.displays.length, 1, `${name}: display missing`);
        else
          assert.ok(geometry.figures > 0, "figure survives prompt formatting");
        for (const display of geometry.displays) {
          assert.equal(display.center, "center");
          assert.ok(
            display.top > geometry.questionTop + 10,
            `${name}: math must follow the lead-in`,
          );
          for (const base of display.bases)
            assert.ok(
              base.left >= display.left - 1 && base.right <= display.right + 1,
              `${name}/${width}: math overflows: ${JSON.stringify(display)}`,
            );
        }
        if (name === "long" && width === 320)
          assert.ok(
            new Set(geometry.displays[0]!.bases.map((b) => Math.round(b.top)))
              .size > 1,
            "long equation wraps",
          );
        if (name === "atomic" && width === 320)
          assert.ok(
            parseFloat(geometry.displays[0]!.font) < 22,
            "atomic fraction scales",
          );
        await page.screenshot({
          path: join(out, `${name}-${width}-${theme}.png`),
          fullPage: true,
        });
        results.push({
          name,
          width,
          theme,
          prompt: fixture.problem.public.prompt,
          ...geometry,
        });
      }
      // The printable document keeps white paper in either system theme. Its
      // page screenshot uses the actual paper dimensions, independent of viewport.
      await page.goto(`${origin}/__workbook`);
      await waitForWorkbookLayout(page);
      await page
        .locator(".wb-page--student")
        .first()
        .screenshot({ path: join(out, `workbook-${width}-${theme}.png`) });
    }
  await page.goto(`${origin}/__workbook`);
  const pdf = await printWorkbookPdf(page, workbook);
  await writeFile(join(out, "workbook-letter.pdf"), pdf);
  const failures = layoutFailures(await checkWorkbookLayout(page), pdf);
  assert.deepEqual(failures, []);
  assert.deepEqual(errors, []);
  await writeFile(join(out, "geometry.json"), JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify({
      screenshots: results.length + 8,
      cases: Object.keys(cases).length + 1,
      widths: [320, 390, 768, 1280],
      themes: ["light", "dark"],
      workbookLayoutFailures: failures,
      browserErrors: errors,
      out,
    }),
  );
} finally {
  await browser.close();
  await server.close();
}
