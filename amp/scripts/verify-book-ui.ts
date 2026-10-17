import { exitPractice } from "./ui-practice";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/app.js";
import { PostgresRepository } from "../src/server/repository.js";
import { developmentAuth } from "../src/server/auth.js";
import { migrate } from "./migrate.js";
import { books, bookFor } from "../src/books/catalog.js";
import { readingFrames } from "../src/books/reading.js";
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--book"))
  throw new Error(
    "Use --book <registered-id> or omit arguments to verify all books",
  );
const selected = args.length ? bookFor(args[1]!) : undefined;
if (args.length && !selected) throw new Error("Unknown registered book");
const selectedBooks = selected ? [selected] : books;
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
await registerFamilyRoutes(app, {
  pool: repository.pool,
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
try {
  for (const { content: book } of selectedBooks) {
    const output = new URL(
      `../artifacts/book-reader/${book.id}/`,
      import.meta.url,
    ).pathname;
    await mkdir(output, { recursive: true });
    const modelPage = book.pages.find(
      (p) =>
        p.kind === "lesson" &&
        p.blocks.some((b) => b.kind === "diagram") &&
        p.blocks.some((b) => b.kind === "task"),
    );
    assert.ok(
      modelPage,
      "Reader fixture needs an authored model and learner task",
    );
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
    await page.getByRole("button", { name: "Lessons" }).click();
    await page.locator(`button[data-book-id="${book.id}"]`).click();
    await page.getByRole("main", { name: book.title }).waitFor();
    const frames = readingFrames(book);
    const comparisonScales = new Map<string, number>();
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
        { width: 390, height: 844, textScale: 1 },
        { width: 320, height: 568, textScale: 1 },
        { width: 844, height: 390, textScale: 1 },
        ...(book.presentation === "early-number" ||
        (frames[index]!.block.kind === "worked" &&
          (
            frames[index]!.block as Extract<
              import("../src/publishing/schema.js").BookBlock,
              { kind: "worked" }
            >
          ).promptPresentation === "context")
          ? [
              { width: 390, height: 844, textScale: 1.25 },
              { width: 320, height: 568, textScale: 1.25 },
            ]
          : []),
      ]) {
        await page.locator(".reading-content").evaluate((content) => {
          (content as HTMLElement).style.removeProperty("font-size");
        });
        await page.setViewportSize({ width: size.width, height: size.height });
        if (size.textScale !== 1)
          await page.locator(".reading-content").evaluate((content, scale) => {
            (content as HTMLElement).style.fontSize =
              `${parseFloat(getComputedStyle(content).fontSize) * scale}px`;
          }, size.textScale);
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
        if (
          book.presentation === "early-number" &&
          frames[index]!.block.kind === "callout" &&
          book.pages.find((p) => p.id === frames[index]!.pageId)?.kind ===
            "guide" &&
          size.width === 320 &&
          size.textScale === 1.25
        )
          await page.screenshot({
            path: `${output}/enlarged-guide-${index}.png`,
          });
        const block = frames[index]!.block;
        if (
          block.kind === "diagram" &&
          block.diagram.kind === "unit-region" &&
          block.diagram.scaleFrame
        ) {
          const key = `${frames[index]!.pageId}/${block.diagram.unit}/${JSON.stringify(block.diagram.scaleFrame)}/${size.width}/${size.height}/${size.textScale}`;
          const cell = await page
            .locator("[data-region-cell]")
            .first()
            .boundingBox();
          assert.ok(cell);
          assert.ok(
            Math.abs(cell.width - cell.height) < 0.1,
            "Region units must be square",
          );
          const prior = comparisonScales.get(key);
          if (prior !== undefined)
            assert.ok(
              Math.abs(prior - cell.width) < 0.1,
              `Comparison unit scales differ: ${key}`,
            );
          comparisonScales.set(key, cell.width);
        }
        if (
          frames[index]!.block.kind === "worked" &&
          frames[index]!.step === 0 &&
          size.width === 320 &&
          size.textScale === 1.25
        ) {
          const trigger = page.getByRole("button", {
            name: "Read the question",
            exact: true,
          });
          await trigger.click();
          const dialog = page.getByRole("dialog", {
            name: "The question",
            exact: true,
          });
          await dialog.waitFor();
          const worked = frames[index]!.block as Extract<
            import("../src/publishing/schema.js").BookBlock,
            { kind: "worked" }
          >;
          const restoredPrompt = await dialog
            .locator("p")
            .first()
            .evaluate((el) => {
              const copy = el.cloneNode(true) as HTMLElement;
              copy.querySelectorAll('[role="math"]').forEach((fraction) => {
                fraction.replaceWith(
                  (fraction.getAttribute("aria-label") ?? "").replace(
                    " over ",
                    "/",
                  ),
                );
              });
              return copy.textContent;
            });
          assert.equal(restoredPrompt, worked.prompt);
          const positionBefore = await page
            .locator(".reader-position")
            .innerText();
          await page.keyboard.press("ArrowRight");
          await page.keyboard.press("ArrowLeft");
          assert.equal(
            await page.locator(".reader-position").innerText(),
            positionBefore,
          );
          await page.keyboard.press("Escape");
          assert.equal(
            await trigger.evaluate((el) => el === document.activeElement),
            true,
          );
          await trigger.click();
          await dialog
            .getByRole("button", { name: "Back to the reasoning", exact: true })
            .click();
          assert.equal(
            await trigger.evaluate((el) => el === document.activeElement),
            true,
          );
        }
        const bounds = await page
          .locator(".reader-stage")
          .evaluate((stage) => ({
            height: stage.clientHeight,
            scroll: stage.scrollHeight,
          }));
        if (
          frames[index]!.block.kind === "worked" &&
          size.width === 320 &&
          size.textScale === 1.25
        )
          await page.screenshot({
            path: `${output}/worked-context-${index}-125.png`,
          });
        if (bounds.scroll > bounds.height + 2) {
          await page.screenshot({
            path: `${output}/overflow-${index}-${size.width}-${size.textScale}.png`,
          });
          overflow.push({
            index,
            kind: frames[index]!.block.kind,
            page: frames[index]!.pageId,
            ...size,
            scroll: bounds.scroll,
            available: bounds.height,
          });
        }
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
    console.log(`Overflow review: ${book.id}`, JSON.stringify(overflow));
    assert.deepEqual(
      overflow,
      [],
      "Every authored reading frame must fit ordinary device layouts",
    );
    await page.getByRole("button", { name: "Contents", exact: true }).click();
    await page
      .getByRole("button", {
        name: `${modelPage.eyebrow} ${modelPage.title}`,
        exact: true,
      })
      .click();
    assert.equal(
      await page.locator(".reader-heading h2").innerText(),
      modelPage.title,
    );
    await page.getByRole("button", { name: "Next →", exact: true }).click();
    const selected = await page.locator(".reader-position>span").innerText();
    await page.getByRole("button", { name: "← Back", exact: true }).click();
    await page.locator(`button[data-book-id="${book.id}"]`).click();
    assert.equal(
      await page.locator(".reader-position>span").innerText(),
      selected,
      "Book position restored",
    );
    await page.getByRole("button", { name: "Contents", exact: true }).click();
    await page
      .getByRole("button", {
        name: `${modelPage.eyebrow} ${modelPage.title}`,
        exact: true,
      })
      .click();
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
      (id) => document.activeElement?.getAttribute("data-book-id") === id,
      book.id,
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
    await page.locator(`button[data-book-id="${book.id}"]`).click();
    await exitPractice(page);
    await page.getByRole("button", { name: "Progress", exact: true }).click();
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
      `${book.id}: checked ${frames.length} frames across three device layouts${book.presentation === "early-number" ? " and two 125% body-text passes" : ""}.`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
    learner.id,
  ]);
  await repository.close();
}
