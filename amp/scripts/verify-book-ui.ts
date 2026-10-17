import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/app.js";
import { PostgresRepository } from "../src/server/repository.js";
import { developmentAuth } from "../src/server/auth.js";
import { migrate } from "./migrate.js";
import { fractionFieldGuide } from "../books/fraction-field-guide/book.js";
import { readingFrames } from "../src/books/reading.js";
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL required");
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const learner = await repository.create("development-household", "Book review");
const app = buildApp({
  repository,
  authenticate: developmentAuth(),
  development: true,
});
await app.listen({ host: "127.0.0.1", port: 4341 });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    hmr: false,
    host: "127.0.0.1",
    port: 4340,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4341" } },
  },
});
await vite.listen();
const browser = await chromium.launch();
const output = new URL("../artifacts/book-reader/", import.meta.url).pathname;
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4340");
  await page
    .getByRole("combobox", { name: "Learner", exact: true })
    .selectOption(learner.id);
  await page.getByRole("button", { name: "Lesson library" }).click();
  await page.getByRole("button", { name: "Open book", exact: true }).click();
  await page.getByRole("main", { name: fractionFieldGuide.title }).waitFor();
  const frames = readingFrames(fractionFieldGuide);
  const overflow: {
    index: number;
    kind: string;
    page: string;
    width: number;
    height: number;
    scroll: number;
    available: number;
  }[] = [];
  for (let index = 0; index < frames.length; index++) {
    for (const size of [
      { width: 390, height: 844 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForFunction(
        () =>
          Math.abs(
            parseFloat(
              document.documentElement.style.getPropertyValue(
                "--practice-height",
              ),
            ) - innerHeight,
          ) < 1,
      );
      if (index === 93 && size.width === 320)
        await page.screenshot({ path: `${output}/compact-model.png` });
      const bounds = await page.locator(".reader-stage").evaluate((stage) => ({
        height: stage.clientHeight,
        scroll: stage.scrollHeight,
      }));
      if (bounds.scroll > bounds.height + 2)
        overflow.push({
          index,
          kind: frames[index]!.block.kind,
          page: frames[index]!.pageId,
          ...size,
          scroll: bounds.scroll,
          available: bounds.height,
        });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Horizontal overflow ${index}`,
      );
      const next = await page
        .locator(".reader-navigation button")
        .last()
        .boundingBox();
      assert.ok(
        next && next.y + next.height <= size.height + 1,
        `Navigation below viewport ${index} ${size.width}`,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    if (index === 0 || frames[index]!.block.kind === "diagram")
      await page.screenshot({
        path: `${output}/frame-${String(index).padStart(3, "0")}.png`,
      });
    if (index < frames.length - 1)
      await page.getByRole("button", { name: "Next →", exact: true }).click();
  }
  console.log("Overflow review", JSON.stringify(overflow));
  assert.deepEqual(
    overflow,
    [],
    "Every authored reading frame must fit ordinary device layouts",
  );
  await page.getByRole("button", { name: "Contents", exact: true }).click();
  await page.getByRole("button", { name: /What is one whole/ }).click();
  assert.match(
    await page.locator(".reader-heading").innerText(),
    /What is one whole/,
  );
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  const selected = await page.locator(".reader-position>span").innerText();
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await page.getByRole("button", { name: "Open book", exact: true }).click();
  assert.equal(
    await page.locator(".reader-position>span").innerText(),
    selected,
    "Book position restored",
  );
  await page.getByRole("button", { name: "Contents", exact: true }).click();
  await page.getByRole("button", { name: /What is one whole/ }).click();
  for (
    let n = 0;
    n < 12 &&
    !(await page
      .getByRole("button", { name: "See the model", exact: true })
      .count());
    n++
  )
    await page.getByRole("button", { name: "Next →", exact: true }).click();
  await page
    .getByRole("button", { name: "See the model", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Keep the model nearby" }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "See the model",
  );
  await page.route("**/books/*/download", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "This book’s download is being prepared. The reading edition is available.",
      }),
    }),
  );
  await page
    .getByRole("button", { name: "Download book", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: /reading edition is available/ })
    .waitFor();
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await page.waitForFunction(
    () => document.activeElement?.textContent?.trim() === "Open book",
  );
  let releaseOpen!: () => void;
  const delayedOpen = new Promise<void>((resolve) => {
    releaseOpen = resolve;
  });
  const pattern = "**/books/*/open";
  await page.route(pattern, async (route) => {
    const response = await route.fetch();
    await delayedOpen;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Open book", exact: true }).click();
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  releaseOpen();
  await page.waitForResponse((response) => response.url().endsWith("/open"));
  await page.waitForFunction(
    () =>
      !(
        document.querySelector(
          "select[aria-label='Learner']",
        ) as HTMLSelectElement
      )?.disabled,
  );
  assert.equal(
    await page.locator(".book-reader").count(),
    0,
    "Delayed open cannot replace a newer navigation choice",
  );
  await page.unroute(pattern);
  assert.deepEqual(errors, []);
  console.log(
    `Book reader checked ${frames.length} frames across three device layouts.`,
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
    learner.id,
  ]);
  await repository.close();
}
