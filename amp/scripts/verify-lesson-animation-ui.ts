import assert from "node:assert/strict";
import { createServer as httpServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { createServer } from "vite";
import { problemLesson } from "../src/content/problem-lessons";

// Isolated presentation harness: actual generated lessons, no API or database.
const ids = ["fraction-model", "split-array-part", "exchange-base-ten"];
const lessons = ids
  .slice(0, 2)
  .map((id) => problemLesson(id, "animation-review"));
for (const unit of [10, 1]) {
  for (let i = 0; i < 100; i++) {
    const lesson = problemLesson("exchange-base-ten", `animation-${i}`);
    const f = lesson.example.figure;
    if (f?.kind === "base-ten" && (unit === 1 ? f.ones >= 10 : f.tens >= 10)) {
      lessons.push(lesson);
      break;
    }
  }
}
// Comparison models: a spread row that pairs down, and tens that decide.
for (const id of [
  "compare-groups",
  "compare-two-digit",
  "make-ten-fact",
  "area-model-product",
])
  lessons.push(problemLesson(id, "animation-review"));
// A sum whose ones make a new ten.
for (let i = 0; ; i++) {
  const lesson = problemLesson("add-two-digit-regroup", `animation-${i}`);
  const f = lesson.example.figure;
  if (
    f?.kind === "base-ten-pair" &&
    (f.values[0] % 10) + (f.values[1] % 10) >= 10
  ) {
    lessons.push(lesson);
    break;
  }
}
// Fact arrays: rows build, the array turns, counters are dealt and regrouped.
for (const id of [
  "multiply-facts",
  "divide-facts",
  "share-or-group",
  "balanced-addition",
  "unknown-addend-story",
  "three-addend-story",
  "parallel-lines-angle",
  "related-patterns-relationship",
  "dependent-variable-equation",
])
  lessons.push(problemLesson(id, "animation-review"));
const names = [
  "fraction-model",
  "split-array-part",
  "exchange-base-ten",
  "exchange-ones",
  "compare-groups",
  "compare-two-digit",
  "make-ten-fact",
  "area-model-product",
  "add-two-digit-regroup",
  "multiply-facts",
  "divide-facts",
  "share-or-group",
  "balanced-addition",
  "unknown-addend-story",
  "three-addend-story",
  "parallel-lines-angle",
  "related-patterns-relationship",
  "dependent-variable-equation",
];
assert.equal(lessons.length, names.length);
const limit = Number(process.env.AMP_ANIMATION_LIMIT ?? lessons.length);
assert(Number.isInteger(limit) && limit > 0 && limit <= lessons.length);
const start = Number(process.env.AMP_ANIMATION_START ?? 0);
assert(Number.isInteger(start) && start >= 0 && start < limit);
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ProblemLesson} from '/src/web/ProblemLesson.tsx';
import '/src/web/app/styles.ts';
const lessons=${JSON.stringify(lessons)};
function App(){const [index,setIndex]=React.useState(-1);return React.createElement('main',{style:{maxWidth:660,margin:'auto',padding:12}},React.createElement('button',{onClick:()=>setIndex((index+1)%lessons.length)},'Open next lesson'),index>=0&&React.createElement(ProblemLesson,{key:index,lesson:lessons[index]}));}createRoot(document.getElementById('root')).render(React.createElement(App));
`;
const server = httpServer();
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  server: { middlewareMode: true, hmr: { server } },
  appType: "custom",
  plugins: [
    {
      name: "animation-review",
      resolveId(id) {
        if (id === "/animation-review-entry.tsx") return id;
      },
      load(id) {
        if (id === "/animation-review-entry.tsx") return entry;
      },
      configureServer(server) {
        server.middlewares.use("/animation-review", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              "/animation-review",
              `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/animation-review-entry.tsx"></script></body></html>`,
            ),
          );
        });
      },
    },
  ],
});
server.on("request", vite.middlewares);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const browserName =
  process.env.AMP_ANIMATION_BROWSER === "webkit" ? "webkit" : "chromium";
