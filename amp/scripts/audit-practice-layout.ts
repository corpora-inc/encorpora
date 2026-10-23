/** Synthetic-only production component audit. AMP_LAYOUT_SERVE=1 starts preview;
 * AMP_LAYOUT_LIMIT/FILTER (comma-separated ID substrings) bound runs. No database or account data is used. */
import { createServer } from "vite";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, firefox, webkit } from "playwright";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { templates, generateProblem } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";
import { probePracticeLayout } from "./practice-layout-probe";
if (process.env.NODE_ENV === "production")
  throw new Error("Layout harness is local development only");
const ampRoot = new URL("../", import.meta.url).pathname;
/** Hash actual source bytes, so committing identical files does not invalidate a run. */
const sourceState = () => {
  const paths = execFileSync(
    "git",
    [
      "-C",
      ampRoot,
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      "src",
      "scripts/audit-practice-layout.ts",
      "scripts/practice-layout-harness.tsx",
      "scripts/practice-layout-probe.ts",
      "package-lock.json",
      "vite.config.ts",
    ],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter((path) => path && existsSync(resolve(ampRoot, path)))
    .sort();
  const hash = createHash("sha256");
  for (const path of paths) {
    const bytes = readFileSync(resolve(ampRoot, path));
    hash.update(`${path}\0${bytes.length}\0`).update(bytes);
  }
  return {
    head: execFileSync("git", ["-C", ampRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    sourceFiles: paths.length,
    sourceTreeSha256: hash.digest("hex"),
  };
};
const initialSource = sourceState();
const port = Number(process.env.AMP_LAYOUT_PORT ?? 4436);
const out = process.env.AMP_LAYOUT_OUTPUT ?? "/tmp/amp-layout-audit";
await mkdir(out, { recursive: true });
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    cors: false,
    hmr: process.env.AMP_LAYOUT_SERVE === "1" ? undefined : false,
  },
  plugins: [
    {
      name: "layout-preview",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const u = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
          if (
            req.headers.host !== `127.0.0.1:${port}` ||
            req.headers["sec-fetch-site"] === "cross-site" ||
            (req.headers.origin &&
              req.headers.origin !== `http://127.0.0.1:${port}`)
          ) {
            res.statusCode = 403;
            res.end("Open the loopback layout URL directly.");
            return;
          }
          res.setHeader("Cache-Control", "no-store");
          try {
            if (
              u.pathname === "/layout-case" ||
              u.pathname === "/layout-lesson"
            ) {
              const id = u.searchParams.get("template")!;
              const seed = u.searchParams.get("seed") ?? "layout-0";
              const meta = templates.find((t) => t.id === id);
              if (!meta) {
                res.statusCode = 404;
                res.end("Unknown template");
                return;
              }
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify(
                  u.pathname === "/layout-lesson"
                    ? problemLesson(id, seed)
                    : { meta, seed, problem: generateProblem(id, seed) },
                ),
              );
              return;
            }
            if (u.pathname === "/layout") {
              res.setHeader("Content-Type", "text/html");
              res.end(
                await server.transformIndexHtml(
                  "/layout",
                  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/practice-layout-harness.tsx"></script></body></html>',
                ),
              );
              return;
            }
            next();
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e));
          }
        });
      },
    },
  ],
});
await vite.listen();
console.log(
  `Preview http://127.0.0.1:${port}/layout?template=slope-triangle-statements&seed=layout-0`,
);
if (process.env.AMP_LAYOUT_SERVE === "1") await new Promise(() => {});
const name = process.env.AMP_LAYOUT_BROWSER ?? "chromium";
const browser = await (
  { chromium, firefox, webkit }[name] ?? chromium
).launch();
// Prove the geometry checks detect clipping even when CSS hides overflow.
const probePage = await browser.newPage();
await probePage.setContent(
  '<style>.choice-option{display:block;width:150px;padding:8px;border:1px solid}.katex-html{display:inline-block}</style><label class="choice-option">A short answer</label>',
);
await probePage.evaluate("globalThis.__name ??= (f) => f");
if ((await probePracticeLayout(probePage)).length)
  throw new Error("Layout probe rejected valid baseline");
await probePage.setContent(
  '<label class="choice-option" style="display:block;width:80px;overflow:hidden"><span class="katex-html" style="display:inline-block;width:300px">A deliberately overflowing mathematical expression</span></label><svg width="60" height="40"><text x="50" y="20">outside</text></svg><section class="problem-stage" style="height:40px;overflow:auto"><div class="problem-content" style="height:100px"><p class="question">A deliberately tall problem</p></div></section>',
);
const corruptions = await probePracticeLayout(probePage);
for (const kind of [
  "content-overflow",
  "math-outside-card",
  "svg-label-outside",
  "whole-problem-requires-scroll",
])
  if (!corruptions.some((issue) => issue.kind === kind))
    throw new Error(`Layout probe missed ${kind}`);
