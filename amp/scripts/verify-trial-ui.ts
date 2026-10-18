import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { developmentAuth } from "../src/server/auth";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { TRIAL_ATTEMPTS } from "../src/server/trials";
import { migrate } from "./migrate";

/** "Try free" end to end: a visitor without an account places, reaches the
 * paywall, signs in, and saves the placement with every answer. */
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
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
await app.listen({ host: "127.0.0.1", port: 4353 });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4352,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4353" } },
  },
});
await vite.listen();
const shots = new URL("../artifacts/screenshots/", import.meta.url);
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function fits(page: Page, label: string) {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(700); // let the map's transitions settle
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    assert.ok(overflow <= 0, `${label} overflows ${viewport.width}px`);
    await page.screenshot({
      path: new URL(`trial-${label}-${viewport.width}.png`, shots).pathname,
      fullPage: true,
    });
  }
}

try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4352/?signed-out");

  // Welcome: one primary action, and the brand never wraps.
  const brand = await page.locator("header .brand").boundingBox();
  assert.ok(brand && brand.height < 56, "brand stays on one line");
  await fits(page, "welcome");
  await page.getByRole("button", { name: "Try free", exact: true }).click();
  await page.getByRole("button", { name: "2016", exact: true }).click();

  // Answer until the allowance is used. Correctness does not matter here.
  let answered = 0;
  const result = page.locator(".trial-result");
  while (!(await result.isVisible())) {
    assert.ok(answered < TRIAL_ATTEMPTS, "the paywall follows the allowance");
    const stage = page.locator(".problem-stage");
    await Promise.race([stage.waitFor(), result.waitFor()]);
    if (await result.isVisible()) break;
    const attempt = page.waitForResponse((r) => r.url().endsWith("/attempts"));
    const choice = page.locator(".choice-option").first();
    if (await choice.count()) {
      await choice.click();
      await page.locator(".choice-submit").click();
    } else {
      await page.locator("#answer").fill("1");
      await page.locator("#answer").press("Enter");
    }
    assert.equal((await attempt).status(), 200);
    answered++;
    // Every outcome shows the feedback overlay; its Next button advances.
    const next = page.locator(".next-action");
    await next.click();
    await next.waitFor({ state: "hidden" });
  }
  assert.equal(answered, TRIAL_ATTEMPTS);

  // The result: an estimate, the map, the paywall, and no further practice.
  await result.locator(".frontier-map").waitFor();
  await result.getByText(/^Estimated level:/).waitFor();
  assert.equal(
    await result.getByRole("button", { name: /left\)$/ }).count(),
    0,
  );
  await fits(page, "result");

  // Signing in offers to save the placement before anything else.
  await page
    .getByRole("button", { name: "Create a parent account", exact: true })
    .click();
  await page.getByRole("heading", { name: "Save this placement" }).waitFor();
  assert.equal(
    await page.getByRole("navigation", { name: "Learning sections" }).count(),
    0,
  );
  await fits(page, "save");
  const name = `Trial ${Date.now()}`;
  await page.getByLabel("Learner name").fill(name);
  await page.getByRole("button", { name: "Save and continue" }).click();
  // Saving leads straight to the paywall: card or education funds.
  await page.getByRole("heading", { name: "Choose your AMP plan" }).waitFor();
  await page.getByText(name, { exact: true }).waitFor();
  await fits(page, "choose");
  await page.getByRole("button", { name: "Back to family" }).click();
  await page.getByRole("button", { name: "Purchases & records" }).waitFor();

  // Every trial answer now belongs to the saved learner.
  const headers = { authorization: "Bearer amp-local-development" };
  const { learners } = (
    await app.inject({ method: "GET", url: "/api/v1/learners", headers })
  ).json() as { learners: { id: string; name: string }[] };
  const saved = learners.find((learner) => learner.name === name);
  assert.ok(saved, "the placement is saved into the family");
  const frontier = await app.inject({
    method: "GET",
    url: `/api/v1/learners/${saved.id}/frontier`,
    headers,
  });
  assert.equal(frontier.json().overall.answered, TRIAL_ATTEMPTS);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("amp.trial")),
    null,
    "the trial token is removed from the device",
  );
  assert.deepEqual(errors, []);
  console.log("Trial funnel verified: placement, paywall, sign-in, save.");
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
}
