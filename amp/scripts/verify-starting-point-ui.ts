import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app.js";
import { PostgresRepository } from "../src/server/repository.js";
import { developmentAuth } from "../src/server/auth.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { migrate } from "./migrate.js";
import { templates } from "../src/math/engine.js";
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL required");
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const learner = await repository.create(
  "development-household",
  "Starting explorer",
);
const other = await repository.create(
  "development-household",
  "Another explorer",
);
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
await app.listen({ host: "127.0.0.1", port: 4443 });
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4442,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4443" } },
  },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch();
const directory = new URL(
  `../artifacts/starting-point-${process.platform}-${process.env.AMP_BROWSER ?? "chromium"}/`,
  import.meta.url,
);
await mkdir(directory, { recursive: true });
async function fit(page: Page, label: string) {
  await page.screenshot({ path: new URL(`${label}.png`, directory).pathname });
  const metrics = await page.locator("main").evaluate((element) => ({
    height: element.clientHeight,
    scroll: element.scrollHeight,
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    bottom: element.getBoundingClientRect().bottom,
    viewport: innerHeight,
  }));
  assert.ok(
    metrics.scroll <= metrics.height + 2 &&
      metrics.scrollWidth <= metrics.width + 2 &&
      metrics.bottom <= metrics.viewport + 1,
    `${label}: ${JSON.stringify(metrics)}`,
  );
}
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4442");
  await page
    .getByRole("combobox", { name: "Learner", exact: true })
    .selectOption(learner.id);
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await page.locator(".session-invitation").waitFor();
    await fit(page, `invitation-${size.width}`);
    await page.locator(".starting-point-trigger").click();
    const algebra = page.getByRole("button", { name: /Algebra & functions/ });
    await algebra.waitFor();
    await page.waitForFunction(
      () =>
        !(
          document.querySelector(
            ".starting-point-options button",
          ) as HTMLButtonElement
        )?.disabled,
    );
    assert.equal(
      await page
        .locator("#starting-point-title")
        .evaluate((element) => element === document.activeElement),
      true,
    );
    await fit(page, `picker-${size.width}`);
    const bounds = await algebra.boundingBox();
    assert.ok(bounds && bounds.height >= 44 && bounds.width >= 44);
    await algebra.click();
    await page
      .getByRole("button", { name: /Starting point: Algebra/ })
      .waitFor();
    await page.waitForFunction(() =>
      document.activeElement?.classList.contains("starting-point-trigger"),
    );
    await fit(page, `saved-${size.width}`);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator(".starting-point-trigger").click();
  await page.getByRole("button", { name: /Algebra & functions/ }).waitFor();
  await page.waitForFunction(() =>
    document.querySelector(
      '.starting-point-options button[aria-pressed="true"]',
    ),
  );
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1.25";
  });
  await page.screenshot({
    path: new URL("picker-125-percent.png", directory).pathname,
  });
  // Enlarged text may scroll within the focused screen; every choice must remain reachable.
  for (const choice of await page
    .locator(".starting-point-options button")
    .all()) {
    await choice.scrollIntoViewIfNeeded();
    const bounds = await choice.boundingBox();
    assert.ok(
      bounds && bounds.y >= 0 && bounds.y + bounds.height <= 568,
      "An enlarged choice is unreachable",
    );
  }
  const earliest = page.getByRole("button", { name: /Early number/ });
  await earliest.scrollIntoViewIfNeeded();
  await earliest.click();
  await page.locator(".session-invitation").waitFor();
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  await page.locator(".starting-point-trigger").click();
  await page.waitForFunction(
    () =>
      !(
        document.querySelector(
          ".starting-point-options button",
        ) as HTMLButtonElement
      )?.disabled,
  );
  await page.route("**/starting-point", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 503, json: { error: "Fixture unavailable" } })
      : route.continue(),
  );
  await page.getByRole("button", { name: /Algebra & functions/ }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "That choice was not saved" })
    .waitFor();
  await page.screenshot({
    path: new URL("save-error.png", directory).pathname,
  });
  await page.unroute("**/starting-point");
  await page.getByRole("button", { name: /Algebra & functions/ }).click();
  await page.locator(".session-invitation").waitFor();
  const batchResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/batches") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Start your mix", exact: true })
    .click();
  const batch = await (await batchResponse).json();
  assert.ok(
    batch.problems.every(
      (problem: { templateId: string }) =>
        templates.find((template) => template.id === problem.templateId)!
          .gradeBand !== "K–2",
    ),
  );
  assert.equal(
    new Set(batch.selection.map((entry: { strand: string }) => entry.strand))
      .size,
    3,
  );
  await page.locator(".problem-stage").waitFor();
  await page.getByRole("button", { name: "Change topic", exact: true }).click();
  await page.locator(".starting-point-trigger").click();
  await page.waitForFunction(
    () =>
      !(
        document.querySelector(
          ".starting-point-options button",
        ) as HTMLButtonElement
      )?.disabled,
  );
  let held!: () => void;
  let release!: () => void;
  const received = new Promise<void>((resolve) => {
    held = resolve;
  });
  const proceed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/starting-point", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    held();
    await proceed;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: /Groups & fractions/ }).click();
  await received;
  await page
    .getByRole("combobox", { name: "Learner", exact: true })
    .selectOption(other.id);
  await page.locator(".session-invitation").waitFor();
  release();
  await page.unrouteAll({ behavior: "wait" });
  await page.locator(".starting-point-trigger").click();
  await page.waitForFunction(
    () =>
      !(
        document.querySelector(
          ".starting-point-options button",
        ) as HTMLButtonElement
      )?.disabled,
  );
  assert.equal(
    await page
      .locator('.starting-point-options button[aria-pressed="true"]')
      .count(),
    0,
  );
  assert.deepEqual(
    await repository.transaction("development-household", other.id, (tx) =>
      tx.startingPoint(),
    ),
    { band: null, policyVersion: null, excludedStrands: [] },
  );
  assert.deepEqual(errors, []);
  console.log(
    "Starting-point screens, mixed high-range batch, error/retry, focus, enlarged text and held-save learner switching passed.",
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query(
    "DELETE FROM amp_learners WHERE id=ANY($1::text[])",
    [[learner.id, other.id]],
  );
  await repository.close();
}
