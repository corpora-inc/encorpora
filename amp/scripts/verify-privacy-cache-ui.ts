import { choose } from "./ui-controls";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { chromium } from "playwright";
import { createServer } from "vite";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { developmentAuth } from "../src/server/auth";
import { migrate } from "./migrate";
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const account = "development-household";
const learner = await repository.create(account, "Browser verification", 2016);
const learnerIds = [learner.id];
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
await app.listen({ host: "127.0.0.1", port: 4351 });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4350,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4351" } },
  },
});
await vite.listen();
const browser = await chromium.launch({ headless: true });
try {
  for (const mutation of ["withdraw", "delete"] as const) {
    const page = await browser.newPage({ hasTouch: true });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:4350");
    await choose(
      page.getByRole("button", { name: "Learner", exact: true }),
      learner.id,
    );
    await page.goto("http://127.0.0.1:4350/profile/birth-year");
    await page.getByRole("heading", { name: /^What year was/ }).waitFor();
    let releaseFamilyBatch!: () => void, familyBatchHeld!: () => void;
    const familyBatchRelease = new Promise<void>((resolve) => {
      releaseFamilyBatch = resolve;
    });
    const familyBatchWaiting = new Promise<void>((resolve) => {
      familyBatchHeld = resolve;
    });
    await page.route("**/batches", async (route) => {
      const result = await route.fetch();
      familyBatchHeld();
      await familyBatchRelease;
      await route.fulfill({ response: result });
    });
    await page.getByRole("button", { name: "2016", exact: true }).click();
    await page.getByRole("button", { name: "Go", exact: true }).click();
    await familyBatchWaiting;
    await page.getByRole("button", { name: "Open AMP menu" }).click();
    await page
      .getByRole("link", { name: "Manage learners", exact: true })
      .click();
    await page.getByRole("heading", { name: "Who’s learning?" }).waitFor();
    await page
      .getByRole("navigation", { name: "Family sections" })
      .getByRole("button", { name: "Privacy", exact: true })
      .click();
    await page
      .getByRole("button", {
        name:
          mutation === "withdraw" ? "Learning consent" : "Delete learning data",
        exact: false,
      })
      .click();
    // Synthetic mutation isolates this browser race from the shared test account.
    await page.route(
      mutation === "withdraw"
        ? "**/family/consent/withdraw"
        : "**/family/delete-learning-data",
      (route) =>
        route.fulfill({
          json:
            mutation === "withdraw"
              ? { withdrawn: true }
              : {
                  requestId: "synthetic",
                  deletedLearners: 1,
                  retainedBillingReferences: 0,
                  billingManagementRequired: false,
                  consentWithdrawn: true,
                },
        }),
    );
    await page.route("**/api/v1/me", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "family_service_unavailable" },
      }),
    );
    await page
      .getByRole("button", {
        name: mutation === "withdraw" ? "Withdraw consent" : "Review deletion",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", {
        name:
          mutation === "withdraw" ? "Withdraw consent" : "Delete learning data",
        exact: true,
      })
      .click();
    await page
      .getByText(
        "Your change was saved, but refreshed family details could not be loaded. Try refreshing; do not repeat the deletion.",
        { exact: true },
      )
      .waitFor();
    releaseFamilyBatch();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    assert.equal(
      await page.locator("#answer").count(),
      0,
      "Late batch cannot restore practice after privacy invalidation",
    );
    assert.equal(
      await page.getByRole("button", { name: "Go", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("navigation", { name: "Learning sections" }).count(),
      0,
    );
    await page.getByRole("button", { name: "Open AMP menu" }).click();
    await page
      .getByRole("link", { name: "Manage learners", exact: true })
      .click();
    await page.getByRole("heading", { name: "Family", exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `${mutation}: failed refresh and late batch cannot restore practice`,
    );
  }
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query(
    "DELETE FROM amp_learners WHERE id=ANY($1::text[])",
    [learnerIds],
  );
  await repository.close();
}
