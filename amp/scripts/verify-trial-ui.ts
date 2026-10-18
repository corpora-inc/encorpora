import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { developmentAuth } from "../src/server/auth";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { TEACHING_ATTEMPTS } from "../src/server/trial-progress";
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
    const attemptResponse = await attempt;
    assert.equal(
      attemptResponse.status(),
      200,
      `Placement answer ${answered + 1}: ${await attemptResponse.text()}`,
    );
    answered++;
    // Every outcome shows the feedback overlay; its Next button advances.
    const next = page.locator(".next-action");
    await next.click();
    await next.waitFor({ state: "hidden" });
  }
  assert.equal(answered, TRIAL_ATTEMPTS);

  // Placement is followed by the existing lesson, not a purchase prompt.
  await page
    .getByText("View placement map and uncertainty", { exact: true })
    .click();
  await result.locator(".frontier-map").waitFor();
  await page
    .getByText("View placement map and uncertainty", { exact: true })
    .click();
  await result.getByText(/^Estimated level:/).waitFor();
  assert.equal(
    await result.getByRole("button", { name: /left\)$/ }).count(),
    0,
  );
  await fits(page, "result");

  assert.equal(await page.locator(".paywall").count(), 0);
  await page
    .getByRole("button", { name: "Try four problems", exact: true })
    .waitFor();
  // A genuinely exhausted family still offers a clear way to save placement.
  // The database regression covers exhaustion; here verify its rendered state.
  await page.route("**/trial-progress", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: {
        ...(await response.json()),
        phase: "unavailable",
        templateId: null,
        lesson: null,
      },
    });
  });
  await page.reload();
  await page
    .getByRole("button", {
      name: "Save placement in a parent account",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Try four problems", exact: true })
      .count(),
    0,
  );
  await fits(page, "unavailable");
  await page.unroute("**/trial-progress");
  // Reloading the lesson retains server-owned phase and selected family.
  await page.reload();
  await page
    .getByRole("button", { name: "Try four problems", exact: true })
    .waitFor();
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = "yes";
    };
  });
  await page
    .getByRole("button", {
      name: "Print lesson and worked examples",
      exact: true,
    })
    .click();
  await page.waitForFunction(() => document.body.dataset.printed === "yes");
  assert.equal(await page.locator(".trial-print-examples article").count(), 3);
  await page.pdf({
    path: new URL("trial-lesson.pdf", shots).pathname,
    format: "A4",
  });
  await page
    .getByRole("button", { name: "Try four problems", exact: true })
    .click();
  for (let i = 0; i < TEACHING_ATTEMPTS; i++) {
    await page.locator(".problem-stage").waitFor();
    const attempt = page.waitForResponse((r) => r.url().endsWith("/attempts"));
    if (await page.locator(".choice-option").count()) {
      await page.locator(".choice-option").first().click();
      await page.locator(".choice-submit").click();
    } else {
      await page.locator("#answer").fill("1");
      await page.locator("#answer").press("Enter");
    }
    assert.equal((await attempt).status(), 200);
    await page.locator(".next-action").click();
    await page.locator(".next-action").waitFor({ state: "hidden" });
  }
  await page.locator(".paywall").waitFor();
  await page
    .getByRole("heading", { name: "Next practice sessions", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "What you can practice", exact: true })
    .waitFor();
  await page
    .getByText(
      `Across this trial: ${TRIAL_ATTEMPTS + TEACHING_ATTEMPTS} independent answers and 0 answers with support.`,
      { exact: true },
    )
    .waitFor();
  await fits(page, "teaching-complete");
  const trialToken = await page.evaluate(() =>
    localStorage.getItem("amp.trial"),
  );
  const analytics = await repository.pool.query(
    "SELECT analytics_id FROM amp_trials WHERE token_hash=encode(sha256($1::bytea),'hex')",
    [trialToken],
  );
  assert.deepEqual(
    (
      await repository.pool.query(
        "SELECT event FROM amp_trial_events WHERE trial_id=$1 ORDER BY event",
        [analytics.rows[0].analytics_id],
      )
    ).rows.map((row) => row.event),
    ["paywall", "placement_done", "teaching_done", "trial_started"],
  );

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
  assert.equal(
    frontier.json().overall.answered,
    TRIAL_ATTEMPTS + TEACHING_ATTEMPTS,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("amp.trial")),
    null,
    "the trial token is removed from the device",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Trial funnel verified: placement, lesson, printable, focused practice, paywall events, sign-in, save.",
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
}