await probePage.setViewportSize({ width: 320, height: 568 });
if (
  (await probePracticeLayout(probePage)).some(
    (issue) => issue.kind === "whole-problem-requires-scroll",
  )
)
  throw new Error("Intended phone scrolling incorrectly rejected");
await probePage.close();
const sizes = [
  [320, 568],
  [384, 744],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1280, 900],
  [568, 320],
];
const catalog = templates
  .filter(
    (t) =>
      !process.env.AMP_LAYOUT_FILTER ||
      process.env.AMP_LAYOUT_FILTER.split(",").some((id) =>
        t.id.includes(id.trim()),
      ),
  )
  .slice(0, Number(process.env.AMP_LAYOUT_LIMIT ?? templates.length));
const cases = catalog.flatMap((meta) => {
  const samples = Array.from({ length: 16 }, (_, i) => {
    const seed = `layout-${i}`;
    return { meta, seed, problem: generateProblem(meta.id, seed) };
  });
  const score = (v: (typeof samples)[number]) =>
    v.problem.public.prompt.length +
    JSON.stringify(v.problem.public.response).length +
    JSON.stringify(v.problem.public.figure ?? {}).length / 8;
  return [
    samples[0]!,
    samples.slice(1).sort((a, b) => score(b) - score(a))[0]!,
  ];
});
await writeFile(
  `${out}/manifest-${name}.json`,
  JSON.stringify(
    {
      source: initialSource,
      templates: catalog.length,
      candidateSeeds: 16,
      geometryPolicy: {
        phoneVerticalScroll: "allowed when reachable",
        tabletDesktopWholeProblem: "must fit at widths >=768",
        boundsTolerancePx: 2,
        controlHeightTargetPx: 44,
      },
      states: {
        answer: "all listed viewports/themes",
        feedback: "correct and incorrect at320x568 in both themes",
      },
      expectedStateCount: cases.length * (sizes.length * 2 + 4),
      cases: cases.map((v) => ({ template: v.meta.id, seed: v.seed })),
      sizes,
      themes: ["light", "dark"],
      limitation:
        "Finite baseline and length/figure-complexity stress sample; not every generated instance.",
    },
    null,
    2,
  ),
);
const report = `${out}/results-${name}.jsonl`;
await writeFile(report, "");
const pageErrors: string[] = [];
let index = 0,
  completed = 0,
  failures = 0;
