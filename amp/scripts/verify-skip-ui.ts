import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { trialKey } from "../src/web/lib/pending-trial";
import { SKIP_USES_FREE_PROBLEM } from "../src/learning/skip";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

/**
 * Skip, in a real browser against the real learning API. Skip sits in the
 * answer area's tool row (44 px, with an accessible name) and works by touch
 * and by keyboard. It reveals the worked answer on a neutral sheet: no red,
 * no miss mark, no celebration. Nothing on the problem moves (bounding boxes
 * and the browser's layout-shift entries), nothing overflows, axe is clean,
 * no attempt is stored, and Next continues. Runs at 384x700, 390x844 and
 * 1280x800, light and dark, and writes screenshots.
 */
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
assertTestDatabaseTarget(url);
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const app = buildApp({
  repository,
  authenticate: developmentAuth(),
  development: true,
});
const apiPort = 4457,
  port = 4456,
  origin = `http://127.0.0.1:${port}`;
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  cacheDir: "node_modules/.vite-skip",
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    fs: {
      allow: [
        realpathSync(new URL("../", import.meta.url).pathname),
        realpathSync(new URL("../node_modules", import.meta.url).pathname),
      ],
    },
    proxy: { "/api": { target: `http://127.0.0.1:${apiPort}` } },
  },
});
await vite.listen();
const browser = await chromium.launch();
const shots =
  process.env.SKIP_SCREENS ??
  new URL("../artifacts/skip-ui/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });

type Box = { x: number; y: number; width: number; height: number };
const box = async (page: Page, selector: string): Promise<Box> => {
  const found = await page.locator(selector).first().boundingBox();
  assert.ok(found, `${selector} is laid out`);
  return found;
};
const same = (a: Box, b: Box, label: string) =>
  assert.ok(
    Math.abs(a.x - b.x) < 0.5 &&
      Math.abs(a.y - b.y) < 0.5 &&
      Math.abs(a.width - b.width) < 0.5 &&
      Math.abs(a.height - b.height) < 0.5,
    `${label} moved: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`,
  );
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function noOverflow(page: Page, label: string) {
  const width = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  );
  const viewport = page.viewportSize()!.width;
  assert.ok(width <= viewport + 1, `${label}: ${width}px > ${viewport}px`);
}
async function shifts(page: Page) {
  return page.evaluate(() => {
    const record = globalThis as unknown as { __shifts: number[] };
    const found = record.__shifts ?? [];
    record.__shifts = [];
    return found;
  });
}
const observeShifts = () => {
  const record = globalThis as unknown as { __shifts: number[] };
  record.__shifts = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      record.__shifts.push((entry as unknown as { value: number }).value);
  }).observe({ type: "layout-shift", buffered: true });
};

