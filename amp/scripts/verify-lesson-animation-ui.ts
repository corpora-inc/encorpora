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
assert.equal(lessons.length, 4);
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ProblemLesson} from '/src/web/ProblemLesson.tsx';
import '/src/web/style.css';import '/src/web/theme.css';import '/node_modules/katex/dist/katex.min.css';
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
  `../artifacts/lesson-animation${browserName === "webkit" ? "-webkit" : ""}/`,
  import.meta.url,
);
await mkdir(output, { recursive: true });
const metrics: unknown[] = [];
try {
  for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
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
    for (let i = 0; i < lessons.length; i++) {
      await page.getByRole("button", { name: "Open next lesson" }).click();
      const panel = page.getByRole("region", { name: "Explore the example" });
      await panel.waitFor();
      await panel.scrollIntoViewIfNeeded();
      const initial = await panel.boundingBox();
      assert(initial);
      assert.equal(await panel.getAttribute("data-step"), "0");
      await panel.getByRole("button", { name: "Step", exact: true }).focus();
      await panel
        .getByRole("button", { name: "Step", exact: true })
        .press("Enter");
      await page.waitForTimeout(750);
      await panel.screenshot({
        path: new URL(`${ids[i] ?? "exchange-ones"}-${width}-step.png`, output)
          .pathname,
      });
      await panel.getByRole("button", { name: "Step", exact: true }).focus();
      await panel
        .getByRole("button", { name: "Step", exact: true })
        .press("Enter");
      await page.waitForTimeout(750);
      assert.equal(await panel.getAttribute("data-step"), "2");
      assert(
        await panel
          .getByRole("button", { name: "Step", exact: true })
          .evaluate((el) => el === document.activeElement),
        "Step lost keyboard focus",
      );
      assert(
        await panel
          .getByRole("button", { name: "Step", exact: true })
          .isDisabled(),
      );
      const final = await panel.boundingBox();
      assert(final);
      assert.equal(initial.height, final.height);
      assert.equal(initial.y, final.y);
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
        path: new URL(`${ids[i] ?? "exchange-ones"}-${width}-final.png`, output)
          .pathname,
      });
      await panel.getByRole("button", { name: "Replay", exact: true }).click();
      assert.equal(await panel.getAttribute("data-step"), "0");
      await panel.getByRole("button", { name: "Play", exact: true }).click();
      await panel.getByRole("button", { name: "Pause", exact: true }).click();
      await page.waitForTimeout(1900);
      assert.equal(
        await panel.getAttribute("data-step"),
        "0",
        "Pause advanced the step",
      );
      if (i === 0) {
        // Desktop browser scheduling evidence, not a claim about phone GPU performance.
        await panel.getByRole("button", { name: "Play", exact: true }).click();
        await page.waitForTimeout(1700);
        const frameIntervals: number[] = await page.evaluate(`(async () => {
          const times = [];
          let previous = performance.now();
          return new Promise((resolve) => {
            function frame(now) {
              times.push(now - previous);
              previous = now;
              if (times.length < 90) requestAnimationFrame(frame);
              else resolve(times.slice(1));
            }
            requestAnimationFrame(frame);
          });
        })()`);
        metrics.push({
          width,
          maxFrameIntervalMs: Math.max(...frameIntervals),
          averageFrameIntervalMs:
            frameIntervals.reduce((a, b) => a + b, 0) / frameIntervals.length,
        });
        await page.waitForFunction(
          () =>
            document
              .querySelector(".lesson-animation")
              ?.getAttribute("data-step") === "2",
        );
        await page.waitForTimeout(1900);
        assert(
          await panel
            .getByRole("button", { name: "Play", exact: true })
            .isVisible(),
        );
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
        const copy = await panel.locator(".animation-copy").boundingBox();
        const controls = await panel
          .locator(".animation-controls")
          .boundingBox();
        assert(
          copy && controls && copy.y + copy.height <= controls.y,
          "Enlarged text overlaps controls",
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
          !document.querySelector(".animation-controls"),
      );
      assert.equal(await panel.getAttribute("data-step"), "2");
      assert.equal(await panel.getByRole("button").count(), 0);
      assert.equal(
        await panel
          .locator(".animation-move")
          .first()
          .evaluate((el) => getComputedStyle(el).transitionDuration),
        "0s",
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await panel
        .getByRole("button", { name: "Replay", exact: true })
        .waitFor();
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  const remountPage = await browser.newPage();
  await remountPage.goto(`http://127.0.0.1:${address.port}/animation-review`);
  await remountPage.getByRole("button", { name: "Open next lesson" }).click();
  await remountPage.getByRole("button", { name: "Play", exact: true }).click();
  await remountPage.getByRole("button", { name: "Open next lesson" }).click();
  await remountPage
    .locator('.lesson-animation[data-animation="array"]')
    .waitFor();
  await remountPage.waitForTimeout(1900);
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
    "Lesson animations: controls, lazy loading, KaTeX, stable geometry, overflow, reduced motion and 24 screenshots passed.",
  );
  console.log(JSON.stringify(metrics));
} finally {
  await browser.close();
  await vite.close();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