const browser = await (browserName === "webkit" ? webkit : chromium).launch();
const output = new URL(
  `${process.env.AMP_ANIMATION_OUTPUT ?? "/tmp/amp-lesson-animation"}-${browserName}/`,
  "file://",
);
await mkdir(output, { recursive: true });
const metrics: unknown[] = [];
try {
  for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.clock.install();
    const errors: string[] = [],
      requests: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error(error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") console.error(message.text());
    });
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(`http://127.0.0.1:${address.port}/animation-review`);
    await page.getByRole("button", { name: "Open next lesson" }).waitFor();
    assert(
      !requests.some((url) => url.includes("/LessonAnimation.tsx")),
      "Animation loaded before lesson opened",
    );
    for (let skipped = 0; skipped < start; skipped++)
      await page.getByRole("button", { name: "Open next lesson" }).click();
    for (let i = start; i < limit; i++) {
      await page.getByRole("button", { name: "Open next lesson" }).click();
      const panel = page.getByRole("region", { name: "Explore the example" });
      await panel.waitFor();
      await panel.scrollIntoViewIfNeeded();
      const initial = await panel.boundingBox();
      assert(initial);
      assert.equal(await panel.getAttribute("data-step"), "0");
      assert.equal(await panel.getByRole("button").count(), 0);
      assert.equal(await panel.locator(".animation-transcript li").count(), 3);
      if (
        names[i] === "related-patterns-relationship" ||
        names[i] === "dependent-variable-equation"
      ) {
        assert.equal(
          await panel.locator(".animation-copy .animation-pair").count(),
          names[i] === "related-patterns-relationship" ? 5 : 4,
        );
        assert(
          await panel
            .locator(".animation-frame:visible .animation-equation")
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          "Ordered-pair caption requires horizontal scrolling",
        );
        await panel.screenshot({
          path: new URL(`${names[i]}-${width}-initial.png`, output).pathname,
        });
      }
      await page.clock.runFor(100);
      assert.equal(await panel.getAttribute("data-visible"), "true");
      await page.clock.runFor(2400);
      assert.equal(await panel.getAttribute("data-step"), "1");
      if (names[i] === "parallel-lines-angle")
        assert(
          await panel
            .locator(".animation-frame:visible .animation-equation")
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          "Plain-language caption requires horizontal scrolling",
        );
      await page.clock.runFor(900);
      await page.waitForTimeout(850);
      await panel.screenshot({
        path: new URL(`${names[i]}-${width}-step.png`, output).pathname,
      });
      await page.clock.runFor(1500);
      assert.equal(await panel.getAttribute("data-step"), "2");
      await page.waitForTimeout(850);
      const final = await panel.boundingBox();
      assert(final);
      assert.equal(initial.height, final.height);
      assert.equal(initial.y, final.y);
      await panel.screenshot({
        path: new URL(`${names[i]}-${width}-final.png`, output).pathname,
      });
      const figure = lessons[i].example.figure!;
      if (figure.kind === "fraction") {
        const pieces = panel.locator("[data-piece]");
        assert.equal(await pieces.count(), figure.selected);
        assert.equal(
          Number(await pieces.first().getAttribute("width")) * figure.parts,
          272,
        );
        const colors = await panel.evaluate((el) => [
          getComputedStyle(el.querySelector("[data-piece]")!).fill,
          getComputedStyle(el.querySelector(".animation-empty")!).fill,
        ]);
        const luminance = (rgb: string) =>
          rgb
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((value) => {
              const channel = value / 255;
              return channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4;
            })
            .reduce(
              (sum, channel, index) =>
                sum + channel * [0.2126, 0.7152, 0.0722][index],
              0,
            );
        const [dark, light] = colors.map(luminance).sort((a, b) => a - b);
        assert(
          (light + 0.05) / (dark + 0.05) >= 3,
          "Shaded and unshaded parts lack contrast",
        );
        const source = await panel.locator(".animation-empty").boundingBox();
        const lifted = await pieces.first().boundingBox();
        assert(
          source && lifted && lifted.y + lifted.height < source.y,
          "Lifted parts overlap the original whole",
        );
      } else if (figure.kind === "unit-array") {
        const cells = panel.locator("[data-cell]");
        assert.equal(await cells.count(), figure.rows * figure.columns);
        assert.equal(
          await cells.first().getAttribute("width"),
          await cells.first().getAttribute("height"),
        );
      } else if (figure.kind === "dot-array") {
        const total =
          figure.total ?? (figure.rows ?? 0) * (figure.columns ?? 0);
        assert.equal(await panel.locator("circle[data-dot]").count(), total);
      } else if (figure.kind === "equal-balance") {
        // Level at the last step: both pans hang at the same height.
        const pans = await panel.evaluate((el) =>
          [...el.querySelectorAll("[data-pan] path")].map(
            (n) => n.getBoundingClientRect().y,
          ),
        );
        assert.equal(pans.length, 2);
        assert(Math.abs(pans[0]! - pans[1]!) < 0.5, "Balance is not level");
      } else if (figure.kind === "addend-groups") {
        const total = figure.addends.reduce((a, b) => a + b, 0);
        const placed = await panel.evaluate((el) =>
          [...el.querySelectorAll("[data-counter]")].every((g) => {
            const b = g.getBoundingClientRect();
            const cx = b.x + b.width / 2,
              cy = b.y + b.height / 2;
            return [...el.querySelectorAll("[data-slot]")].some((n) => {
              const r = n.getBoundingClientRect();
              return cx > r.x && cx < r.right && cy > r.y && cy < r.bottom;
            });
          }),
        );
        assert.equal(await panel.locator("[data-counter]").count(), total);
        assert(placed, "Three-addend counters do not land in the frames");
      } else if (figure.kind === "share-model") {
        assert.equal(
          await panel.locator("[data-counter]").count(),
          figure.total,
        );
        // Every regrouped counter ends inside a tray of the visible set.
        const placed = await panel.evaluate((el) =>
          [...el.querySelectorAll("[data-counter]")].every((g) => {
            const b = g.getBoundingClientRect();
            const cx = b.x + b.width / 2,
              cy = b.y + b.height / 2;
            return [...el.querySelectorAll('[data-trays="1"] rect')].some(
              (n) => {
                const r = n.getBoundingClientRect();
                return cx > r.x && cx < r.right && cy > r.y && cy < r.bottom;
              },
            );
          }),
        );
        assert(placed, "Regrouped counters do not land in their groups");
      } else if (figure.kind === "ten-frame-pair") {
        assert.equal(
          await panel.locator('[data-counter="first"]').count(),
          figure.first,
        );
        assert.equal(
          await panel.locator('[data-counter="second"]').count(),
          figure.second,
        );
        assert.equal(
          await panel.locator("[data-moves]").count(),
          10 - figure.first,
        );
        // Every moved square ends inside an empty place of the first frame.
        const placed = await panel.evaluate((el) =>
          [...el.querySelectorAll("[data-moves]")].every((g) => {
            const b = g.getBoundingClientRect();
            const cx = b.x + b.width / 2,
              cy = b.y + b.height / 2;
            return [...el.querySelectorAll('[data-slot^="0-"]')].some((n) => {
              const r = n.getBoundingClientRect();
              return cx > r.x && cx < r.right && cy > r.y && cy < r.bottom;
            });
          }),
        );
        assert(placed, "Moved counters do not land in the first frame");
      } else if (figure.kind === "counter-rows") {
        assert.equal(
          await panel.locator('[data-counter="circle"]').count(),
          figure.circles,
        );
        assert.equal(
          await panel.locator('[data-counter="square"]').count(),
          figure.squares,
        );
        assert.equal(
          await panel.locator("[data-pair]").count(),
          Math.min(figure.circles, figure.squares),
        );
        // After lining up, each pair shares one x position.
        const centers = await panel.evaluate((el) =>
          ["circle", "square"].map((shape) =>
            [...el.querySelectorAll(`[data-counter="${shape}"]`)].map((g) => {
              const box = g.getBoundingClientRect();
              return Math.round(box.x + box.width / 2);
            }),
          ),
        );
        for (let k = 0; k < Math.min(figure.circles, figure.squares); k++)
          assert(
            Math.abs(centers[0]![k]! - centers[1]![k]!) <= 1,
            "Pairs are not aligned",
          );
      } else if (figure.kind === "area-model") {
        const regions = panel.locator("[data-region]");
        assert.equal(
          await regions.count(),
          figure.columns.length * figure.rows.length,
        );
        // To scale: widths and heights keep the ratio of their parts.
        const [w0, w1] = await Promise.all(
          [0, 1].map(async (i) =>
            Number(await regions.nth(i).locator("rect").getAttribute("width")),
          ),
        );
        assert(
          Math.abs(w0! / w1! - figure.columns[0]! / figure.columns[1]!) < 1e-6,
          "Area model is not to scale",
        );
      } else if (figure.kind === "base-ten-pair") {
        const tens = figure.values.reduce((s, n) => s + Math.floor(n / 10), 0),
          ones = figure.values.reduce((s, n) => s + (n % 10), 0);
        assert.equal(await panel.locator('[data-unit="ten"]').count(), tens);
        assert.equal(await panel.locator('[data-unit="one"]').count(), ones);
      } else if (figure.kind === "base-ten") {
        assert.equal(
          await page.locator('[data-unit="hundred"]').count(),
          figure.hundreds,
        );
        assert.equal(
          await page.locator('[data-unit="ten"]').count(),
          figure.tens,
        );
        assert.equal(
          await page.locator('[data-unit="one"]').count(),
          figure.ones,
        );
        const units = panel.locator("[data-exchange-unit]");
        assert.equal(await units.count(), 10);
        const unit = figure.ones >= 10 ? 1 : 10;
        assert.equal(
          Number(await units.first().locator("rect").getAttribute("height")) /
            Number(await units.first().locator("rect").getAttribute("width")),
          unit,
        );
      }

      assert((await panel.locator(".katex").count()) > 0);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Horizontal overflow",
      );
      await panel.screenshot({
        path: new URL(`${names[i]}-${width}-final.png`, output).pathname,
      });
      if (i === 0) {
        await page.clock.runFor(2300);
        assert.equal(
          await panel.getAttribute("data-step"),
          "0",
          "Loop did not restart",
        );
        await panel.evaluate((el) => {
          (el as HTMLElement).style.display = "none";
        });
        await page.clock.runFor(100);
        await page.waitForTimeout(100);
        assert.equal(
          await page.locator(".lesson-animation").getAttribute("data-visible"),
          "false",
        );
        await page.clock.runFor(5000);
        assert.equal(
          await page.locator(".lesson-animation").getAttribute("data-step"),
          "0",
          "Hidden animation kept cycling",
        );
        await page.locator(".lesson-animation").evaluate((el) => {
          (el as HTMLElement).style.display = "";
        });
        await panel.scrollIntoViewIfNeeded();
        await page.clock.runFor(100);
        await page.waitForTimeout(100);
        assert.equal(await panel.getAttribute("data-visible"), "true");
        await page.clock.runFor(2400);
        assert.equal(
          await panel.getAttribute("data-step"),
          "1",
          "Visible animation did not resume",
        );
        metrics.push({ width, looped: true, pausedWhileHidden: true });
      }
      if (width === 320) {
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "200%";
        });
        assert(
          await panel
            .locator(".animation-copy")
            .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
          "Enlarged text exceeds copy row",
        );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "Enlarged text overflows viewport",
        );
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "";
        });
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(
        () =>
          document
            .querySelector(".lesson-animation")
            ?.getAttribute("data-step") === "2" &&
          document
            .querySelector(".lesson-animation")
            ?.getAttribute("data-reduced") === "true",
      );
      assert.equal(await panel.getAttribute("data-step"), "2");
      assert.equal(await panel.getByRole("button").count(), 0);
      assert.equal(await panel.locator(".animation-frame:visible").count(), 3);
      assert.equal(await panel.locator(".animation-transcript").count(), 0);
      if (i === 0 && width === 320)
        await panel.screenshot({
          path: new URL(`${names[i]}-${width}-reduced.png`, output).pathname,
        });
      assert.equal(
        await panel
          .locator(".animation-move, .animation-fade, .animation-step")
          .first()
          .evaluate((el) => getComputedStyle(el).transitionDuration),
        "0s",
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.waitForFunction(
        () =>
          document
            .querySelector(".lesson-animation")
            ?.getAttribute("data-reduced") === "false",
      );
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  const remountPage = await browser.newPage();
  await remountPage.clock.install();
  await remountPage.goto(`http://127.0.0.1:${address.port}/animation-review`);
  await remountPage.getByRole("button", { name: "Open next lesson" }).click();
  await remountPage.locator(".lesson-animation").scrollIntoViewIfNeeded();
  await remountPage.clock.runFor(100);
  await remountPage.clock.runFor(2400);
  assert.equal(
    await remountPage.locator(".lesson-animation").getAttribute("data-step"),
    "1",
  );
  await remountPage.getByRole("button", { name: "Open next lesson" }).click();
  await remountPage
    .locator('.lesson-animation[data-animation="array"]')
    .waitFor();
  await remountPage.clock.runFor(1000);
  assert.equal(
    await remountPage.locator(".lesson-animation").getAttribute("data-step"),
    "0",
    "Previous playback survived remount",
  );
  await remountPage.close();
  const reducedPage = await browser.newPage({
    reducedMotion: "reduce",
    viewport: { width: 320, height: 900 },
  });
  await reducedPage.goto(`http://127.0.0.1:${address.port}/animation-review`);
  await reducedPage.getByRole("button", { name: "Open next lesson" }).click();
  await reducedPage.locator('.lesson-animation[data-step="2"]').waitFor();
  assert.equal(await reducedPage.locator(".animation-controls").count(), 0);
  assert.equal(
    await reducedPage.locator(".animation-frame:visible").count(),
    3,
  );
  await reducedPage.close();
  const failedPage = await browser.newPage();
  await failedPage.route("**/LessonAnimation.tsx", (route) => route.abort());
  await failedPage.goto(`http://127.0.0.1:${address.port}/animation-review`);
  await failedPage.getByRole("button", { name: "Open next lesson" }).click();
  await failedPage.locator(".lesson-example .figure").waitFor();
  assert(
    await failedPage
      .getByRole("button", { name: "Open next lesson" })
      .isVisible(),
    "Failed chunk unmounted the app",
  );
  assert(await failedPage.locator(".lesson-example-answer").isVisible());
  await failedPage.close();
  await writeFile(
    new URL("metrics.json", output),
    JSON.stringify(metrics, null, 2),
  );
  console.log(
    `Lesson animations: ${limit - start} examples across 3 widths; control-free visible loop, hidden pause, lazy loading, geometry, overflow, reduced-motion captions, and ${(limit - start) * 6} motion screenshots passed.`,
  );
  console.log(JSON.stringify(metrics));
} finally {
  await browser.close();
  await vite.close();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