try {
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      const page = await browser.newPage();
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.setDefaultTimeout(15000);
      await page.goto(`http://127.0.0.1:${port}/layout`);
      await page.waitForFunction(() => typeof window.layoutCase === "function");
      await page.evaluate("globalThis.__name ??= (f) => f");
      while (index < cases.length) {
        const value = cases[index++]!;
        for (const [width, height] of sizes)
          for (const theme of ["light", "dark"] as const) {
            await page.setViewportSize({ width: width!, height: height! });
            await page.emulateMedia({
              colorScheme: theme,
              reducedMotion: "reduce",
            });
            await page.evaluate(
              ({ value, theme }) => {
                document.documentElement.dataset.theme = theme;
                window.layoutReady = "";
                window.layoutCase(value);
              },
              { value, theme },
            );
            await page.waitForFunction(
              (id) => window.layoutReady === id,
              value.problem.public.id,
            );
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise<void>((r) =>
                requestAnimationFrame(() => requestAnimationFrame(() => r())),
              );
            });
            const issues = await probePracticeLayout(page);
            const opener = page.locator(".compact-answer-action");
            if (await opener.isVisible()) await opener.click();
            issues.push(...(await probePracticeLayout(page)));
            const contextSummary = page.locator(
              ".multi-select-question summary:visible",
            );
            if (await contextSummary.count()) {
              await contextSummary.click();
              issues.push(...(await probePracticeLayout(page)));
            }

            issues.push(
              ...(await page.evaluate(() => {
                const failed = [];
                for (const e of document.querySelectorAll(
                  ".choice-option, .choice-submit, .dialog-close, .answer-action, .math-keypad button, #answer",
                )) {
                  if (
                    !e.getClientRects().length ||
                    getComputedStyle(e).visibility === "hidden"
                  )
                    continue;
                  e.scrollIntoView({
                    block: "nearest",
                    inline: "nearest",
                    behavior: "instant",
                  });
                  const b = e.getBoundingClientRect();
                  const top = document.elementFromPoint(
                    Math.max(0, Math.min(innerWidth - 1, b.x + b.width / 2)),
                    Math.max(0, Math.min(innerHeight - 1, b.y + b.height / 2)),
                  );
                  if (!(
                    b.width >= 43 &&
                    b.height >= 43 &&
                    b.left >= -1 &&
                    b.right <= innerWidth + 1 &&
                    (e.matches(".choice-option")
                      ? Math.min(innerHeight, b.bottom) - Math.max(0, b.top) >=
                        43
                      : b.top >= -1 && b.bottom <= innerHeight + 1) &&
                    top &&
                    e.contains(top)
                  ))
                    failed.push({
                      kind: "unreachable-control",
                      selector: e.getAttribute("class") ?? e.tagName,
                      text: (e.textContent ?? "").slice(0, 180),
                      detail:
                        "center hit test or 44px target failed after scrolling",
                    });
                }
                return failed;
              })),
            );
            const unique = [
              ...new Map(issues.map((i) => [JSON.stringify(i), i])).values(),
            ];
            if (unique.length) {
              failures++;
              if (failures <= 150)
                await page.screenshot({
                  path: `${out}/${name}-${value.meta.id}-${value.seed}-${width}-${theme}.png`,
                });
            }
            await appendFile(
              report,
              JSON.stringify({
                template: value.meta.id,
                seed: value.seed,
                width,
                height,
                theme,
                state: "answer",
                issues: unique,
              }) + "\n",
            );
            completed++;
            const close = page.locator(".dialog-close:visible");
            if (await close.count()) await close.first().click();
            if (width === 320)
              for (const correct of [false, true]) {
                await page.evaluate(
                  (correct) => window.layoutFeedback(correct),
                  correct,
                );
                await page
                  .locator(
                    correct ? ".feedback.correct" : ".feedback.incorrect",
                  )
                  .waitFor();
                await page.evaluate(
                  () =>
                    new Promise<void>((resolve) =>
                      requestAnimationFrame(() =>
                        requestAnimationFrame(() => resolve()),
                      ),
                    ),
                );
                const feedbackIssues = await probePracticeLayout(page);
                const next = page.locator(".next-action:visible");
                await next.scrollIntoViewIfNeeded();
                if (
                  !(await next.evaluate((e) => {
                    const b = e.getBoundingClientRect();
                    const hit = document.elementFromPoint(
                      b.x + b.width / 2,
                      b.y + b.height / 2,
                    );
                    return (
                      b.height >= 43 &&
                      b.width >= 43 &&
                      b.top >= -1 &&
                      b.bottom <= innerHeight + 1 &&
                      b.left >= -1 &&
                      b.right <= innerWidth + 1 &&
                      !!hit &&
                      e.contains(hit)
                    );
                  }))
                )
                  feedbackIssues.push({
                    kind: "unreachable-control",
                    selector: ".next-action",
                    text: "Next",
                    detail:
                      "Feedback Next fails viewport bounds or44px center hit test",
                  });

                const state = correct
                  ? "correct-feedback"
                  : "incorrect-feedback";
                if (feedbackIssues.length) {
                  failures++;
                  if (failures <= 150)
                    await page.screenshot({
                      path: `${out}/${name}-${value.meta.id}-${value.seed}-${width}-${theme}-${state}.png`,
                    });
                }
                await appendFile(
                  report,
                  JSON.stringify({
                    template: value.meta.id,
                    seed: value.seed,
                    width,
                    height,
                    theme,
                    state,
                    issues: feedbackIssues,
                  }) + "\n",
                );
                completed++;
              }
          }
        if (completed % 120 === 0) console.log({ completed, failures });
      }
      await page.close();
    }),
  );
  const finalSource = sourceState();
  await writeFile(
    `${out}/summary-${name}.json`,
    JSON.stringify(
      {
        completed,
        failures,
        report,
        initialSource,
        finalSource,
        pageErrors,
        sourceChangedDuringRun:
          initialSource.sourceTreeSha256 !== finalSource.sourceTreeSha256,
      },
      null,
      2,
    ),
  );
  console.log({ completed, failures, pageErrors, report });
  if (
    failures ||
    pageErrors.length ||
    initialSource.sourceTreeSha256 !== finalSource.sourceTreeSha256
  )
    process.exitCode = 1;
} finally {
  await browser.close();
  await vite.close();
}