const errors: string[] = [];
try {
  for (const viewport of [
    { width: 384, height: 700 },
    { width: 390, height: 844 },
    // Tablets: the answer column beside the problem, and stacked in portrait.
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ])
    for (const colorScheme of ["light", "dark"] as const) {
      const label = `${viewport.width}x${viewport.height}-${colorScheme}`;
      const touch = viewport.width < 650;
      const context = await browser.newContext({
        viewport,
        colorScheme,
        hasTouch: touch,
      });
      const created = await (
        await fetch(`http://127.0.0.1:${apiPort}/api/v1/trials`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ birthYear: 2014 }),
        })
      ).json();
      await context.addInitScript(
        ([key, token]) => localStorage.setItem(key!, token!),
        [trialKey, created.token],
      );
      await context.addInitScript(observeShifts);
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/try/practice`);
      await page.locator(".question").waitFor();
      await settle(page);
      const skip = page.getByRole("button", {
        name: "Skip this problem and see its answer",
      });
      await skip.waitFor();
      const skipBox = await box(page, ".skip-action");
      assert.ok(
        skipBox.width >= 44 && skipBox.height >= 44,
        `${label}: Skip is a 44 px target`,
      );
      // Skip shares the tool row with Hint and Lesson without overlapping.
      for (const other of await page
        .locator(".answer-dock .practice-tools button:not(.skip-action)")
        .all()) {
        const b = (await other.boundingBox())!;
        assert.ok(
          b.x + b.width <= skipBox.x + 0.5 ||
            skipBox.x + skipBox.width <= b.x + 0.5,
          `${label}: Skip overlaps a tool`,
        );
      }
      await noOverflow(page, `${label} open`);
      await page.screenshot({ path: `${shots}${label}-1-open.png` });
      const question = await box(page, ".question");
      const meter = await page.locator(".practice-shell").textContent();
      await shifts(page);

      // Touch on phones; the keyboard on the desktop.
      if (touch) await skip.tap();
      else {
        await skip.focus();
        await page.keyboard.press("Enter");
      }
      const sheet = page.locator(".feedback");
      await sheet.waitFor();
      await page.waitForTimeout(400);
      await settle(page);
      assert.equal(
        await sheet.getAttribute("class"),
        "feedback solution-panel skipped",
        `${label}: a neutral sheet`,
      );
      assert.equal(await page.locator(".feedback.incorrect").count(), 0);
      assert.equal(await page.locator(".practice-celebration").count(), 0);
      assert.equal(await sheet.locator(".result-mark").textContent(), "→");
      await sheet.getByText("Skipped. Your progress is unchanged.").waitFor();
      await sheet.getByText("Answer:").waitFor();
      assert.ok(
        (await sheet.locator(".feedback-steps li").count()) > 0,
        `${label}: the worked steps are shown`,
      );
      // No red: the sheet and its mark paint from neutral tokens.
      const paints = await sheet.evaluate((element) => {
        const style = getComputedStyle(element);
        const probe = document.createElement("div");
        probe.style.background = "var(--color-danger)";
        document.body.append(probe);
        const danger = getComputedStyle(probe).backgroundColor;
        probe.style.background = "var(--color-danger-accent)";
        const accent = getComputedStyle(probe).backgroundColor;
        probe.remove();
        const mark = getComputedStyle(element.querySelector(".result-mark")!);
        return {
          sheet: style.backgroundColor,
          mark: mark.backgroundColor,
          danger,
          accent,
        };
      });
      assert.notEqual(paints.sheet, paints.danger, `${label}: sheet is red`);
      assert.notEqual(paints.mark, paints.accent, `${label}: mark is red`);
      // The problem never moved.
      same(question, await box(page, ".question"), `${label}: question`);
      assert.deepEqual(
        await shifts(page),
        [],
        `${label}: the browser recorded a layout shift`,
      );
      // Focus moves to Next, as after an answer.
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.classList.contains("next-action"),
        ),
        true,
        `${label}: focus on Next`,
      );
      await noOverflow(page, `${label} skipped`);
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .include(".feedback")
        .analyze();
      assert.deepEqual(
        axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`),
        [],
        `${label}: axe`,
      );
      await page.screenshot({ path: `${shots}${label}-2-skipped.png` });

      // Stored as a skip, never as an attempt.
      const attempts = await repository.pool.query(
        "SELECT count(*)::int AS n FROM amp_attempts WHERE learner_id=$1",
        [created.learnerId],
      );
      assert.equal(attempts.rows[0].n, 0, `${label}: no attempt`);
      const skipped = await repository.pool.query(
        "SELECT count(*)::int AS n FROM amp_instances WHERE learner_id=$1 AND (content->>'skipped')::boolean",
        [created.learnerId],
      );
      assert.equal(skipped.rows[0].n, 1, `${label}: one skip`);

      // Next continues with a new problem; the meter counts the skip.
      await page.locator(".next-action").click();
      await page.locator(".feedback").waitFor({ state: "detached" });
      await page.locator(".question").waitFor();
      await settle(page);
      if (SKIP_USES_FREE_PROBLEM)
        assert.notEqual(
          await page.locator(".practice-shell").textContent(),
          meter,
          `${label}: the meter counts the skip`,
        );
      await page.screenshot({ path: `${shots}${label}-3-next.png` });
      await context.close();
    }
  assert.deepEqual(errors, []);
  console.log(`Skip UI verified; screenshots in ${shots}`);
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
}
